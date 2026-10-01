import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Wallet, Landmark, MoreVertical } from 'lucide-react';
import { User } from '../App';
import {
  ActivityModule, ActivityFieldChange, CashBankAdjustment, CashBankBucket, CashBankDirection,
  listCashBankAdjustmentsRequest, createCashBankAdjustmentRequest, deleteCashBankAdjustmentRequest,
} from '../lib/db';
import { CashBankTotals } from '../lib/cashBank';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface CashBankDetailProps {
  totals: CashBankTotals;
  currentUser: User | null;
  onLog: (action: 'create' | 'delete', module: ActivityModule, summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
  onBack: () => void;
  onAdjustmentsChanged: () => void;
}

const todayISO = () => new Date().toISOString().split('T')[0];

// "Full control" detail page opened from Treasury's Cash & Bank widget —
// per-source In/Out breakdown plus a manual adjustments ledger (bank
// interest, ATM withdrawals, corrections) on top of what's auto-calculated
// from Chanda/Donations/Expenses/Loans. Open to anyone with Treasury
// access (not admin-gated), per the confirmed product decision.
export function CashBankDetail({ totals, currentUser, onLog, onBack, onAdjustmentsChanged }: CashBankDetailProps) {
  const [adjustments, setAdjustments] = useState<CashBankAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CashBankAdjustment | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setOpenRowMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const reload = () => {
    setLoading(true);
    listCashBankAdjustmentsRequest()
      .then(setAdjustments)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCashBankAdjustmentRequest(deleteTarget.id);
      setAdjustments(prev => prev.filter(a => a.id !== deleteTarget.id));
      onLog('delete', 'cashBank', deleteTarget.reason, undefined, undefined, deleteTarget.reason);
      onAdjustmentsChanged();
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400">
        <ArrowLeft size={16} /> Back to Treasury
      </button>

      <div>
        <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-200">Cash &amp; Bank</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Full breakdown of where every rupee moved — opening balance, source by source, and any manual corrections.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-l-4 border-amber-500 dark:border-amber-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Closing Cash in Hand</h3>
            <Wallet className="text-amber-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-amber-600">₹{totals.closingCash.toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Opening ₹{totals.openingCash.toLocaleString()} + In ₹{totals.cashIn.toLocaleString()} − Out ₹{totals.cashOut.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-l-4 border-blue-500 dark:border-blue-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Closing Bank Balance</h3>
            <Landmark className="text-blue-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-blue-600">₹{totals.closingBank.toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Opening ₹{totals.openingBank.toLocaleString()} + In ₹{totals.bankIn.toLocaleString()} − Out ₹{totals.bankOut.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-4 sm:p-6 pb-3">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Breakdown by source</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Source</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Cash</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Bank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {totals.sources.map(s => (
                <tr key={s.key} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-3 text-sm text-gray-800 dark:text-gray-200 font-medium">{s.label}</td>
                  <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 text-right">₹{s.cash.toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 text-right">₹{s.bank.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 sm:p-6 pb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Manual adjustments</h3>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm whitespace-nowrap"
          >
            <Plus size={18} /> Add Adjustment
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Loading…</p>
        ) : adjustments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No manual adjustments yet — bank interest, ATM withdrawals, or corrections show up here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Bucket</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Reason</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">By</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {adjustments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{new Date(a.date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {a.bucket === 'cash' ? 'Cash in Hand' : 'Bank'}
                      {a.isTransfer && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400">
                          ↔ {a.bucket === 'cash' ? 'Bank' : 'Cash'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-800 dark:text-gray-200">{a.reason}</td>
                    <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{a.createdByName}</td>
                    <td className={`px-6 py-3 text-sm font-bold text-right ${a.direction === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                      {a.direction === 'add' ? '+' : '−'}₹{a.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="relative inline-block" ref={openRowMenuId === a.id ? rowMenuRef : undefined}>
                        <button
                          onClick={() => setOpenRowMenuId(o => (o === a.id ? null : a.id))}
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openRowMenuId === a.id && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                            <button onClick={() => { setOpenRowMenuId(null); setDeleteTarget(a); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <AdjustmentFormModal
          currentUser={currentUser}
          onCancel={() => setShowForm(false)}
          onSaved={(adj) => {
            setAdjustments(prev => [adj, ...prev]);
            onLog('create', 'cashBank', adj.reason, undefined, undefined, adj.reason);
            setShowForm(false);
            onAdjustmentsChanged();
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.reason}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function AdjustmentFormModal({
  currentUser, onCancel, onSaved,
}: {
  currentUser: User | null;
  onCancel: () => void;
  onSaved: (adjustment: CashBankAdjustment) => void;
}) {
  const [bucket, setBucket] = useState<CashBankBucket>('cash');
  const [direction, setDirection] = useState<CashBankDirection>('add');
  const [amount, setAmount] = useState('');
  const [isTransfer, setIsTransfer] = useState(true);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const otherBucketLabel = bucket === 'cash' ? 'Bank' : 'Cash in Hand';
  const thisBucketLabel = bucket === 'cash' ? 'Cash in Hand' : 'Bank';

  const handleSave = async () => {
    if (!currentUser) return;
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) { setError('Enter a valid amount.'); return; }
    if (!reason.trim()) { setError('Reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const adjustment = await createCashBankAdjustmentRequest({
        bucket, direction, amount: amountNum, isTransfer, reason: reason.trim(), date,
        createdByUserId: currentUser.id, createdByName: currentUser.name,
      });
      onSaved(adjustment);
    } catch (err: any) {
      setError(err?.message || 'Failed to save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Add Adjustment</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bucket</label>
              <select
                value={bucket}
                onChange={e => setBucket(e.target.value as CashBankBucket)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="cash">Cash in Hand</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Direction</label>
              <select
                value={direction}
                onChange={e => setDirection(e.target.value as CashBankDirection)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="add">Add</option>
                <option value="deduct">Deduct</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Amount (₹)</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
          <label className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer">
            <input
              type="checkbox"
              checked={isTransfer}
              onChange={e => setIsTransfer(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm">
              <span className="block font-medium text-gray-800 dark:text-gray-200">Transfer between Cash and Bank</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isTransfer
                  ? `The same ₹ will also ${direction === 'add' ? 'move out of' : 'be added to'} ${otherBucketLabel}, so ${thisBucketLabel} and ${otherBucketLabel} stay in balance (e.g. withdrawing cash from the bank).`
                  : `A one-sided correction — only ${thisBucketLabel} changes. Use this for a write-off or fixing a data-entry mistake, not an actual cash/bank movement.`}
              </span>
            </span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Bank interest credited"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
