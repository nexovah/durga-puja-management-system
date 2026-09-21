import { useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Download, Upload } from 'lucide-react';
import { Expense, ExpensePaymentStatus, PaidThrough, getExpenseCreditAmount } from '../App';
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

interface ExpensesProps {
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'expenses', summary: string, count?: number) => void;
}

const categories: { value: string; labelKey: TranslationKey }[] = [
  { value: 'construction', labelKey: 'expenses.category.construction' },
  { value: 'decoration', labelKey: 'expenses.category.decoration' },
  { value: 'idol', labelKey: 'expenses.category.idol' },
  { value: 'pujaRituals', labelKey: 'expenses.category.pujaRituals' },
  { value: 'lighting', labelKey: 'expenses.category.lighting' },
  { value: 'electricityGenerator', labelKey: 'expenses.category.electricityGenerator' },
  { value: 'soundAudio', labelKey: 'expenses.category.soundAudio' },
  { value: 'food', labelKey: 'expenses.category.food' }, // label updated to "Food & Bhog" — value kept as-is so existing records still match
  { value: 'culturalProgramme', labelKey: 'expenses.category.culturalProgramme' },
  { value: 'publicity', labelKey: 'expenses.category.publicity' },
  { value: 'printingStationery', labelKey: 'expenses.category.printingStationery' },
  { value: 'security', labelKey: 'expenses.category.security' },
  { value: 'volunteerStaff', labelKey: 'expenses.category.volunteerStaff' },
  { value: 'sanitationCleaning', labelKey: 'expenses.category.sanitationCleaning' },
  { value: 'medicalFirstAid', labelKey: 'expenses.category.medicalFirstAid' },
  { value: 'transport', labelKey: 'expenses.category.transport' }, // label updated to "Transport & Immersion" — value kept as-is so existing records still match
  { value: 'permissionsGovtFees', labelKey: 'expenses.category.permissionsGovtFees' },
  { value: 'insuranceSafety', labelKey: 'expenses.category.insuranceSafety' },
  { value: 'other', labelKey: 'expenses.category.other' },
];

const PAYMENT_STATUSES: { value: ExpensePaymentStatus; labelKey: TranslationKey }[] = [
  { value: 'paid', labelKey: 'expenses.status.paid' },
  { value: 'partial', labelKey: 'expenses.status.partial' },
  { value: 'cancelled', labelKey: 'expenses.status.cancelled' },
];

const PAID_THROUGH_OPTIONS: { value: PaidThrough; labelKey: TranslationKey }[] = [
  { value: 'notSelected', labelKey: 'expenses.paidThrough.notSelected' },
  { value: 'cash', labelKey: 'expenses.paidThrough.cash' },
  { value: 'check', labelKey: 'expenses.paidThrough.check' },
];

const PARTIAL_LABEL_KEYS: TranslationKey[] = [
  'expenses.partialAmount1',
  'expenses.partialAmount2',
  'expenses.partialAmount3',
  'expenses.partialAmount4',
  'expenses.partialAmount5',
];

const STATUS_BADGE_CLASS: Record<ExpensePaymentStatus, string> = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const emptyForm = {
  title: '',
  amount: '',
  paymentStatus: 'paid' as ExpensePaymentStatus,
  partialAmounts: ['', '', '', '', ''],
  partialDates: ['', '', '', '', ''],
  paidThrough: 'notSelected' as PaidThrough,
  date: new Date().toISOString().split('T')[0],
  category: '',
  voucherNumber: '',
  vendorName: '',
  vendorContact: '',
  remarks: '',
};

