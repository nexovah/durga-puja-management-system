import { useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Download, Upload, HandCoins, Sparkles, Flame, IndianRupee } from 'lucide-react';
import { Chanda, PaymentStatus, PaidMethod, getChandaCreditAmount } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey, translations } from '../i18n/translations';
import { parseCSV, csvField } from '../lib/csv';
import { Pagination, usePagination } from './Pagination';
import { normalizeKey, prepareImportUpsert } from '../lib/uniqueCheck';
import { ImportPreviewModal, ImportRowError } from './ImportPreviewModal';
import { FormModal } from './FormModal';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { StatusChangeConfirmModal } from './StatusChangeConfirmModal';
import { ViewModal } from './ViewModal';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';

interface ChandaCollectionProps {
  chandaList: Chanda[];
  setChandaList: (chandaList: Chanda[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'chanda', summary: string, count?: number) => void;
}

const PAYMENT_STATUSES: { value: PaymentStatus; labelKey: TranslationKey }[] = [
  { value: 'paid', labelKey: 'chanda.status.paid' },
  { value: 'pending', labelKey: 'chanda.status.pending' },
  { value: 'partial', labelKey: 'chanda.status.partial' },
  { value: 'rejected', labelKey: 'chanda.status.rejected' },
];

const PAID_METHODS: { value: PaidMethod; labelKey: TranslationKey }[] = [
  { value: 'notSelected', labelKey: 'common.paidMethod.notSelected' },
  { value: 'cash', labelKey: 'common.paidMethod.cash' },
  { value: 'qrScan', labelKey: 'common.paidMethod.qrScan' },
  { value: 'onlineBanking', labelKey: 'common.paidMethod.onlineBanking' },
  { value: 'check', labelKey: 'common.paidMethod.check' },
];

const STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
};

// Simple case-insensitive "does any of these fields contain q" check, used
// by the page's own search bar.
const matches = (parts: (string | number | undefined | null)[], q: string) =>
  parts.some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));

const emptyForm = {
  donorName: '',
  amount: '',
  amount1: '',
  amount2: '',
  paidMethod: 'notSelected' as PaidMethod,
  paymentStatus: 'paid' as PaymentStatus,
  partialAmount: '',
  date: new Date().toISOString().split('T')[0],
  billNumber: '',
  phone: '',
  phone2: '',
  remarks: '',
};

