// Estimations — same 'estimations' table and column names as the web app's
// src/app/lib/db.ts (fromEstimationRow/toEstimationRow). No delete anywhere
// (v1 scope). Mobile v1 simplifies the web's drag-reorder line-item editor
// to a plain add/remove-row list.
import { supabase } from './supabase';

export interface EstimationLineItem {
  id: string;
  title: string;
  customField: string;
  customField2: string;
  amount: number;
}

export interface EstimationColumnLabels {
  serialNo: string;
  title: string;
  customField: string;
  customField2: string;
  amount: string;
}

export const DEFAULT_ESTIMATION_COLUMN_LABELS: EstimationColumnLabels = {
  serialNo: 'S. No.',
  title: 'Item',
  customField: 'Field 1',
  customField2: 'Field 2',
  amount: 'Amount',
};

export interface Estimation {
  id: string;
  title: string;
  lineItems: EstimationLineItem[];
  columnLabels: EstimationColumnLabels;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

export const getEstimationTotal = (e: Estimation): number =>
  (e.lineItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

function fromEstimationRow(row: any): Estimation {
  return {
    id: row.id,
    title: row.title || '',
    lineItems: row.line_items || [],
    columnLabels: { ...DEFAULT_ESTIMATION_COLUMN_LABELS, ...(row.column_labels || {}) },
    createdAt: row.created_at,
    createdBy: row.created_by || '',
    createdByName: row.created_by_name || '',
  };
}
function toEstimationRow(e: Partial<Estimation>) {
  return {
    title: e.title || '',
    line_items: e.lineItems || [],
    column_labels: e.columnLabels || DEFAULT_ESTIMATION_COLUMN_LABELS,
    created_at: e.createdAt,
    created_by: e.createdBy || null,
    created_by_name: e.createdByName || null,
  };
}

export async function listEstimations(): Promise<Estimation[]> {
  const { data, error } = await supabase.from('estimations').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromEstimationRow);
}
export async function createEstimation(e: Omit<Estimation, 'id'>): Promise<Estimation> {
  const { data, error } = await supabase.from('estimations').insert(toEstimationRow(e)).select().single();
  if (error) throw error;
  return fromEstimationRow(data);
}
export async function updateEstimation(id: string, e: Partial<Estimation>): Promise<Estimation> {
  const { data, error } = await supabase.from('estimations').update(toEstimationRow(e)).eq('id', id).select().single();
  if (error) throw error;
  return fromEstimationRow(data);
}
