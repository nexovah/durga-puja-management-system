// Shared Cash-vs-Bank bucket math — the single source of truth used by
// Treasury's "Cash & Bank" widget/detail page, Dashboard's balance figure,
// and the Balance Sheet report, so all three stay consistent. See the
// "Cash & Bank tracking" plan for the full design.

import {
  Chanda, DonationAd, Member, Loan, Expense,
  getChandaCreditAmount, getDonationAdCreditAmount, getMemberCreditAmount, getExpenseCreditAmount,
} from '../App';
import { EventInfo } from './db';

export type MoneyBucket = 'cash' | 'bank';

// PaidMethod ('notSelected'|'cash'|'qrScan'|'onlineBanking'|'check') and
// PaidThrough ('notSelected'|'cash'|'check'|'qrPayment'|'onlineBanking')
// both collapse to the same two buckets — 'notSelected' folds into 'cash'
// (confirmed product decision, rather than a separate "unclassified" bucket).
export function bucketForMethod(method: string): MoneyBucket {
  return method === 'cash' || method === 'notSelected' ? 'cash' : 'bank';
}

export interface CashBankSourceBreakdown {
  key: string;
  label: string;
  cash: number;
  bank: number;
}

export interface CashBankTotals {
  openingCash: number;
  openingBank: number;
  cashIn: number;
  bankIn: number;
  cashOut: number;
  bankOut: number;
  closingCash: number;
  closingBank: number;
  totalBalance: number;
  sources: CashBankSourceBreakdown[];
}

export function computeCashBankTotals(params: {
  event: Pick<EventInfo, 'openingCash' | 'openingBank'>;
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  members: Member[];
  loansList: Loan[];
  expenses: Expense[];
}): CashBankTotals {
  const { event, chandaList, donationAdsList, members, loansList, expenses } = params;

  const collection: CashBankSourceBreakdown = { key: 'collection', label: 'Collection', cash: 0, bank: 0 };
  for (const c of chandaList) {
    const amount = getChandaCreditAmount(c);
    if (amount <= 0) continue;
    collection[bucketForMethod(c.paidMethod)] += amount;
  }

  const donation: CashBankSourceBreakdown = { key: 'donation', label: 'Donation', cash: 0, bank: 0 };
  const sponsorship: CashBankSourceBreakdown = { key: 'sponsorship', label: 'Sponsorship', cash: 0, bank: 0 };
  for (const d of donationAdsList) {
    const amount = getDonationAdCreditAmount(d);
    if (amount <= 0) continue;
    const target = d.category === 'ads' ? sponsorship : donation;
    target[bucketForMethod(d.paidMethod)] += amount;
  }

  const memberPayment: CashBankSourceBreakdown = { key: 'memberPayment', label: 'Member Payment', cash: 0, bank: 0 };
  for (const m of members) {
    const amount = getMemberCreditAmount(m);
    if (amount <= 0 || !m.membershipPaidMethod) continue;
    memberPayment[bucketForMethod(m.membershipPaidMethod)] += amount;
  }

  // Loans have one payment-method field covering both the money received
  // and any repayment made — approximated with that single field for both
  // directions (no per-transaction method on Loans today).
  const loanReceived: CashBankSourceBreakdown = { key: 'loanReceived', label: 'Loan Received', cash: 0, bank: 0 };
  const loanRepayment: CashBankSourceBreakdown = { key: 'loanRepayment', label: 'Loan Repayment', cash: 0, bank: 0 };
  for (const l of loansList) {
    const bucket = bucketForMethod(l.paymentMethod);
    if (l.amountReceived > 0) loanReceived[bucket] += l.amountReceived;
    if (l.amountPaid > 0) loanRepayment[bucket] += l.amountPaid;
  }

  const expenseOut: CashBankSourceBreakdown = { key: 'expenses', label: 'Expenses', cash: 0, bank: 0 };
  for (const e of expenses) {
    const amount = getExpenseCreditAmount(e);
    if (amount <= 0) continue;
    expenseOut[bucketForMethod(e.paidThrough)] += amount;
  }

  const cashIn = collection.cash + donation.cash + sponsorship.cash + memberPayment.cash + loanReceived.cash;
  const bankIn = collection.bank + donation.bank + sponsorship.bank + memberPayment.bank + loanReceived.bank;
  const cashOut = loanRepayment.cash + expenseOut.cash;
  const bankOut = loanRepayment.bank + expenseOut.bank;

  const openingCash = event.openingCash || 0;
  const openingBank = event.openingBank || 0;
  const closingCash = openingCash + cashIn - cashOut;
  const closingBank = openingBank + bankIn - bankOut;

  return {
    openingCash,
    openingBank,
    cashIn,
    bankIn,
    cashOut,
    bankOut,
    closingCash,
    closingBank,
    totalBalance: closingCash + closingBank,
    sources: [collection, donation, sponsorship, memberPayment, loanReceived, loanRepayment, expenseOut],
  };
}