export function ChandaCollection({ chandaList, setChandaList, canEdit, canDelete, canBulkImport, onLog }: ChandaCollectionProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ toInsert: Chanda[]; toUpdate: Chanda[]; errors: ImportRowError[]; totalRows: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Chanda | null>(null);
  const [viewTarget, setViewTarget] = useState<Chanda | null>(null);
  const [pendingSave, setPendingSave] = useState<{ payload: Omit<Chanda, 'id'>; saveAndAddNew: boolean } | null>(null);

  const totalChanda = chandaList.reduce((sum, chanda) => sum + getChandaCreditAmount(chanda), 0);

  // Amount still owed by donors: full amount for 'pending', the unpaid
  // remainder for 'partial'. 'rejected' is excluded (donor declined to pay).
  const pendingCollection = chandaList.reduce((sum, chanda) => {
    if (chanda.paymentStatus === 'pending') return sum + chanda.amount;
    if (chanda.paymentStatus === 'partial') return sum + Math.max(0, chanda.amount - (chanda.partialAmount || 0));
    return sum;
  }, 0);
  const totalAmount1 = chandaList.reduce((sum, chanda) => sum + (chanda.amount1 || 0), 0);
  const totalAmount2 = chandaList.reduce((sum, chanda) => sum + (chanda.amount2 || 0), 0);

  const statusLabel = (status: PaymentStatus) => {
    const found = PAYMENT_STATUSES.find(s => s.value === status);
    return found ? t(found.labelKey) : status;
  };

  // Accept a payment status from a CSV in any supported language, or its canonical key.
  const normalize = (s: string) => s.trim().toLowerCase();
  const parseStatusInput = (raw: string): PaymentStatus => {
    const value = normalize(raw || '');
    const byValue = PAYMENT_STATUSES.find(s => normalize(s.value) === value);
    if (byValue) return byValue.value;
    for (const status of PAYMENT_STATUSES) {
      for (const lang of Object.values(translations)) {
        if (normalize(lang[status.labelKey]) === value) return status.value;
      }
    }
    return 'paid';
  };

  const paidMethodLabel = (method: PaidMethod) => {
    const found = PAID_METHODS.find(m => m.value === method);
    return found ? t(found.labelKey) : method;
  };

  const parsePaidMethodInput = (raw: string): PaidMethod => {
    const value = normalize(raw || '');
    const byValue = PAID_METHODS.find(m => normalize(m.value) === value);
    if (byValue) return byValue.value;
    for (const method of PAID_METHODS) {
      for (const lang of Object.values(translations)) {
        if (normalize(lang[method.labelKey]) === value) return method.value;
      }
    }
    return 'notSelected';
  };

  // Amount 01 / Amount 02 are an optional breakdown of the main Amount field.
  // Leaving both blank lets Amount work as a single freely-typed value;
  // filling either one makes Amount always reflect their sum.
  const handleSubAmountChange = (field: 'amount1' | 'amount2', value: string) => {
    const next = { ...formData, [field]: value };
    const a1 = field === 'amount1' ? value : formData.amount1;
    const a2 = field === 'amount2' ? value : formData.amount2;
    if (a1.trim() !== '' || a2.trim() !== '') {
      next.amount = ((parseFloat(a1) || 0) + (parseFloat(a2) || 0)).toString();
    }
    setFormData(next);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const saveAndAddNew = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'andNew';

    const billKey = normalizeKey(formData.billNumber);
    if (billKey) {
      const isDuplicate = chandaList.some(c => c.id !== editingId && normalizeKey(c.billNumber) === billKey);
      if (isDuplicate) {
        alert(t('chanda.billNumberDuplicate'));
        return;
      }
    }

    const payload = {
      donorName: formData.donorName,
      amount: parseFloat(formData.amount),
      amount1: formData.amount1.trim() !== '' ? parseFloat(formData.amount1) : undefined,
      amount2: formData.amount2.trim() !== '' ? parseFloat(formData.amount2) : undefined,
      paidMethod: formData.paidMethod,
      paymentStatus: formData.paymentStatus,
      partialAmount: formData.paymentStatus === 'partial' ? parseFloat(formData.partialAmount || '0') : undefined,
      date: formData.date,
      billNumber: formData.billNumber,
      phone: formData.phone,
      phone2: formData.phone2,
      remarks: formData.remarks,
    };

    // Editing a record that's already Paid — whether changing its status
    // away from Paid, or changing any other field (amount, date, donor
    // name, ...) on a record already recorded as paid — requires the same
    // PIN confirmation as a delete, since Paid means money already
    // changed hands.
    if (editingId) {
      const original = chandaList.find(c => c.id === editingId);
      if (original?.paymentStatus === 'paid') {
        setPendingSave({ payload, saveAndAddNew });
        return;
      }
    }

    commitSave(payload, saveAndAddNew);
  };

  const commitSave = (payload: Omit<Chanda, 'id'>, saveAndAddNew: boolean) => {
    if (editingId) {
      // Edit existing chanda
      setChandaList(chandaList.map(c =>
        c.id === editingId
          ? { ...c, ...payload }
          : c
      ));
      onLog('update', 'chanda', `${payload.donorName} — ₹${payload.amount.toLocaleString()}`);
      setToastMessage(t('common.updatedSuccess'));
    } else {
      // Add new chanda
      const newChanda: Chanda = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setChandaList([...chandaList, newChanda]);
      onLog('create', 'chanda', `${payload.donorName} — ₹${payload.amount.toLocaleString()}`);
      setToastMessage(t('common.savedSuccess'));
    }

    const wasEditing = editingId;
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(saveAndAddNew && !wasEditing);
  };

  const confirmStatusChange = () => {
    if (!pendingSave) return;
    commitSave(pendingSave.payload, pendingSave.saveAndAddNew);
    setPendingSave(null);
  };

  const handleEdit = (chanda: Chanda) => {
    setFormData({
      donorName: chanda.donorName,
      amount: chanda.amount.toString(),
      amount1: chanda.amount1 !== undefined ? chanda.amount1.toString() : '',
      amount2: chanda.amount2 !== undefined ? chanda.amount2.toString() : '',
      paidMethod: chanda.paidMethod || 'notSelected',
      paymentStatus: chanda.paymentStatus || 'paid',
      partialAmount: chanda.partialAmount !== undefined ? chanda.partialAmount.toString() : '',
      date: chanda.date,
      billNumber: chanda.billNumber || '',
      phone: chanda.phone,
      phone2: chanda.phone2 || '',
      remarks: chanda.remarks,
    });
    setEditingId(chanda.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const target = chandaList.find(c => c.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setChandaList(chandaList.filter(c => c.id !== deleteTarget.id));
    onLog('delete', 'chanda', `${deleteTarget.donorName} — ₹${deleteTarget.amount.toLocaleString()}`);
    setDeleteTarget(null);
    setToastMessage(t('common.deletedSuccess'));
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleExport = () => {
    const csvContent = [
      [
        t('chanda.csv.donorName'),
        t('chanda.csv.amount'),
        t('chanda.csv.amount1'),
        t('chanda.csv.amount2'),
        t('common.paidMethod'),
        t('chanda.csv.status'),
        t('chanda.csv.partialAmount'),
        t('chanda.csv.date'),
        t('chanda.csv.billNumber'),
        t('chanda.csv.phone'),
        t('chanda.csv.phone2'),
        t('chanda.csv.remarks'),
      ].map(csvField).join(','),
      ...chandaList.map(c => [
        c.donorName,
        c.amount,
        c.amount1 ?? '',
        c.amount2 ?? '',
        paidMethodLabel(c.paidMethod || 'notSelected'),
        statusLabel(c.paymentStatus || 'paid'),
        c.paymentStatus === 'partial' ? (c.partialAmount || 0) : '',
        c.date,
        c.billNumber || '',
        c.phone,
        c.phone2 || '',
        c.remarks,
      ].map(csvField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chanda-collection-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result || ''));
      if (rows.length === 0) return;

      // Skip a header row if the first cell isn't a positive number (amount column)
      const firstDataRow = /^\s*-?\d+(\.\d+)?\s*$/.test(rows[0][1] || '') ? 0 : 1;

      const imported: Chanda[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const [donorName, amountRaw, amount1Raw, amount2Raw, paidMethodRaw, statusRaw, partialAmountRaw, date, billNumber, phone, phone2, remarks] = rows[i];
        const amount = parseFloat((amountRaw || '').replace(/,/g, ''));
        if (!donorName || isNaN(amount)) continue;

        const paymentStatus = parseStatusInput(statusRaw || '');
        const partialAmount = paymentStatus === 'partial'
          ? parseFloat((partialAmountRaw || '0').replace(/,/g, '')) || 0
          : undefined;
        const amount1 = (amount1Raw || '').trim() !== '' ? parseFloat((amount1Raw || '').replace(/,/g, '')) : undefined;
        const amount2 = (amount2Raw || '').trim() !== '' ? parseFloat((amount2Raw || '').replace(/,/g, '')) : undefined;

        imported.push({
          id: crypto.randomUUID(),
          donorName: donorName.trim(),
          amount,
          amount1,
          amount2,
          paidMethod: parsePaidMethodInput(paidMethodRaw || ''),
          paymentStatus,
          partialAmount,
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          billNumber: (billNumber || '').trim(),
          phone: (phone || '').trim(),
          phone2: (phone2 || '').trim(),
          remarks: (remarks || '').trim(),
        });
      }

      const { toInsert, toUpdate } = prepareImportUpsert(imported, (row) => row.billNumber, chandaList);
      setImportPreview({ toInsert, toUpdate, errors: [], totalRows: imported.length });
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const { toInsert, toUpdate } = importPreview;
    const updatedIds = new Set(toUpdate.map(r => r.id));
    const merged = chandaList.map(c => (updatedIds.has(c.id) ? toUpdate.find(u => u.id === c.id)! : c));
    setChandaList([...merged, ...toInsert]);
    const count = toInsert.length + toUpdate.length;
    onLog('bulk_import', 'chanda', `${t('common.importResult')}: ${count} (${toInsert.length} new, ${toUpdate.length} updated)`, count);
    setImportPreview(null);
  };

  const isPartial = formData.paymentStatus === 'partial';

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const filteredChanda = chandaList.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    if (q && !matches([c.donorName, c.phone, c.phone2, c.remarks, c.billNumber, c.amount], q)) return false;

    const f = appliedFilters;
    if (f.amountMin && c.amount < parseFloat(f.amountMin)) return false;
    if (f.amountMax && c.amount > parseFloat(f.amountMax)) return false;
    if (f.billVoucher && !normalizeKey(c.billNumber).includes(f.billVoucher.trim().toLowerCase())) return false;
    if (f.status && c.paymentStatus !== f.status) return false;
    if (f.paidMethod && c.paidMethod !== f.paidMethod) return false;
    if (f.phone && !(c.phone || '').includes(f.phone.trim()) && !(c.phone2 || '').includes(f.phone.trim())) return false;
    if (f.dateFrom && new Date(c.date).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(c.date).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  const sortedChanda = [...filteredChanda].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const pagination = usePagination(sortedChanda);

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            {canEdit && canBulkImport && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  onClick={handleImportClick}
                  className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
                >
                  <Upload size={20} />
                  {t('common.import')}
                </button>
              </>
            )}
            <button
              onClick={handleExport}
              className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
            >
              <Download size={20} />
              {t('common.export')}
            </button>
            {canEdit && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} />
                {t('chanda.addNew')}
              </button>
            )}
          </div>
        }
      >
        {t('chanda.pageTitle')}
      </PageHeading>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('chanda.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredChanda.length}
          totalCount={chandaList.length}
          showAmount
          showBillVoucher
          billVoucherLabel={t('chanda.billNumber')}
          statusOptions={PAYMENT_STATUSES.map(s => ({ value: s.value, label: t(s.labelKey) }))}
          paidMethodOptions={PAID_METHODS.filter(m => m.value !== 'notSelected').map(m => ({ value: m.value, label: t(m.labelKey) }))}
          showDateRange
          showPhone
        />
      </CollapsibleSearchPanel>

      {/* Form */}
      <FormModal
        open={canEdit && showForm}
        title={editingId ? t('chanda.editChanda') : t('chanda.addNew')}
        onClose={handleCancel}
        footer={
          <>
            <button
              type="submit"
              form="chanda-form"
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              {editingId ? t('common.update') : t('common.add')}
            </button>
            {!editingId && (
              <button
                type="submit"
                form="chanda-form"
                value="andNew"
                className="px-6 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium"
              >
                {t('common.saveAndAddNew')}
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              {t('common.cancel')}
            </button>
          </>
        }
      >
          <form id="chanda-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.donorName')} *</label>
              <input
                type="text"
                required
                value={formData.donorName}
                onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.donorNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.amountLabel')} *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.amountPlaceholder')}
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.amount1Label')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount1}
                  onChange={(e) => handleSubAmountChange('amount1', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.amountPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.amount2Label')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount2}
                  onChange={(e) => handleSubAmountChange('amount2', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.amountPlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.paidMethod')}</label>
              <select
                value={formData.paidMethod}
                onChange={(e) => setFormData({ ...formData, paidMethod: e.target.value as PaidMethod })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAID_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.paymentStatus')} *</label>
              <select
                required
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as PaymentStatus })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
            </div>

            {isPartial && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.partialAmountLabel')} *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  max={formData.amount || undefined}
                  value={formData.partialAmount}
                  onChange={(e) => setFormData({ ...formData, partialAmount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.partialAmountPlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.date')} *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.billNumber')}</label>
              <input
                type="text"
                value={formData.billNumber}
                onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.billNumberPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.phone1')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.phonePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.phone2')}</label>
              <input
                type="tel"
                value={formData.phone2}
                onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.phonePlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.remarksPlaceholder')}
                rows={2}
              />
            </div>
          </form>
      </FormModal>

      {/* Widgets — Treasury-style summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-green-500 dark:border-green-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('chanda.widget.total')}</h3>
            <IndianRupee className="text-green-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{totalChanda.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-amber-500 dark:border-amber-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('chanda.widget.pending')}</h3>
            <HandCoins className="text-amber-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-600">₹{pendingCollection.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-orange-500 dark:border-orange-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('chanda.widget.amount1')}</h3>
            <Sparkles className="text-orange-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">₹{totalAmount1.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-red-500 dark:border-red-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('chanda.widget.amount2')}</h3>
            <Flame className="text-red-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-600">₹{totalAmount2.toLocaleString()}</p>
        </div>
      </div>

      {/* Chanda List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('chanda.donorName')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.amount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.paidMethod')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('chanda.paymentStatus')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('chanda.billNumber')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.phone1')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.phone2')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.remarks')}</th>
                {(canEdit || canDelete) && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((chanda) => {
                const status = chanda.paymentStatus || 'paid';
                return (
                  <tr key={chanda.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => setViewTarget(chanda)}
                        className="text-orange-600 hover:text-orange-700 hover:underline text-left"
                      >
                        {chanda.donorName}
                      </button>
                    </td>
                    <td className={`px-6 py-4 text-sm font-bold ${
                      status === 'rejected'
                        ? 'text-red-600 line-through'
                        : status === 'partial'
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}>₹{chanda.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{paidMethodLabel(chanda.paidMethod || 'notSelected')}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                        {statusLabel(status)}
                      </span>
                      {status === 'partial' && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ₹{(chanda.partialAmount || 0).toLocaleString()} / ₹{chanda.amount.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(chanda.date).toLocaleDateString(locale)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chanda.billNumber || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chanda.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chanda.phone2 || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chanda.remarks || '-'}</td>
                    {(canEdit || canDelete) && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(chanda)}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(chanda.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {filteredChanda.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">{t('common.total')}</td>
                  <td className="px-6 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                    ₹{filteredChanda.reduce((sum, c) => sum + getChandaCreditAmount(c), 0).toLocaleString()}
                  </td>
                  <td colSpan={100} />
                </tr>
              </tfoot>
            )}
          </table>
          {chandaList.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('chanda.empty')}
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

      <ImportPreviewModal
        open={!!importPreview}
        title={t('import.preview.title')}
        totalRows={importPreview?.totalRows || 0}
        insertCount={importPreview?.toInsert.length || 0}
        updateCount={importPreview?.toUpdate.length || 0}
        errors={importPreview?.errors || []}
        onCancel={() => setImportPreview(null)}
        onConfirm={handleConfirmImport}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      <ViewModal
        open={!!viewTarget}
        title={viewTarget?.donorName || ''}
        onClose={() => setViewTarget(null)}
        onEdit={canEdit && viewTarget ? () => { const c = viewTarget; setViewTarget(null); handleEdit(c); } : undefined}
        fields={viewTarget ? [
          { label: t('chanda.donorName'), value: viewTarget.donorName },
          {
            label: t('chanda.amountLabel'),
            value: `₹${viewTarget.amount.toLocaleString()}`,
            valueClassName: `font-bold ${
              (viewTarget.paymentStatus || 'paid') === 'rejected'
                ? 'text-red-600 line-through'
                : (viewTarget.paymentStatus || 'paid') === 'partial'
                ? 'text-yellow-600'
                : 'text-green-600'
            }`,
          },
          { label: t('common.paidMethod'), value: paidMethodLabel(viewTarget.paidMethod || 'notSelected') },
          {
            label: t('chanda.paymentStatus'),
            value: (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[viewTarget.paymentStatus || 'paid']}`}>
                {statusLabel(viewTarget.paymentStatus || 'paid')}
              </span>
            ),
          },
          ...(viewTarget.paymentStatus === 'partial' ? [{
            label: t('chanda.partialAmountLabel'),
            value: `₹${(viewTarget.partialAmount || 0).toLocaleString()} / ₹${viewTarget.amount.toLocaleString()}`,
          }] : []),
          { label: t('common.date'), value: new Date(viewTarget.date).toLocaleDateString(locale) },
          { label: t('chanda.billNumber'), value: viewTarget.billNumber || '-' },
          { label: t('common.phone1'), value: viewTarget.phone || '-' },
          { label: t('common.phone2'), value: viewTarget.phone2 || '-' },
          { label: t('common.remarks'), value: viewTarget.remarks || '-', fullWidth: true },
        ] : []}
      />
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.donorName}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <StatusChangeConfirmModal
        open={!!pendingSave}
        itemLabel={pendingSave?.payload.donorName}
        fromStatusLabel={statusLabel('paid')}
        toStatusLabel={pendingSave ? statusLabel(pendingSave.payload.paymentStatus) : ''}
        messageOverride={pendingSave && pendingSave.payload.paymentStatus === 'paid' ? t('statusChange.confirmMessageEditPaid') : undefined}
        onCancel={() => setPendingSave(null)}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
