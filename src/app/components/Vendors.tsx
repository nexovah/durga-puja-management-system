import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Pencil, Plus, X } from 'lucide-react';
import { Expense, getExpenseCreditAmount } from '../App';
import { Vendor, VendorInput, ActivityModule, ActivityFieldChange, listVendorsRequest, createVendorRequest, updateVendorRequest } from '../lib/db';
import { EXPENSE_CATEGORIES } from './Expenses';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { csvField } from '../lib/csv';
import { Pagination, usePagination } from './Pagination';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';

interface VendorsProps {
  expenses: Expense[];
  canEdit: boolean;
  onLog: (action: 'create' | 'update', module: ActivityModule, summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
}

interface VendorGroup {
  key: string;
  name: string;
  contact: string;
  directoryEntry: Vendor | null;
  entries: Expense[];
  totalAmount: number; // total actually credited/received (getExpenseCreditAmount sum)
  totalContractAmount: number; // total agreed/billed amount (raw exp.amount sum), regardless of payment status
  categories: string[];
}

interface PaymentRow {
  id: string;
  date: string;
  title: string;
  category: string;
  voucherNumber: string;
  amount: number;
  remarks: string;
}

// Partial-payment expenses store each installment's amount/date in
// parallel arrays — split those into one row per installment instead of
// one row per expense, so partial payments show up line by line like
// every other payment. Non-partial expenses stay a single row.
function paymentRowsFor(entries: Expense[]): PaymentRow[] {
  const rows: PaymentRow[] = [];
  for (const exp of entries) {
    const partials = exp.partialPayments || [];
    const hasPartials = exp.paymentStatus === 'partial' && partials.length > 0;
    if (hasPartials) {
      partials.forEach((payment, i) => {
        rows.push({
          id: `${exp.id}-${i}`,
          date: payment.date || exp.date,
          title: exp.title,
          category: exp.category,
          voucherNumber: payment.voucherNumber || exp.voucherNumber || '',
          amount: payment.amount,
          remarks: exp.remarks,
        });
      });
    } else {
      rows.push({
        id: exp.id,
        date: exp.date,
        title: exp.title,
        category: exp.category,
        voucherNumber: exp.voucherNumber || '',
        amount: getExpenseCreditAmount(exp),
        remarks: exp.remarks,
      });
    }
  }
  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Every expense that has a Vendor/Supplier Name attached (collected on the
// Expenses "Add New Expense" form) shows up here, merged one row per vendor
// Name — plus an explicit vendor directory (supabase/075_vendors.sql) that
// can be added/edited directly (name, company, phone, phone 01, address)
// without needing an expense to exist first. Expenses' own vendor fields
// stay untouched free text; the directory is just an optional, authoritative
// contact record layered on top by matching vendor name.
export function Vendors({ expenses, canEdit, onLog }: VendorsProps) {
  const { t, locale } = useLanguage();
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [directory, setDirectory] = useState<Vendor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VendorGroup | null>(null);

  useEffect(() => {
    listVendorsRequest().then(setDirectory).catch(() => {});
  }, []);

  const categoryLabel = (value: string) => {
    const key = `expenses.category.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };

  const vendorGroups = useMemo<VendorGroup[]>(() => {
    const withVendor = expenses.filter(exp => (exp.vendorName || '').trim() !== '');
    const groups = new Map<string, VendorGroup>();
    const directoryByName = new Map(directory.map(v => [v.name.trim().toLowerCase(), v]));

    for (const exp of withVendor) {
      const name = (exp.vendorName || '').trim();
      const key = name.toLowerCase();
      const directoryEntry = directoryByName.get(key) || null;

      if (!groups.has(key)) {
        const contact = directoryEntry?.phone || (exp.vendorContact || '').trim();
        groups.set(key, { key, name, contact, directoryEntry, entries: [], totalAmount: 0, totalContractAmount: 0, categories: [] });
      }
      const group = groups.get(key)!;
      group.entries.push(exp);
      group.totalAmount += getExpenseCreditAmount(exp);
      group.totalContractAmount += exp.amount;
      if (!group.categories.includes(exp.category)) group.categories.push(exp.category);
      if (directoryEntry?.category && !group.categories.includes(directoryEntry.category)) {
        group.categories.push(directoryEntry.category);
      }
    }

    // Directory-only vendors (added directly, no expense recorded yet).
    for (const v of directory) {
      const key = v.name.trim().toLowerCase();
      if (groups.has(key)) continue;
      groups.set(key, {
        key, name: v.name, contact: v.phone || '', directoryEntry: v,
        entries: [], totalAmount: 0, totalContractAmount: 0,
        categories: v.category ? [v.category] : [],
      });
    }

    return [...groups.values()]
      .map(g => ({
        ...g,
        entries: g.entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [expenses, directory]);

  const openCreateVendor = () => { setEditingGroup(null); setShowForm(true); };
  const openEditVendor = (group: VendorGroup) => { setEditingGroup(group); setShowForm(true); };

  const handleSaveVendor = async (input: VendorInput) => {
    if (editingGroup?.directoryEntry) {
      const updated = await updateVendorRequest(editingGroup.directoryEntry.id, input);
      setDirectory(prev => prev.map(v => (v.id === updated.id ? updated : v)));
      onLog('update', 'vendors', input.name, undefined, undefined, input.name);
    } else {
      const created = await createVendorRequest(input);
      setDirectory(prev => [...prev, created]);
      onLog('create', 'vendors', input.name, undefined, undefined, input.name);
    }
    setShowForm(false);
    setEditingGroup(null);
  };

  const viewingVendor = vendorGroups.find(g => g.key === viewingKey) || null;
  const viewingVendorPaymentRows = viewingVendor ? paymentRowsFor(viewingVendor.entries) : [];

  const filteredVendorGroups = vendorGroups.filter(g => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [g.name, g.contact].some(p => p && p.toLowerCase().includes(q));
      if (!inText) return false;
    }
    const f = appliedFilters;
    if (f.amountMin && g.totalAmount < parseFloat(f.amountMin)) return false;
    if (f.amountMax && g.totalAmount > parseFloat(f.amountMax)) return false;
    if (f.phone && !(g.contact || '').includes(f.phone.trim())) return false;
    return true;
  });

  const pagination = usePagination(filteredVendorGroups);

  const handleExport = () => {
    const csvContent = [
      [
        t('vendors.name'),
        t('vendors.contact'),
        t('expenses.category'),
        t('vendors.transactions'),
        t('vendors.totalAmount'),
      ].map(csvField).join(','),
      ...vendorGroups.map(g => [
        g.name,
        g.contact,
        g.categories.map(categoryLabel).join(' / '),
        g.entries.length,
        g.totalAmount,
      ].map(csvField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendors-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            <button
              onClick={handleExport}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold"
            >
              <Download size={20} />
              {t('common.export')}
            </button>
            {canEdit && (
              <button
                onClick={openCreateVendor}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} /> {t('vendors.addVendor')}
              </button>
            )}
          </div>
        }
      >
        {t('vendors.pageTitle')}
      </PageHeading>

      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4">{t('vendors.hint')}</p>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('vendors.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredVendorGroups.length}
          totalCount={vendorGroups.length}
          showAmount
          showPhone
        />
      </CollapsibleSearchPanel>

      {/* Vendor detail panel */}
      {viewingVendor && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{viewingVendor.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{viewingVendor.contact || '-'}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {viewingVendor.categories.map(cat => (
                  <span key={cat} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    {categoryLabel(cat)}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => setViewingKey(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.totalContractAmount')}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">₹{viewingVendor.totalContractAmount.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.totalAmount')}</p>
              <p className="text-2xl font-bold text-green-600">₹{viewingVendor.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.pendingAmount')}</p>
              <p className="text-2xl font-bold text-yellow-600">
                ₹{Math.max(0, viewingVendor.totalContractAmount - viewingVendor.totalAmount).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.transactions')}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{viewingVendorPaymentRows.length}</p>
            </div>
          </div>

          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">{t('vendors.paymentHistory')}</h4>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('common.date')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('expenses.title')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('expenses.category')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('expenses.voucherNumber')}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">{t('common.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {viewingVendorPaymentRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">{row.title}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{categoryLabel(row.category)}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{row.voucherNumber || '-'}</td>
                    <td className="px-4 py-2 text-sm text-green-600 font-bold text-right">
                      ₹{row.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('vendors.name')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('vendors.contact')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('expenses.category')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('vendors.transactions')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('vendors.totalAmount')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((g) => (
                <tr key={g.key} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${viewingKey === g.key ? 'bg-orange-50 dark:bg-orange-500/10' : ''}`}>
                  <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200 font-medium">{g.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{g.contact || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {g.categories.map(cat => (
                        <span key={cat} className="px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          {categoryLabel(cat)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 text-right">{g.entries.length}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold text-right">₹{g.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setViewingKey(viewingKey === g.key ? null : g.key)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                        title={t('vendors.view')}
                      >
                        <Eye size={18} />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => openEditVendor(g)}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title={t('common.edit')}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendorGroups.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('vendors.empty')}
            </div>
          )}
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.setPageSize}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
        />
      </div>

      {showForm && (
        <VendorFormModal
          group={editingGroup}
          onCancel={() => { setShowForm(false); setEditingGroup(null); }}
          onSave={handleSaveVendor}
        />
      )}
    </div>
  );
}

function VendorFormModal({
  group, onCancel, onSave,
}: {
  group: VendorGroup | null;
  onCancel: () => void;
  onSave: (input: VendorInput) => Promise<void>;
}) {
  const { t } = useLanguage();
  const entry = group?.directoryEntry || null;
  const [name, setName] = useState(entry?.name || group?.name || '');
  const [companyName, setCompanyName] = useState(entry?.companyName || '');
  const [phone, setPhone] = useState(entry?.phone || group?.contact || '');
  const [phone2, setPhone2] = useState(entry?.phone2 || '');
  const [address, setAddress] = useState(entry?.address || '');
  const [category, setCategory] = useState(entry?.category || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError(t('vendors.nameRequired')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), companyName, phone, phone2, address, category: category || null });
    } catch (err: any) {
      setError(err?.message || 'Failed to save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            {group ? t('vendors.editVendor') : t('vendors.addVendor')}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.name')} *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('vendors.name')}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.companyName')}</label>
            <input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.category')}</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            >
              <option value="">{t('search.any')}</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('expenses.vendorContact')}</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('expenses.vendorContact2')}</label>
              <input
                type="tel"
                value={phone2}
                onChange={e => setPhone2(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.address')}</label>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {saving ? '...' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
