import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Download, Upload, MoreVertical, PieChart, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { useWidgetsVisible } from '../hooks/useWidgetsVisible';
import { DashboardDonut, DONUT_COLORS } from './DashboardDonut';
import { Expense, ExpensePaymentStatus, ExpensePartialPayment, PaidThrough, getExpenseCreditAmount } from '../App';
import { diffFields, ActivityFieldChange, Vendor, listVendorsRequest, createVendorRequest } from '../lib/db';
import { rankSearchMatches } from '../lib/searchRank';
import { VendorFormModal } from './Vendors';
import { PageHeading } from './PageHeading';
import { CustomSelect } from './CustomSelect';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey, translations } from '../i18n/translations';
import { parseCSV, csvField, buildCsv, downloadCsv, ExportColumnDef } from '../lib/csv';
import { ExportColumnSelectorModal } from './ExportColumnSelectorModal';
import { ImportResultsModal, ImportResultsSummary } from './ImportResultsModal';
import { Pagination, usePagination } from './Pagination';
import { normalizeKey, prepareImportUpsert } from '../lib/uniqueCheck';
import { ImportPreviewModal, ImportRowError } from './ImportPreviewModal';
import { FormModal, FormModalCancelButton } from './FormModal';
import { RequiredMark } from './RequiredMark';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { StatusChangeConfirmModal } from './StatusChangeConfirmModal';
import { ViewModal } from './ViewModal';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { useTableColumns, ColumnVisibilityDropdown, SortableTh, DataTableToolbar, ColumnDef } from './TableColumnManager';
import { SelectAllBanner } from './SelectAllBanner';

interface ExpensesProps {
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'expenses', summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
  // Bumped by App.tsx's global Cmd/Ctrl+E shortcut to pop the Add form open
  // on arrival at this page, same convention as ChandaCollection's
  // initialAddRequestId.
  initialAddRequestId?: number;
}

// partialPayments is skipped — it's an array of sub-records, not a scalar field to diff.
const EXPENSES_FIELD_LABELS: Record<string, string> = {
  title: 'Title', amount: 'Amount', paymentStatus: 'Payment Status', paidThrough: 'Paid Through',
  date: 'Date', category: 'Category', voucherNumber: 'Voucher Number', vendorName: 'Vendor Name',
  vendorContact: 'Vendor Contact', vendorContact2: 'Vendor Contact 01', remarks: 'Remarks',
};

export const EXPENSE_CATEGORIES: { value: string; labelKey: TranslationKey }[] = [
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
  { value: 'qrPayment', labelKey: 'expenses.paidThrough.qrPayment' },
  { value: 'onlineBanking', labelKey: 'expenses.paidThrough.onlineBanking' },
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
  partialPayments: [] as { amount: string; voucherNumber: string; date: string }[],
  paidThrough: 'notSelected' as PaidThrough,
  date: new Date().toISOString().split('T')[0],
  category: '',
  voucherNumber: '',
  vendorName: '',
  vendorContact: '',
  vendorContact2: '',
  vendorId: null as string | null,
  remarks: '',
};

