// Help & Support tickets — same 'support_tickets' table and column names as
// supabase/059_support_tickets.sql. RLS scopes select/insert to the caller's
// own tenant_id + user_id, and tenant_id defaults from the JWT (same pattern
// as every other tenant-scoped insert in this app, see 021_tenant_id_defaults
// .sql) so it's never set client-side. No update/delete — tickets are
// append-only from the client, matching the DB policies.
import { File, Paths } from 'expo-file-system';
import { supabase } from './supabase';

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicket {
  id: string;
  ticketCode: string;
  userId: string;
  username: string;
  userName: string;
  title: string;
  body: string;
  imageUrl?: string;
  status: TicketStatus;
  createdAt: string;
}

function fromTicketRow(row: any): SupportTicket {
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    userId: row.user_id,
    username: row.username,
    userName: row.user_name,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url || undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromTicketRow);
}

// Uploads a picked image to the public 'support-attachments' bucket and
// returns its public URL — same read-file-then-upload idiom as
// reportExport.ts's expo-file-system usage, ported to Supabase Storage the
// way uploadLogo() does on web (src/app/lib/db.ts).
async function uploadTicketImage(imageUri: string): Promise<string> {
  const ext = (imageUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
  const path = `ticket-${Date.now()}.${ext}`;

  const file = new File(imageUri);
  const buffer = await file.arrayBuffer();

  const { error } = await supabase.storage.from('support-attachments').upload(path, buffer, {
    upsert: true,
    contentType,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('support-attachments').getPublicUrl(path);
  return data.publicUrl;
}

export interface CreateTicketInput {
  userId: string;
  username: string;
  userName: string;
  title: string;
  body: string;
  imageUri?: string;
}

export async function createTicket(input: CreateTicketInput): Promise<SupportTicket> {
  let imageUrl: string | undefined;
  if (input.imageUri) {
    imageUrl = await uploadTicketImage(input.imageUri);
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: input.userId,
      username: input.username,
      user_name: input.userName,
      title: input.title.trim(),
      body: input.body.trim(),
      image_url: imageUrl || null,
      status: 'open',
    })
    .select()
    .single();
  if (error) throw error;
  return fromTicketRow(data);
}
