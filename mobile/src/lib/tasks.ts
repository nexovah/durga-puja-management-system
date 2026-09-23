// Tasks — same 'tasks' table and column names as the web app's
// src/app/lib/db.ts (fromTaskRow/toTaskRow). No delete anywhere (v1 scope).
import { supabase } from './supabase';

export type TaskPriority = 'low' | 'medium' | 'high' | 'note' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  createdAt: string;
  expiryDate: string;
  assignedMemberIds: string[];
  createdBy: string;
  createdByName: string;
}

function fromTaskRow(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    priority: row.priority,
    createdAt: row.created_at,
    expiryDate: row.expiry_date || '',
    assignedMemberIds: row.assigned_member_ids || [],
    createdBy: row.created_by || '',
    createdByName: row.created_by_name || '',
  };
}
function toTaskRow(task: Partial<Task>) {
  return {
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    created_at: task.createdAt,
    expiry_date: task.expiryDate || null,
    assigned_member_ids: task.assignedMemberIds || [],
    created_by: task.createdBy || null,
    created_by_name: task.createdByName || null,
  };
}

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromTaskRow);
}
export async function createTask(t: Omit<Task, 'id'>): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert(toTaskRow(t)).select().single();
  if (error) throw error;
  return fromTaskRow(data);
}
export async function updateTask(id: string, t: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase.from('tasks').update(toTaskRow(t)).eq('id', id).select().single();
  if (error) throw error;
  return fromTaskRow(data);
}

export function defaultExpiryDate(createdAtISO: string): string {
  const d = new Date(createdAtISO);
  d.setDate(d.getDate() + 15);
  return d.toISOString().split('T')[0];
}