export function Expenses({ expenses, setExpenses, canEdit, canDelete, canBulkImport, onLog, initialAddRequestId }: ExpensesProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ toInsert: Expense[]; toUpdate: Expense[]; errors: ImportRowError[]; totalRows: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [viewTarget, setViewTarget] = useState<Expense | null>(null);
  const [pendingSave, setPendingSave] = useState<{ payload: Omit<Expense, 'id'>; saveAndAddNew: boolean } | null>(null);
  const [vendorDirectory, setVendorDirectory] = useState<Vendor[]>([]);
  const [vendorQuery, setVendorQuery] = useState('');
  const [quickAddVendorOpen, setQuickAddVendorOpen] = useState(false);
  const matchingVendors = useMemo(() => {
    return rankSearchMatches(vendorDirectory, vendorQuery, v => v.name);
  }, [vendorQuery, vendorDirectory]);
  const pickedVendor = useMemo(() => vendorDirectory.find(v => v.id === formData.vendorId) || null, [vendorDirectory, formData.vendorId]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [widgetsVisible, toggleWidgets] = useWidgetsVisible('expenses');
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const [rowMenuPos, setRowMenuPos] = useState<{ top: number; right: number } | null>(null);
  const rowMenuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (!rowMenuRef.current?.contains(e.target as Node) && !rowMenuPortalRef.current?.contains(e.target as Node)) setOpenRowMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    listVendorsRequest().then(setVendorDirectory).catch(() => {});
  }, []);

  // Picking a vendor auto-fills category/contact from the vendor directory
  // and title from the most recent past expense for that vendor.
  // Only fills fields that are currently blank, never overwrites user input.
  const pickVendor = (v: Vendor) => {
    const nameLower = v.name.trim().toLowerCase();
    const lastExpense = [...expenses]
      .filter(e => (e.vendorName || '').trim().toLowerCase() === nameLower)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      [0];
    setFormData(prev => ({
      ...prev,
      vendorId: v.id,
      vendorName: v.name,
      title: lastExpense?.title && !prev.title ? lastExpense.title : prev.title,
      category: v.category && !prev.category ? v.category : prev.category,
      vendorContact: v.phone || '',
      vendorContact2: v.phone2 || '',
    }));
    setVendorQuery('');
  };

  const categoryLabel = (value: string) => {
    const found = EXPENSE_CATEGORIES.find(c => c.value === value);
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
  // Grand total billed/mentioned across every expense, regardless of
  // payment status — distinct from totalExpenses (what's actually been
  // paid so far, credited via getExpenseCreditAmount).
  const grandTotalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const paidStatusTotal = expenses.filter(e => e.paymentStatus === 'paid').reduce((sum, e) => sum + e.amount, 0);
  const partialStatusTotal = expenses.filter(e => e.paymentStatus === 'partial').reduce((sum, e) => sum + getExpenseCreditAmount(e), 0);

  const isPartial = formData.paymentStatus === 'partial';

  const partialSumFromForm = () =>
    formData.partialPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      setToastType('error');
      setToastMessage(t('validation.fillRequired'));
      return;
    }
    const saveAndAddNew = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'andNew';

    // Category used to be a native <select required> — now CustomSelect, which
    // doesn't participate in native form validation, so this guard replaces it.
    if (!formData.category) {
      setToastType('error');
      setToastMessage(t('validation.fillRequired'));
      return;
    }

    if (formData.paidThrough === 'notSelected') {
      setToastType('error');
      setToastMessage(t('validation.fillRequired'));
      return;
    }

    const amount = parseFloat(formData.amount) || 0;
    const partialPayments: ExpensePartialPayment[] = formData.partialPayments
      .filter(p => p.amount.trim() !== '')
      .map(p => ({
        amount: parseFloat(p.amount) || 0,
        voucherNumber: p.voucherNumber.trim() || undefined,
        date: p.date.trim() || undefined,
      }));
    const partialSum = partialPayments.reduce((sum, p) => sum + p.amount, 0);

    if (formData.paymentStatus === 'partial' && partialSum > amount) {
      setToastType('error');
      setToastMessage(
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
        setToastType('error');
        setToastMessage(t('expenses.voucherNumberDuplicate'));
        return;
      }
    }

    const payload = {
      title: formData.title,
      amount,
      paymentStatus: formData.paymentStatus,
      partialPayments: formData.paymentStatus === 'partial' ? partialPayments : undefined,
      paidThrough: formData.paidThrough,
      date: formData.date,
      category: formData.category,
      voucherNumber: formData.voucherNumber,
      vendorName: formData.vendorName,
      vendorContact: formData.vendorContact,
      vendorContact2: formData.vendorContact2,
      vendorId: formData.vendorId || null,
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
      const original = expenses.find(exp => exp.id === editingId);
      setExpenses(expenses.map(exp =>
        exp.id === editingId
          ? { ...exp, ...payload }
          : exp
      ));
      onLog(
        'update', 'expenses', `${payload.title} — ₹${payload.amount.toLocaleString()}`, 1,
        diffFields(original as any, payload as any, EXPENSES_FIELD_LABELS),
        payload.title
      );
      setToastType('success');
      setToastMessage(t('common.updatedSuccess'));
    } else {
      // Add new expense
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setExpenses([...expenses, newExpense]);
      onLog('create', 'expenses', `${payload.title} — ₹${payload.amount.toLocaleString()}`, undefined, undefined, payload.title);
      setToastType('success');
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

  const openAddForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  useEffect(() => {
    if (initialAddRequestId && initialAddRequestId > 0) {
      openAddForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddRequestId]);

  const handleEdit = (expense: Expense) => {
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      paymentStatus: expense.paymentStatus || 'paid',
      partialPayments: (expense.partialPayments || []).map(p => ({
        amount: String(p.amount),
        voucherNumber: p.voucherNumber || '',
        date: p.date || '',
      })),
      paidThrough: expense.paidThrough || 'notSelected',
      date: expense.date,
      category: expense.category,
      voucherNumber: expense.voucherNumber || '',
      vendorName: expense.vendorName || '',
      vendorContact: expense.vendorContact || '',
      vendorContact2: expense.vendorContact2 || '',
      vendorId: expense.vendorId || null,
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
    onLog('delete', 'expenses', `${deleteTarget.title} — ₹${deleteTarget.amount.toLocaleString()}`, undefined, undefined, deleteTarget.title);
    setDeleteTarget(null);
    setToastType('success');
    setToastMessage(t('common.deletedSuccess'));
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  // Partial payments are unlimited now, so a fixed set of CSV columns
  // can't represent them — packed into one column instead, each
  // installment as "amount:voucherNumber:date", separated by ";".
  const packPartialPayments = (payments?: ExpensePartialPayment[]) =>
    (payments || []).map(p => `${p.amount}:${p.voucherNumber || ''}:${p.date || ''}`).join(';');

  const unpackPartialPayments = (packed: string): ExpensePartialPayment[] =>
    packed.split(';').filter(Boolean).map(chunk => {
      const [amountRaw, voucherNumber, date] = chunk.split(':');
      return {
        amount: parseFloat((amountRaw || '').replace(/,/g, '')) || 0,
        voucherNumber: voucherNumber || undefined,
        date: date || undefined,
      };
    });

  const expenseExportColumns: ExportColumnDef<Expense>[] = [
    { id: 'title', label: t('expenses.csv.title'), value: exp => exp.title },
    { id: 'amount', label: t('expenses.csv.amount'), value: exp => exp.amount },
    { id: 'paymentStatus', label: t('expenses.csv.status'), value: exp => statusLabel(exp.paymentStatus || 'paid') },
    { id: 'partialPayments', label: t('expenses.partialPayments'), value: exp => packPartialPayments(exp.partialPayments) },
    { id: 'paidThrough', label: t('expenses.csv.paidThrough'), value: exp => paidThroughLabel(exp.paidThrough || 'notSelected') },
    { id: 'date', label: t('expenses.csv.date'), value: exp => exp.date },
    { id: 'category', label: t('expenses.csv.category'), value: exp => categoryLabel(exp.category) },
    { id: 'remarks', label: t('expenses.csv.remarks'), value: exp => exp.remarks },
  ];

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');

  const handleExport = () => {
    setExportScope('all');
    setExportModalOpen(true);
  };

  const handleExportSelected = () => {
    setExportScope('selected');
    setExportModalOpen(true);
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
      const rowErrors: ImportRowError[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const lineNum = i - firstDataRow + 1;
        const [
          title, amountRaw, statusRaw,
          partialPaymentsRaw,
          paidThroughRaw, date, categoryRaw, remarks,
        ] = rows[i];
        const amount = parseFloat((amountRaw || '').replace(/,/g, ''));
        if (!title) {
          rowErrors.push({ line: lineNum, reason: 'Title is required' });
          continue;
        }
        if (isNaN(amount)) {
          rowErrors.push({ line: lineNum, reason: 'Amount could not be read as a number' });
          continue;
        }

        const paymentStatus = parseStatusInput(statusRaw || '');
        const parsedPartials = unpackPartialPayments(partialPaymentsRaw || '');

        const categoryRawTrim = (categoryRaw || '').trim();
        const category = EXPENSE_CATEGORIES.find(c => c.value === categoryRawTrim)
          || EXPENSE_CATEGORIES.find(c => Object.values(translations).some(lang => normalize(lang[c.labelKey]) === normalize(categoryRawTrim)));

        imported.push({
          id: crypto.randomUUID(),
          title: title.trim(),
          amount,
          paymentStatus,
          partialPayments: paymentStatus === 'partial' && parsedPartials.length > 0 ? parsedPartials : undefined,
          paidThrough: parsePaidThroughInput(paidThroughRaw || ''),
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          category: category ? category.value : categoryRawTrim,
          remarks: (remarks || '').trim(),
        });
      }

      // Note: voucherNumber isn't a column in this CSV format, so every
      // imported row is always new — nothing to match against for updates.
      const { toInsert, toUpdate } = prepareImportUpsert<Expense>(imported, () => undefined, expenses);
      setImportPreview({ toInsert, toUpdate, errors: rowErrors, totalRows: rows.length - firstDataRow });
    };
    reader.readAsText(file);
  };

  const [importResults, setImportResults] = useState<ImportResultsSummary | null>(null);

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const { toInsert, errors, totalRows } = importPreview;
    setExpenses([...expenses, ...toInsert]);
    onLog('bulk_import', 'expenses', `${t('common.importResult')}: ${toInsert.length}`, toInsert.length);
    setImportPreview(null);
    setImportResults({ totalRows, importedCount: toInsert.length, insertedCount: toInsert.length, updatedCount: 0, errors });
  };

  const categoryTotals = EXPENSE_CATEGORIES.map(cat => ({
    category: cat.value,
    label: t(cat.labelKey),
    total: expenses.filter(exp => exp.category === cat.value).reduce((sum, exp) => sum + getExpenseCreditAmount(exp), 0),
  })).filter(ct => ct.total > 0);

  const [showSearch, setShowSearch] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const filteredExpenses = expenses.filter(exp => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [exp.title, exp.remarks, exp.voucherNumber, exp.vendorName, exp.vendorContact, exp.vendorContact2]
        .some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }

    const f = appliedFilters;
    if (f.amountMin && exp.amount < parseFloat(f.amountMin)) return false;
    if (f.amountMax && exp.amount > parseFloat(f.amountMax)) return false;
    if (f.billVoucher && (exp.voucherNumber || '').toLowerCase() !== f.billVoucher.trim().toLowerCase()) return false;
    if (f.status && exp.paymentStatus !== f.status) return false;
    if (f.paidMethod && exp.paidThrough !== f.paidMethod) return false;
    if (f.phone && !(exp.vendorContact || '').includes(f.phone.trim()) && !(exp.vendorContact2 || '').includes(f.phone.trim())) return false;
    if (f.dateFrom && new Date(exp.date).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(exp.date).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  const expenseColumns: ColumnDef<Expense>[] = useMemo(() => [
    { id: 'title', label: t('expenses.title'), required: true, sortValue: e => e.title },
    { id: 'amount', label: t('common.amount'), align: 'left', sortValue: e => e.amount },
    { id: 'paymentStatus', label: t('expenses.paymentStatus'), sortValue: e => e.paymentStatus || 'paid' },
    { id: 'paidThrough', label: t('expenses.paidThrough'), sortValue: e => paidThroughLabel(e.paidThrough || 'notSelected') },
    { id: 'date', label: t('common.date'), sortValue: e => e.date },
    { id: 'category', label: t('expenses.category'), sortValue: e => categoryLabel(e.category) },
    { id: 'voucherNumber', label: t('expenses.voucherNumber'), defaultVisible: false, sortValue: e => e.voucherNumber || '' },
    { id: 'vendorName', label: t('expenses.vendorName'), defaultVisible: false, sortValue: e => e.vendorName || '' },
    { id: 'remarks', label: t('common.remarks'), defaultVisible: false, sortValue: e => e.remarks || '' },
    ...((canEdit || canDelete) ? [{ id: 'actions', label: t('common.action'), required: true, sortable: false, align: 'right' as const }] : []),
  ], [t, canEdit, canDelete]);

  const tableCols = useTableColumns<Expense>({
    tableId: 'expenses',
    columns: expenseColumns,
    defaultSort: { columnId: 'date', direction: 'desc' },
  });

  const sortedExpenses = useMemo(() => tableCols.sortItems(filteredExpenses), [tableCols, filteredExpenses]);
  const pagination = usePagination(sortedExpenses);

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3 page-actions-row">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            {canEdit && canBulkImport && (
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFile}
                className="hidden"
              />
            )}
            {canEdit && (
              <button
                onClick={openAddForm}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} />
                {t('expenses.addNew')}
              </button>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <MoreVertical size={20} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                  {canEdit && canBulkImport && (
                    <button
                      onClick={() => { setMenuOpen(false); handleImportClick(); }}
                      className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Upload size={16} /> {t('common.import')}
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => { setMenuOpen(false); handleExport(); }}
                      className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Download size={16} /> {t('common.export')}
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); toggleWidgets(); }}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {widgetsVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {widgetsVisible ? t('common.hideWidgets') : t('common.viewWidgets')}
                  </button>
                </div>
              )}
            </div>
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
              className="flex-1 min-w-0 px-2 sm:px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {editingId ? t('common.update') : t('common.add')}
            </button>
            {!editingId && (
              <button
                type="submit"
                form="expenses-form"
                value="andNew"
                className="flex-1 min-w-0 px-2 sm:px-6 py-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {t('common.saveAndAddNew')}
              </button>
            )}
            <FormModalCancelButton onClick={handleCancel} label={t('common.cancel')} />
          </>
        }
      >
          <form id="expenses-form" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('expenses.title')}<RequiredMark /></label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.titlePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('expenses.amountLabel')}<RequiredMark /></label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.amountPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('expenses.paymentStatus')}<RequiredMark /></label>
              <CustomSelect
                value={formData.paymentStatus}
                onChange={(v) => setFormData({ ...formData, paymentStatus: v as ExpensePaymentStatus })}
                options={PAYMENT_STATUSES.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('expenses.paidThrough')}<RequiredMark /></label>
              <CustomSelect
                value={formData.paidThrough}
                onChange={(v) => setFormData({ ...formData, paidThrough: v as PaidThrough })}
                options={PAID_THROUGH_OPTIONS.filter(m => m.value !== 'notSelected').map((m) => ({ value: m.value, label: t(m.labelKey) }))}
                placeholder={t('expenses.paidThrough.notSelected')}
              />
            </div>

            {isPartial && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('expenses.partialPayments')}
                </label>
                <div className="space-y-3">
                  {formData.partialPayments.map((payment, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payment.amount}
                        onChange={(e) => {
                          const next = [...formData.partialPayments];
                          next[index] = { ...next[index], amount: e.target.value };
                          setFormData({ ...formData, partialPayments: next });
                        }}
                        className="w-full sm:flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        placeholder={t('common.amount')}
                      />
                      <input
                        type="text"
                        value={payment.voucherNumber}
                        onChange={(e) => {
                          const next = [...formData.partialPayments];
                          next[index] = { ...next[index], voucherNumber: e.target.value };
                          setFormData({ ...formData, partialPayments: next });
                        }}
                        className="w-full sm:flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        placeholder={t('expenses.voucherNumber')}
                      />
                      <input
                        type="date"
                        value={payment.date}
                        onChange={(e) => {
                          const next = [...formData.partialPayments];
                          next[index] = { ...next[index], date: e.target.value };
                          setFormData({ ...formData, partialPayments: next });
                        }}
                        className="w-full sm:flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, partialPayments: formData.partialPayments.filter((_, i) => i !== index) })}
                        className="shrink-0 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        aria-label={t('common.delete')}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, partialPayments: [...formData.partialPayments, { amount: '', voucherNumber: '', date: '' }] })}
                    className="flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                  >
                    <Plus size={16} /> {t('expenses.addPartialPayment')}
                  </button>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.date')}<RequiredMark /></label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('expenses.category')}<RequiredMark /></label>
              <CustomSelect
                value={formData.category}
                onChange={(v) => setFormData({ ...formData, category: v })}
                placeholder={t('expenses.selectCategory')}
                options={EXPENSE_CATEGORIES.map((cat) => ({ value: cat.value, label: t(cat.labelKey) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('expenses.voucherNumber')}</label>
              <input
                type="text"
                value={formData.voucherNumber}
                onChange={(e) => setFormData({ ...formData, voucherNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.voucherNumberPlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('committee.pickVendor')}</label>
              {formData.vendorName ? (
                <div className="flex items-start justify-between gap-3 px-4 py-3 border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 rounded-lg">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {formData.vendorName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{formData.vendorName}</p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {[
                          pickedVendor?.category ? categoryLabel(pickedVendor.category) : null,
                          formData.vendorContact || null,
                        ].filter(Boolean).map((part, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-gray-400 dark:text-gray-600">·</span>}
                            {part}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, vendorId: null, vendorName: '', vendorContact: '', vendorContact2: '' }))}
                    className="text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={vendorQuery}
                    onChange={(e) => setVendorQuery(e.target.value)}
                    placeholder={t('expenses.vendorNamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                  {matchingVendors.length > 0 && (
                    <div className="mt-1.5 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {matchingVendors.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => pickVendor(v)}
                          className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left hover:bg-orange-50 dark:hover:bg-orange-500/10"
                        >
                          <span className="text-gray-800 dark:text-gray-200 truncate">{v.name}{v.category ? ` · ${categoryLabel(v.category)}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setQuickAddVendorOpen(true)}
                    className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1.5"
                  >
                    <Plus size={14} /> {t('expenses.notInListAddVendor')}
                  </button>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.remarksPlaceholder')}
                rows={2}
              />
            </div>
          </form>
      </FormModal>

      {/* Widgets — grand total + paid/partial/pending donut, and a
          category-wise breakdown donut, matching Collection's widget style. */}
      {widgetsVisible && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        <DashboardDonut
          title={t('expenses.widget.total')}
          icon={PieChart}
          iconAccent="text-green-600"
          compact
          grandTotal={{ label: t('expenses.widget.grandTotal'), value: grandTotalExpense }}
          slices={[
            { name: t('expenses.status.paid'), value: paidStatusTotal },
            { name: t('expenses.status.partial'), value: partialStatusTotal },
            { name: t('expenses.widget.pending'), value: Math.max(0, grandTotalExpense - totalExpenses) },
          ]}
          colors={['#16a34a', '#3b82f6', '#f59e0b']}
          emptyMessage={t('expenses.widget.noData')}
        />
        <DashboardDonut
          title={t('expenses.widget.byCategory')}
          icon={PieChart}
          iconAccent="text-red-600"
          compact
          slices={categoryTotals.map(ct => ({ name: ct.label, value: ct.total }))}
          colors={DONUT_COLORS}
          emptyMessage={t('expenses.widget.noData')}
        />
      </div>
      )}

      {/* Expenses List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <DataTableToolbar
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          activeSortLabel={tableCols.activeSortColumn?.label}
          sortDirection={tableCols.sortState.direction}
          onResetSort={tableCols.resetSort}
          columnDropdown={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectMode(m => !m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-all shadow-sm ${
                  selectMode
                    ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 text-orange-600 dark:text-orange-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {selectMode ? <CheckSquare size={15} className="shrink-0" /> : <Square size={15} className="shrink-0" />}
                <span>{t('table.select')}</span>
              </button>
              {selectMode && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleExportSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all shadow-sm"
                >
                  <Download size={15} className="shrink-0" />
                  <span>{t('table.exportSelected')} ({selectedIds.size})</span>
                </button>
              )}
              <ColumnVisibilityDropdown
                columns={tableCols.columns}
                isColumnVisible={tableCols.isColumnVisible}
                toggleColumn={tableCols.toggleColumn}
                showAllColumns={tableCols.showAllColumns}
                resetColumns={tableCols.resetColumns}
                hasCustomVisibility={tableCols.hasCustomVisibility}
                hiddenCount={tableCols.hiddenCount}
              />
            </div>
          }
        />
        {selectMode && (
          <SelectAllBanner
            pageSelectedCount={pagination.pageItems.filter(x => selectedIds.has(x.id)).length}
            totalSelectedCount={selectedIds.size}
            totalFilteredCount={sortedExpenses.length}
            onSelectAllFiltered={() => setSelectedIds(new Set(sortedExpenses.map(x => x.id)))}
            onClear={() => setSelectedIds(new Set())}
          />
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {selectMode && (
                  <th className="px-4 py-3 w-10 text-left">
                    <input
                      type="checkbox"
                      checked={pagination.pageItems.length > 0 && pagination.pageItems.every(x => selectedIds.has(x.id))}
                      ref={(el) => {
                        if (el) {
                          const someChecked = pagination.pageItems.some(x => selectedIds.has(x.id));
                          const allChecked = pagination.pageItems.length > 0 && pagination.pageItems.every(x => selectedIds.has(x.id));
                          el.indeterminate = someChecked && !allChecked;
                        }
                      }}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) {
                          pagination.pageItems.forEach(x => next.add(x.id));
                        } else {
                          pagination.pageItems.forEach(x => next.delete(x.id));
                        }
                        setSelectedIds(next);
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
                    />
                  </th>
                )}
                {tableCols.isColumnVisible('title') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'title')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('amount') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'amount')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('paymentStatus') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'paymentStatus')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('paidThrough') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'paidThrough')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('date') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'date')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('category') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'category')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('voucherNumber') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'voucherNumber')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('vendorName') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'vendorName')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('remarks') && (
                  <SortableTh column={expenseColumns.find(c => c.id === 'remarks')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {(canEdit || canDelete) && tableCols.isColumnVisible('actions') && (
                  <th className="sticky right-0 z-10 px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">{t('common.action')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((expense) => {
                const status = expense.paymentStatus || 'paid';
                const partialSum = (expense.partialPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                const isFullyPaidPartial = status === 'partial' && partialSum >= expense.amount && expense.amount > 0;
                return (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {selectMode && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(expense.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(expense.id);
                            else next.delete(expense.id);
                            setSelectedIds(next);
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
                        />
                      </td>
                    )}
                    {tableCols.isColumnVisible('title') && (
                      <td className="px-6 py-4 text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => setViewTarget(expense)}
                          className="text-orange-600 hover:text-orange-700 hover:underline text-left"
                        >
                          {expense.title}
                        </button>
                      </td>
                    )}
                    {tableCols.isColumnVisible('amount') && (
                      <td className={`px-6 py-4 text-sm font-bold ${
                        status === 'cancelled'
                          ? 'text-red-600 line-through'
                          : status === 'partial'
                          ? (isFullyPaidPartial ? 'text-green-600' : 'text-yellow-600')
                          : 'text-red-600'
                      }`}>₹{expense.amount.toLocaleString()}</td>
                    )}
                    {tableCols.isColumnVisible('paymentStatus') && (
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_BADGE_CLASS[status]}`}>
                          {statusLabel(status)}
                        </span>
                        {status === 'partial' && (
                          <div className="text-xs mt-1 font-medium">
                            <span className="text-red-600">₹{partialSum.toLocaleString()}</span>
                            <span className="text-gray-400 mx-0.5"> / </span>
                            <span className="text-yellow-600">₹{expense.amount.toLocaleString()}</span>
                          </div>
                        )}
                      </td>
                    )}
                    {tableCols.isColumnVisible('paidThrough') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{paidThroughLabel(expense.paidThrough || 'notSelected')}</td>
                    )}
                    {tableCols.isColumnVisible('date') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(expense.date).toLocaleDateString(locale)}
                      </td>
                    )}
                    {tableCols.isColumnVisible('category') && (
                      <td className="px-6 py-4 text-sm">
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          {categoryLabel(expense.category)}
                        </span>
                      </td>
                    )}
                    {tableCols.isColumnVisible('voucherNumber') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{expense.voucherNumber || '-'}</td>
                    )}
                    {tableCols.isColumnVisible('vendorName') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{expense.vendorName || '-'}</td>
                    )}
                    {tableCols.isColumnVisible('remarks') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{expense.remarks || '-'}</td>
                    )}
                    {(canEdit || canDelete) && tableCols.isColumnVisible('actions') && (
                      <td className={`sticky right-0 px-6 py-4 text-right bg-white dark:bg-gray-900 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] ${openRowMenuId === expense.id ? 'z-30' : 'z-10'}`}>
                        <div className="relative inline-block" ref={openRowMenuId === expense.id ? rowMenuRef : undefined}>
                          <button
                            onClick={(e) => {
                              if (openRowMenuId === expense.id) { setOpenRowMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setRowMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenRowMenuId(expense.id);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openRowMenuId === expense.id && rowMenuPos && createPortal(
                            <div ref={rowMenuPortalRef} style={{ position: 'fixed', top: rowMenuPos.top, right: rowMenuPos.right }} className="w-36 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]">
                              {canEdit && (
                                <button onClick={() => { setOpenRowMenuId(null); handleEdit(expense); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                  <Edit2 size={14} className="text-gray-400" /> Edit
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => { setOpenRowMenuId(null); handleDelete(expense.id); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                  <Trash2 size={14} /> Delete
                                </button>
                              )}
                            </div>,
                            document.body
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {filteredExpenses.length > 0 && tableCols.isColumnVisible('amount') && (
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-950 border-t-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td
                    colSpan={tableCols.isColumnVisible('title') ? 1 : 0}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right"
                  >
                    {t('common.total')}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                    ₹{filteredExpenses.reduce((sum, exp) => sum + getExpenseCreditAmount(exp), 0).toLocaleString()}
                  </td>
                  <td colSpan={100} />
                </tr>
              </tfoot>
            )}
          </table>
          {filteredExpenses.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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

      <ImportResultsModal
        open={!!importResults}
        summary={importResults}
        onClose={() => setImportResults(null)}
      />

      <ExportColumnSelectorModal
        open={exportModalOpen}
        columns={expenseExportColumns.map(c => ({ id: c.id, label: c.label }))}
        storageKey="puja_export_cols_expenses"
        onClose={() => setExportModalOpen(false)}
        onExport={orderedIds => {
          const rows = exportScope === 'selected' ? expenses.filter(x => selectedIds.has(x.id)) : expenses;
          const csvContent = buildCsv(rows, expenseExportColumns, orderedIds);
          downloadCsv(csvContent, `expenses-${exportScope}-${new Date().toISOString().split('T')[0]}.csv`);
        }}
      />

      {quickAddVendorOpen && (
        <VendorFormModal
          vendor={null}
          documents={[]}
          onCancel={() => setQuickAddVendorOpen(false)}
          onSave={async (input) => {
            const created = await createVendorRequest(input);
            setVendorDirectory([...vendorDirectory, created]);
            pickVendor(created);
            setQuickAddVendorOpen(false);
          }}
        />
      )}

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} type={toastType} />
      <ViewModal
        open={!!viewTarget}
        title={viewTarget?.title || ''}
        onClose={() => setViewTarget(null)}
        onEdit={canEdit && viewTarget ? () => { const exp = viewTarget; setViewTarget(null); handleEdit(exp); } : undefined}
        fields={viewTarget ? (() => {
          const status = viewTarget.paymentStatus || 'paid';
          const partials = viewTarget.partialPayments || [];
          const partialSum = partials.reduce((sum, p) => sum + (p.amount || 0), 0);
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
          ...(status === 'partial' && partials.length > 0 ? [{
            label: t('expenses.partialPayments'),
            fullWidth: true,
            value: (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-950">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 w-10">#</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('common.amount')}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('expenses.voucherNumber')}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('common.date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {partials.map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">₹{p.amount.toLocaleString()}</td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{p.voucherNumber || '-'}</td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{p.date ? new Date(p.date).toLocaleDateString(locale) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-950 border-t-2 border-gray-200 dark:border-gray-700">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">₹{partialSum.toLocaleString()}</td>
                      <td colSpan={2} className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400">{t('chanda.partialAmountLabel')}: ₹{partialSum.toLocaleString()} / ₹{viewTarget.amount.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ),
          }] : []),
          { label: t('common.date'), value: new Date(viewTarget.date).toLocaleDateString(locale) },
          { label: t('expenses.category'), value: categoryLabel(viewTarget.category) },
          { label: t('expenses.voucherNumber'), value: viewTarget.voucherNumber || '-' },
          { label: t('expenses.vendorName'), value: viewTarget.vendorName || '-' },
          { label: t('expenses.vendorContact'), value: viewTarget.vendorContact || '-' },
          { label: t('expenses.vendorContact2'), value: viewTarget.vendorContact2 || '-' },
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