export function Expenses({ expenses, setExpenses, canEdit, canDelete, canBulkImport, onLog }: ExpensesProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ toInsert: Expense[]; toUpdate: Expense[]; errors: ImportRowError[]; totalRows: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [viewTarget, setViewTarget] = useState<Expense | null>(null);
  const [pendingSave, setPendingSave] = useState<{ payload: Omit<Expense, 'id'>; saveAndAddNew: boolean } | null>(null);

  const categoryLabel = (value: string) => {
    const found = categories.find(c => c.value === value);
    return found ? t(found.labelKey) : value;
  };

  const statusLabel = (status: ExpensePaymentStatus) => {
    const found = PAYMENT_STATUSES.find(s => s.value === status);
    return found ? t(found.labelKey) : status;
  };

  const paidThroughLabel = (method: PaidThrough) => {
    const found = PAID_THROUGH_OPTIONS.find(m => m.value === method);
    return found ? t(found.labelKey) : method;
  };

  // Accept status/paid-through values from a CSV in any supported language, or their canonical keys.
  const normalize = (s: string) => s.trim().toLowerCase();

  const parseStatusInput = (raw: string): ExpensePaymentStatus => {
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

  const parsePaidThroughInput = (raw: string): PaidThrough => {
    const value = normalize(raw || '');
    const byValue = PAID_THROUGH_OPTIONS.find(m => normalize(m.value) === value);
    if (byValue) return byValue.value;
    for (const method of PAID_THROUGH_OPTIONS) {
      for (const lang of Object.values(translations)) {
        if (normalize(lang[method.labelKey]) === value) return method.value;
      }
    }
    return 'notSelected';
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + getExpenseCreditAmount(expense), 0);

  const isPartial = formData.paymentStatus === 'partial';

  const partialSumFromForm = () =>
    formData.partialAmounts.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const saveAndAddNew = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'andNew';

    const amount = parseFloat(formData.amount) || 0;
    const partialAmounts = formData.partialAmounts.map(v => (v.trim() === '' ? undefined : parseFloat(v) || 0));
    const partialDates = formData.partialDates.map(v => (v.trim() === '' ? undefined : v));
    const partialSum = partialAmounts.reduce((sum: number, v) => sum + (v || 0), 0);

    if (formData.paymentStatus === 'partial' && partialSum > amount) {
      alert(
        t('expenses.partialExceedsAmount')
          .replace('{sum}', partialSum.toLocaleString())
          .replace('{amount}', amount.toLocaleString())
      );
      return;
    }

    const voucherKey = normalizeKey(formData.voucherNumber);
    if (voucherKey) {
      const isDuplicate = expenses.some(exp => exp.id !== editingId && normalizeKey(exp.voucherNumber) === voucherKey);
      if (isDuplicate) {
        alert(t('expenses.voucherNumberDuplicate'));
        return;
      }
    }

    const payload = {
      title: formData.title,
      amount,
      paymentStatus: formData.paymentStatus,
      partialAmounts: formData.paymentStatus === 'partial' ? partialAmounts : undefined,
      partialDates: formData.paymentStatus === 'partial' ? partialDates : undefined,
      paidThrough: formData.paidThrough,
      date: formData.date,
      category: formData.category,
      voucherNumber: formData.voucherNumber,
      vendorName: formData.vendorName,
      vendorContact: formData.vendorContact,
      remarks: formData.remarks,
    };

    if (editingId) {
      const original = expenses.find(exp => exp.id === editingId);
      if (original?.paymentStatus === 'paid' && payload.paymentStatus !== 'paid') {
        setPendingSave({ payload, saveAndAddNew });
        return;
      }
    }

    commitSave(payload, saveAndAddNew);
  };

  const commitSave = (payload: Omit<Expense, 'id'>, saveAndAddNew: boolean) => {
    if (editingId) {
      // Edit existing expense
      setExpenses(expenses.map(exp =>
        exp.id === editingId
          ? { ...exp, ...payload }
          : exp
      ));
      onLog('update', 'expenses', `${payload.title} — ₹${payload.amount.toLocaleString()}`);
      setToastMessage(t('common.updatedSuccess'));
    } else {
      // Add new expense
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setExpenses([...expenses, newExpense]);
      onLog('create', 'expenses', `${payload.title} — ₹${payload.amount.toLocaleString()}`);
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

  const handleEdit = (expense: Expense) => {
    const partials = expense.partialAmounts || [];
    const partialDates = expense.partialDates || [];
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      paymentStatus: expense.paymentStatus || 'paid',
      partialAmounts: [0, 1, 2, 3, 4].map(i => (partials[i] !== undefined ? String(partials[i]) : '')),
      partialDates: [0, 1, 2, 3, 4].map(i => partialDates[i] || ''),
      paidThrough: expense.paidThrough || 'notSelected',
      date: expense.date,
      category: expense.category,
      voucherNumber: expense.voucherNumber || '',
      vendorName: expense.vendorName || '',
      vendorContact: expense.vendorContact || '',
      remarks: expense.remarks,
    });
    setEditingId(expense.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const target = expenses.find(exp => exp.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setExpenses(expenses.filter(exp => exp.id !== deleteTarget.id));
    onLog('delete', 'expenses', `${deleteTarget.title} — ₹${deleteTarget.amount.toLocaleString()}`);
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
        t('expenses.csv.title'),
        t('expenses.csv.amount'),
        t('expenses.csv.status'),
        t('expenses.partialAmount1'),
        t('expenses.partialAmount2'),
        t('expenses.partialAmount3'),
        t('expenses.partialAmount4'),
        t('expenses.partialAmount5'),
        t('expenses.csv.paidThrough'),
        t('expenses.csv.date'),
        t('expenses.csv.category'),
        t('expenses.csv.remarks'),
      ].map(csvField).join(','),
      ...expenses.map(exp => [
        exp.title,
        exp.amount,
        statusLabel(exp.paymentStatus || 'paid'),
        exp.partialAmounts?.[0] ?? '',
        exp.partialAmounts?.[1] ?? '',
        exp.partialAmounts?.[2] ?? '',
        exp.partialAmounts?.[3] ?? '',
        exp.partialAmounts?.[4] ?? '',
        paidThroughLabel(exp.paidThrough || 'notSelected'),
        exp.date,
        categoryLabel(exp.category),
        exp.remarks,
      ].map(csvField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
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

      // Skip a header row if the amount column (index 1) isn't numeric
      const firstDataRow = /^\s*-?\d+(\.\d+)?\s*$/.test(rows[0][1] || '') ? 0 : 1;

      const imported: Expense[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const [
          title, amountRaw, statusRaw,
          p1, p2, p3, p4, p5,
          paidThroughRaw, date, categoryRaw, remarks,
        ] = rows[i];
        const amount = parseFloat((amountRaw || '').replace(/,/g, ''));
        if (!title || isNaN(amount)) continue;

        const paymentStatus = parseStatusInput(statusRaw || '');
        const parsedPartials = [p1, p2, p3, p4, p5].map(v =>
          (v || '').trim() === '' ? undefined : parseFloat((v || '').replace(/,/g, '')) || 0
        );
        const hasAnyPartial = parsedPartials.some(v => v !== undefined);

        const categoryRawTrim = (categoryRaw || '').trim();
        const category = categories.find(c => c.value === categoryRawTrim)
          || categories.find(c => Object.values(translations).some(lang => normalize(lang[c.labelKey]) === normalize(categoryRawTrim)));

        imported.push({
          id: crypto.randomUUID(),
          title: title.trim(),
          amount,
          paymentStatus,
          partialAmounts: paymentStatus === 'partial' && hasAnyPartial ? parsedPartials : undefined,
          paidThrough: parsePaidThroughInput(paidThroughRaw || ''),
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          category: category ? category.value : categoryRawTrim,
          remarks: (remarks || '').trim(),
        });
      }

      // Note: voucherNumber isn't a column in this CSV format, so every
      // imported row is always new — nothing to match against for updates.
      const { toInsert, toUpdate } = prepareImportUpsert<Expense>(imported, () => undefined, expenses);
      setImportPreview({ toInsert, toUpdate, errors: [], totalRows: imported.length });
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const { toInsert } = importPreview;
    setExpenses([...expenses, ...toInsert]);
    onLog('bulk_import', 'expenses', `${t('common.importResult')}: ${toInsert.length}`, toInsert.length);
    setImportPreview(null);
  };

  const categoryTotals = categories.map(cat => ({
    category: cat.value,
    label: t(cat.labelKey),
    total: expenses.filter(exp => exp.category === cat.value).reduce((sum, exp) => sum + getExpenseCreditAmount(exp), 0),
  })).filter(ct => ct.total > 0);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const knownVendorNames = Array.from(new Set(expenses.map(exp => exp.vendorName?.trim()).filter((n): n is string => !!n))).sort((a, b) => a.localeCompare(b));

  const filteredExpenses = expenses.filter(exp => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [exp.title, exp.remarks, exp.voucherNumber, exp.vendorName, exp.vendorContact]
        .some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }

    const f = appliedFilters;
    if (f.amountMin && exp.amount < parseFloat(f.amountMin)) return false;
    if (f.amountMax && exp.amount > parseFloat(f.amountMax)) return false;
    if (f.billVoucher && !(exp.voucherNumber || '').toLowerCase().includes(f.billVoucher.trim().toLowerCase())) return false;
    if (f.status && exp.paymentStatus !== f.status) return false;
    if (f.paidMethod && exp.paidThrough !== f.paidMethod) return false;
    if (f.phone && !(exp.vendorContact || '').includes(f.phone.trim())) return false;
    if (f.dateFrom && new Date(exp.date).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(exp.date).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const pagination = usePagination(sortedExpenses);

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
                  className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 text-white rounded-lg transition-opacity hover:opacity-90 font-bold text-sm sm:text-base whitespace-nowrap"
                  style={{ backgroundColor: '#383737' }}
                >
                  <Upload size={20} />
                  {t('common.import')}
                </button>
              </>
            )}
            <button
              onClick={handleExport}
              className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
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
                {t('expenses.addNew')}
              </button>
            )}
          </div>
        }
      >
        {t('expenses.pageTitle')}
      </PageHeading>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('expenses.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredExpenses.length}
          totalCount={expenses.length}
          showAmount
          showBillVoucher
          billVoucherLabel={t('expenses.voucherNumber')}
          statusOptions={PAYMENT_STATUSES.map(s => ({ value: s.value, label: t(s.labelKey) }))}
          paidMethodOptions={PAID_THROUGH_OPTIONS.filter(m => m.value !== 'notSelected').map(m => ({ value: m.value, label: t(m.labelKey) }))}
          showDateRange
          showPhone
        />
      </CollapsibleSearchPanel>

      {/* Form */}
      <FormModal
        open={canEdit && showForm}
        title={editingId ? t('expenses.editExpense') : t('expenses.addNew')}
        onClose={handleCancel}
        footer={
          <>
            <button
              type="submit"
              form="expenses-form"
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              {editingId ? t('common.update') : t('common.add')}
            </button>
            {!editingId && (
              <button
                type="submit"
                form="expenses-form"
                value="andNew"
                className="px-6 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium"
              >
                {t('common.saveAndAddNew')}
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              {t('common.cancel')}
            </button>
          </>
        }
      >
          <form id="expenses-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.title')} *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.titlePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.amountLabel')} *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.amountPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.paymentStatus')} *</label>
              <select
                required
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as ExpensePaymentStatus })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.paidThrough')}</label>
              <select
                value={formData.paidThrough}
                onChange={(e) => setFormData({ ...formData, paidThrough: e.target.value as PaidThrough })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAID_THROUGH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </select>
            </div>

            {isPartial && (
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  {PARTIAL_LABEL_KEYS.map((labelKey, index) => (
                    <div key={labelKey}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t(labelKey)} {index === 0 ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        required={index === 0}
                        min="0"
                        step="0.01"
                        value={formData.partialAmounts[index]}
                        onChange={(e) => {
                          const next = [...formData.partialAmounts];
                          next[index] = e.target.value;
                          setFormData({ ...formData, partialAmounts: next });
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        placeholder="0"
                      />
                      <input
                        type="date"
                        value={formData.partialDates[index]}
                        onChange={(e) => {
                          const next = [...formData.partialDates];
                          next[index] = e.target.value;
                          setFormData({ ...formData, partialDates: next });
                        }}
                        className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
                <p className={`text-sm mt-2 font-medium ${
                  partialSumFromForm() >= (parseFloat(formData.amount) || 0) && (parseFloat(formData.amount) || 0) > 0
                    ? 'text-green-600'
                    : 'text-yellow-600'
                }`}>
                  ₹{partialSumFromForm().toLocaleString()} / ₹{(parseFloat(formData.amount) || 0).toLocaleString()}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.date')} *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.category')} *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="">{t('expenses.selectCategory')}</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{t(cat.labelKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.voucherNumber')}</label>
              <input
                type="text"
                value={formData.voucherNumber}
                onChange={(e) => setFormData({ ...formData, voucherNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.voucherNumberPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.vendorName')}</label>
              <input
                type="text"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.vendorNamePlaceholder')}
                list="vendor-name-suggestions"
                autoComplete="off"
              />
              <datalist id="vendor-name-suggestions">
                {knownVendorNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.vendorContact')}</label>
              <input
                type="tel"
                value={formData.vendorContact}
                onChange={(e) => setFormData({ ...formData, vendorContact: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.vendorContactPlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.remarksPlaceholder')}
                rows={2}
              />
            </div>
          </form>
      </FormModal>

      {/* Category Summary — Treasury-style widgets, kept to one row */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-1">
        <div className="bg-white rounded-xl shadow-md p-3 sm:p-4 border-l-4 border-green-500 shrink-0 min-w-[140px] sm:min-w-[160px]">
          <h3 className="text-xs sm:text-sm font-medium text-gray-600 truncate">{t('expenses.widget.total')}</h3>
          <p className="text-lg sm:text-xl font-bold text-green-600">₹{totalExpenses.toLocaleString()}</p>
        </div>
        {categoryTotals.map((ct) => (
          <div
            key={ct.category}
            className="bg-white rounded-xl shadow-md p-3 sm:p-4 border-l-4 border-red-500 shrink-0 min-w-[140px] sm:min-w-[160px]"
          >
            <h3 className="text-xs sm:text-sm font-medium text-gray-600 truncate">{ct.label}</h3>
            <p className="text-lg sm:text-xl font-bold text-red-600">₹{ct.total.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('expenses.title')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.amount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('expenses.paymentStatus')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('expenses.paidThrough')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('expenses.category')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.remarks')}</th>
                {(canEdit || canDelete) && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagination.pageItems.map((expense) => {
                const status = expense.paymentStatus || 'paid';
                const partialSum = (expense.partialAmounts || []).reduce((sum, v) => sum + (v || 0), 0);
                const isFullyPaidPartial = status === 'partial' && partialSum >= expense.amount && expense.amount > 0;
                return (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => setViewTarget(expense)}
                        className="text-orange-600 hover:text-orange-700 hover:underline text-left"
                      >
                        {expense.title}
                      </button>
                    </td>
                    <td className={`px-6 py-4 text-sm font-bold ${
                      status === 'cancelled'
                        ? 'text-red-600 line-through'
                        : status === 'partial'
                        ? (isFullyPaidPartial ? 'text-green-600' : 'text-yellow-600')
                        : 'text-red-600'
                    }`}>₹{expense.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                        {statusLabel(status)}
                      </span>
                      {status === 'partial' && (
                        <div className="text-xs text-gray-500 mt-1">
                          ₹{partialSum.toLocaleString()} / ₹{expense.amount.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{paidThroughLabel(expense.paidThrough || 'notSelected')}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(expense.date).toLocaleDateString(locale)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        {categoryLabel(expense.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{expense.remarks || '-'}</td>
                    {(canEdit || canDelete) && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(expense)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(expense.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td className="px-6 py-3 text-sm font-semibold text-gray-700 text-right">{t('common.total')}</td>
                  <td className="px-6 py-3 text-sm font-bold text-gray-900">
                    ₹{filteredExpenses.reduce((sum, exp) => sum + getExpenseCreditAmount(exp), 0).toLocaleString()}
                  </td>
                  <td colSpan={100} />
                </tr>
              </tfoot>
            )}
          </table>
          {expenses.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('expenses.empty')}
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
        title={viewTarget?.title || ''}
        onClose={() => setViewTarget(null)}
        onEdit={canEdit && viewTarget ? () => { const exp = viewTarget; setViewTarget(null); handleEdit(exp); } : undefined}
        fields={viewTarget ? (() => {
          const status = viewTarget.paymentStatus || 'paid';
          const partials = viewTarget.partialAmounts || [];
          const partialDates = viewTarget.partialDates || [];
          const partialSum = partials.reduce((sum, v) => sum + (v || 0), 0);
          const isFullyPaidPartial = status === 'partial' && partialSum >= viewTarget.amount && viewTarget.amount > 0;
          return [
          { label: t('expenses.title'), value: viewTarget.title },
          {
            label: t('common.amount'),
            value: `₹${viewTarget.amount.toLocaleString()}`,
            valueClassName: `font-bold ${
              status === 'cancelled'
                ? 'text-red-600 line-through'
                : status === 'partial'
                ? (isFullyPaidPartial ? 'text-green-600' : 'text-yellow-600')
                : 'text-red-600'
            }`,
          },
          {
            label: t('expenses.paymentStatus'),
            value: (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                {statusLabel(status)}
              </span>
            ),
          },
          { label: t('expenses.paidThrough'), value: paidThroughLabel(viewTarget.paidThrough || 'notSelected') },
          ...(status === 'partial' ? [
            { label: t('expenses.partialAmount1'), value: `₹${(partials[0] ?? 0).toLocaleString()}${partialDates[0] ? ` (${new Date(partialDates[0]).toLocaleDateString(locale)})` : ''}` },
            { label: t('expenses.partialAmount2'), value: `₹${(partials[1] ?? 0).toLocaleString()}${partialDates[1] ? ` (${new Date(partialDates[1]).toLocaleDateString(locale)})` : ''}` },
            { label: t('expenses.partialAmount3'), value: `₹${(partials[2] ?? 0).toLocaleString()}${partialDates[2] ? ` (${new Date(partialDates[2]).toLocaleDateString(locale)})` : ''}` },
            { label: t('expenses.partialAmount4'), value: `₹${(partials[3] ?? 0).toLocaleString()}${partialDates[3] ? ` (${new Date(partialDates[3]).toLocaleDateString(locale)})` : ''}` },
            { label: t('expenses.partialAmount5'), value: `₹${(partials[4] ?? 0).toLocaleString()}${partialDates[4] ? ` (${new Date(partialDates[4]).toLocaleDateString(locale)})` : ''}` },
            { label: t('chanda.partialAmountLabel'), value: `₹${partialSum.toLocaleString()} / ₹${viewTarget.amount.toLocaleString()}` },
          ] : []),
          { label: t('common.date'), value: new Date(viewTarget.date).toLocaleDateString(locale) },
          { label: t('expenses.category'), value: categoryLabel(viewTarget.category) },
          { label: t('expenses.voucherNumber'), value: viewTarget.voucherNumber || '-' },
          { label: t('expenses.vendorName'), value: viewTarget.vendorName || '-' },
          { label: t('expenses.vendorContact'), value: viewTarget.vendorContact || '-' },
          { label: t('common.remarks'), value: viewTarget.remarks || '-', fullWidth: true },
          ];
        })() : []}
      />
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.title}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <StatusChangeConfirmModal
        open={!!pendingSave}
        itemLabel={pendingSave?.payload.title}
        fromStatusLabel={statusLabel('paid')}
        toStatusLabel={pendingSave ? statusLabel(pendingSave.payload.paymentStatus) : ''}
        onCancel={() => setPendingSave(null)}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
