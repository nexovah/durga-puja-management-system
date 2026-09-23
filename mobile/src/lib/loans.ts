// Loans — same 'loans' table and column names as the web app's
// src/app/lib/db.ts (fromLoanRow/toLoanRow). No delete anywhere (v1 scope).
import { supabase } from './supabase';
import { PaidMethod } from './db';

export interface Loan {
  id: string;
  donorName: string;
  amountReceived: number; // received from the lender — credited to the committee's balance
  amountPaid: number; // repaid back to the lender so far — deducted from that credit
  phone: string;
  paymentMethod: PaidMethod;
  date: string;
  returnDate?: string;
  remarks: string;
}

export const getLoanNetAmount = (l: Loan): number => l.amountReceived - (l.amountPaid || 0);

function fromLoanRow(row: any): Loan {
  return {
    id: row.id,
    donorName: row.donor_name,
    amountReceived: Number(row.amount_received) || 0,
    amountPaid: Number(row.amount_paid) || 0,
    phone: row.phone || '',
    paymentMethod: row.payment_method,
    date: row.date,
    returnDate: row.return_date || '',
    remarks: row.remarks || '',
  };
}
function toLoanRow(l: Partial<Loan>) {
  return {
    donor_name: l.donorName,
    amount_received: l.amountReceived,
    amount_paid: l.amountPaid || 0,
    phone: l.phone,
    payment_method: l.paymentMethod,
    payment_status: 'paid',
    date: l.date,
    return_date: l.returnDate || null,
    remarks: l.remarks || '',
  };
}

export async function listLoans(): Promise<Loan[]> {
  const { data, error } = await supabase.from('loans').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromLoanRow);
}
export async function createLoan(l: Omit<Loan, 'id'>): Promise<Loan> {
  const { data, error } = await supabase.from('loans').insert(toLoanRow(l)).select().single();
  if (error) throw error;
  return fromLoanRow(data);
}
export async function updateLoan(id: string, l: Partial<Loan>): Promise<Loan> {
  const { data, error } = await supabase.from('loans').update(toLoanRow(l)).eq('id', id).select().single();
  if (error) throw error;
  return fromLoanRow(data);
}
