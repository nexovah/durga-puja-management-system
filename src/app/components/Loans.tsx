import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Download, Upload, User as UserIcon, Landmark, HandCoins, MoreVertical, Eye, EyeOff } from 'lucide-react';
import { useWidgetsVisible } from '../hooks/useWidgetsVisible';
import { Loan, Member, PaidMethod, getLoanNetAmount, User } from '../App';
import { diffFields, ActivityFieldChange, Donor, CommitteeMember, createDonorRequest } from '../lib/db';
import { donorFullName, DonorFormModal } from './Donors';
import { PageHeading } from './PageHeading';
import { CustomSelect } from './CustomSelect';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey, translations } from '../i18n/translations';
import { parseCSV, csvField, buildCsv, downloadCsv, ExportColumnDef } from '../lib/csv';
import { ExportColumnSelectorModal } from './ExportColumnSelectorModal';
import { ImportResultsModal, ImportResultsSummary } from './ImportResultsModal';
import { Pagination, usePagination } from './Pagination';
import { ImportPreviewModal, ImportRowError } from './ImportPreviewModal';
import { FormModal, FormModalCancelButton } from './FormModal';
import { RequiredMark } from './RequiredMark';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ViewModal } from './ViewModal';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { useTableColumns, ColumnVisibilityDropdown, SortableTh, DataTableToolbar, ColumnDef } from './TableColumnManager';
import { onlyDigits, isPhoneValid } from '../lib/validation';
import { rankSearchMatches } from '../lib/searchRank';

interface LoansProps {
  loansList: Loan[];
  setLoansList: (loans: Loan[]) => void;
  members: Member[];
  donors: Donor[];
  setDonors: (donors: Donor[]) => void;
  committeeMembers: CommitteeMember[];
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'loans', summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
}

const LOANS_FIELD_LABELS: Record<string, string> = {
  donorName: "Donor's Name", amountReceived: 'Amount Received', amountPaid: 'Amount Paid',
  phone: 'Phone', paymentMethod: 'Paid Method', returnMethod: 'Amount Returned Method', paymentStatus: 'Payment Status',
  date: 'Date', returnDate: 'Return Date', remarks: 'Remarks',
};

const PAID_METHODS: { value: PaidMethod; labelKey: TranslationKey }[] = [
  { value: 'notSelected', labelKey: 'common.paidMethod.notSelected' },
  { value: 'cash', labelKey: 'common.paidMethod.cash' },
  { value: 'qrScan', labelKey: 'common.paidMethod.qrScan' },
  { value: 'onlineBanking', labelKey: 'common.paidMethod.onlineBanking' },
  { value: 'check', labelKey: 'common.paidMethod.check' },
];

const emptyForm = {
  donorName: '',
  donorId: null as string | null,
  amountReceived: '',
  amountPaid: '',
  phone: '',
  paymentMethod: 'notSelected' as PaidMethod,
  returnMethod: 'notSelected' as PaidMethod,
  date: new Date().toISOString().split('T')[0],
  returnDate: '',
  remarks: '',
};

export function Loans({ loansList, setLoansList, members, donors, setDonors, committeeMembers, canEdit, canDelete, canBulkImport, onLog }: LoansProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ toInsert: Loan[]; errors: ImportRowError[]; totalRows: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null);
  const [viewTarget, setViewTarget] = useState<Loan | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [widgetsVisible, toggleWidgets] = useWidgetsVisible('loans');
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

  // Loans are almost always from a donor or committee member — search the
  // standing, tenant-wide Donors + Committee lists (same lender reused
  // across every festival) instead of retyping their details each time.
  const [donorQuery, setDonorQuery] = useState('');
  const [quickAddDonorOpen, setQuickAddDonorOpen] = useState(false);
  const pickablePeople = useMemo(() => {
    const fromDonors = donors.map(d => ({ id: d.id, name: donorFullName(d), unit: d.unitNo || '', phone: d.phone || '', type: d.type, numPersons: d.numPersons, source: 'donor' as const }));
    const fromCommittee = committeeMembers
      .filter(m => !m.donorId)
      .map(m => ({ id: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(' ').trim(), unit: '', phone: m.phone || '', type: undefined as 'owner' | 'tenant' | undefined, numPersons: null as number | null, source: 'member' as const }));
    return [...fromDonors, ...fromCommittee];
  }, [donors, committeeMembers]);
  const matchingPickablePeople = useMemo(() => {
    return rankSearchMatches(pickablePeople, donorQuery, p => p.name, p => [p.unit]);
  }, [donorQuery, pickablePeople]);
  const pickedDonor = useMemo(() => donors.find(d => d.id === formData.donorId) || null, [donors, formData.donorId]);

  const totalLoans = loansList.reduce((sum, loan) => sum + getLoanNetAmount(loan), 0);
  const outstandingCount = loansList.filter(loan => getLoanNetAmount(loan) > 0).length;

  const paidMethodLabel = (method: PaidMethod) => {
    const found = PAID_METHODS.find(m => m.value === method);
    return found ? t(found.labelKey) : method;
  };

  const normalize = (s: string) => s.trim().toLowerCase();
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      setToastType('error');
      setToastMessage(t('validation.fillRequired'));
      return;
    }

    if (!formData.donorName.trim()) {
      setToastType('error');
      setToastMessage(t('committee.pickDonorRequired'));
      return;
    }

    if (!isPhoneValid(formData.phone, false)) {
      setToastType('error');
      setToastMessage(t('validation.phoneMinDigits'));
      return;
    }

    if (formData.paymentMethod === 'notSelected') {
      setToastType('error');
      setToastMessage(t('validation.fillRequired'));
      return;
    }

    const amountPaidNum = parseFloat(formData.amountPaid) || 0;
    if (amountPaidNum > 0 && formData.returnMethod === 'notSelected') {
      setToastType('error');
      setToastMessage(t('validation.fillRequired'));
      return;
    }

    const payload = {
      donorName: formData.donorName,
      donorId: formData.donorId,
      amountReceived: parseFloat(formData.amountReceived) || 0,
      amountPaid: parseFloat(formData.amountPaid) || 0,
      phone: formData.phone,
      paymentMethod: formData.paymentMethod,
      returnMethod: formData.returnMethod,
      paymentStatus: 'paid' as const,
      date: formData.date,
      returnDate: formData.returnDate,
      remarks: formData.remarks,
    };

    if (editingId) {
      const original = loansList.find(l => l.id === editingId);
      setLoansList(loansList.map(l => (l.id === editingId ? { ...l, ...payload } : l)));
      onLog(
        'update', 'loans', `${payload.donorName} — ₹${payload.amountReceived.toLocaleString()}`, 1,
        diffFields(original as any, payload as any, LOANS_FIELD_LABELS),
        payload.donorName
      );
      setToastType('success');
      setToastMessage(t('common.updatedSuccess'));
    } else {
      const newLoan: Loan = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setLoansList([...loansList, newLoan]);
      onLog('create', 'loans', `${payload.donorName} — ₹${payload.amountReceived.toLocaleString()}`, undefined, undefined, payload.donorName);
      setToastType('success');
      setToastMessage(t('common.savedSuccess'));
    }

    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (loan: Loan) => {
    setDonorQuery('');
    setFormData({
      donorName: loan.donorName,
      donorId: loan.donorId || null,
      amountReceived: loan.amountReceived.toString(),
      amountPaid: (loan.amountPaid || 0).toString(),
      phone: loan.phone,
      paymentMethod: loan.paymentMethod || 'notSelected',
      returnMethod: loan.returnMethod || 'notSelected',
      date: loan.date,
      returnDate: loan.returnDate || '',
      remarks: loan.remarks,
    });
    setEditingId(loan.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const target = loansList.find(l => l.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setLoansList(loansList.filter(l => l.id !== deleteTarget.id));
    onLog('delete', 'loans', `${deleteTarget.donorName} — ₹${deleteTarget.amountReceived.toLocaleString()}`, undefined, undefined, deleteTarget.donorName);
    setDeleteTarget(null);
    setToastType('success');
    setToastMessage(t('common.deletedSuccess'));
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const loanExportColumns: ExportColumnDef<Loan>[] = [
    { id: 'donorName', label: t('loans.csv.donorName'), value: l => l.donorName },
    { id: 'amountReceived', label: t('loans.csv.amountReceived'), value: l => l.amountReceived },
    { id: 'amountPaid', label: t('loans.csv.amountPaid'), value: l => l.amountPaid || 0 },
    { id: 'paymentMethod', label: t('loans.paymentMethod'), value: l => paidMethodLabel(l.paymentMethod || 'notSelected') },
    { id: 'returnMethod', label: t('loans.returnMethod'), value: l => paidMethodLabel(l.returnMethod || 'notSelected') },
    { id: 'date', label: t('loans.csv.date'), value: l => l.date },
    { id: 'returnDate', label: t('loans.csv.returnDate'), value: l => l.returnDate || '' },
    { id: 'phone', label: t('loans.csv.phone'), value: l => l.phone },
    { id: 'remarks', label: t('loans.csv.remarks'), value: l => l.remarks },
  ];

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const handleExport = () => {
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

      const firstDataRow = /^\s*-?\d+(\.\d+)?\s*$/.test(rows[0][1] || '') ? 0 : 1;

      const imported: Loan[] = [];
      const rowErrors: ImportRowError[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const lineNum = i - firstDataRow + 1;
        const [donorName, amountReceivedRaw, amountPaidRaw, paidMethodRaw, returnMethodRaw, date, returnDate, phone, remarks] = rows[i];
        const amountReceived = parseFloat((amountReceivedRaw || '').replace(/,/g, ''));
        if (!donorName) {
          rowErrors.push({ line: lineNum, reason: 'Donor name is required' });
          continue;
        }
        if (isNaN(amountReceived)) {
          rowErrors.push({ line: lineNum, reason: 'Amount received could not be read as a number' });
          continue;
        }

        imported.push({
          id: crypto.randomUUID(),
          donorName: donorName.trim(),
          amountReceived,
          amountPaid: parseFloat((amountPaidRaw || '0').replace(/,/g, '')) || 0,
          phone: (phone || '').trim(),
          paymentMethod: parsePaidMethodInput(paidMethodRaw || ''),
          returnMethod: parsePaidMethodInput(returnMethodRaw || ''),
          paymentStatus: 'paid',
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          returnDate: (returnDate || '').trim(),
          remarks: (remarks || '').trim(),
        });
      }

      setImportPreview({ toInsert: imported, errors: rowErrors, totalRows: rows.length - firstDataRow });
    };
    reader.readAsText(file);
  };

  const [importResults, setImportResults] = useState<ImportResultsSummary | null>(null);

  const handleConfirmImport = () => {
    if (!importPreview) return;
    setLoansList([...loansList, ...importPreview.toInsert]);
    onLog('bulk_import', 'loans', `${t('common.importResult')}: ${importPreview.toInsert.length}`, importPreview.toInsert.length);
    setImportResults({
      totalRows: importPreview.totalRows,
      importedCount: importPreview.toInsert.length,
      insertedCount: importPreview.toInsert.length,
      updatedCount: 0,
      errors: importPreview.errors,
    });
    setImportPreview(null);
  };

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const filteredLoans = loansList.filter(l => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [l.donorName, l.phone, l.remarks]
        .some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }

    const f = appliedFilters;
    if (f.amountMin && l.amountReceived < parseFloat(f.amountMin)) return false;
    if (f.amountMax && l.amountReceived > parseFloat(f.amountMax)) return false;
    if (f.paidMethod && l.paymentMethod !== f.paidMethod) return false;
    if (f.phone && !(l.phone || '').includes(f.phone.trim())) return false;
    if (f.dateFrom && new Date(l.date).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(l.date).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  const loanColumns: ColumnDef<Loan>[] = useMemo(() => [
    { id: 'donorName', label: t('loans.donorName'), required: true, sortValue: l => l.donorName },
    { id: 'amountReceived', label: t('loans.amountReceivedLabel'), align: 'left', sortValue: l => l.amountReceived },
    { id: 'amountPaid', label: t('loans.amountPaidLabel'), align: 'left', sortValue: l => l.amountPaid || 0 },
    { id: 'paymentMethod', label: t('loans.paymentMethod'), sortValue: l => paidMethodLabel(l.paymentMethod || 'notSelected') },
    { id: 'returnMethod', label: t('loans.returnMethod'), defaultVisible: false, sortValue: l => paidMethodLabel(l.returnMethod || 'notSelected') },
    { id: 'date', label: t('common.date'), sortValue: l => l.date },
    { id: 'returnDate', label: t('loans.returnDate'), sortValue: l => l.returnDate || '' },
    { id: 'phone', label: t('common.phone'), defaultVisible: false, sortValue: l => l.phone || '' },
    { id: 'remarks', label: t('common.remarks'), defaultVisible: false, sortValue: l => l.remarks || '' },
    ...((canEdit || canDelete) ? [{ id: 'actions', label: t('common.action'), required: true, sortable: false, align: 'right' as const }] : []),
  ], [t, canEdit, canDelete]);

  const tableCols = useTableColumns<Loan>({
    tableId: 'loans',
    columns: loanColumns,
    defaultSort: { columnId: 'date', direction: 'desc' },
  });

  const sortedLoans = useMemo(() => tableCols.sortItems(filteredLoans), [tableCols, filteredLoans]);
  const pagination = usePagination(sortedLoans);

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3">
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
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} />
                {t('loans.addNew')}
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
        {t('loans.pageTitle')}
      </PageHeading>

      {widgetsVisible && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('treasury.loansOutstanding')}</h3>
            <Landmark className="text-orange-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-orange-600">₹{totalLoans.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('loans.outstandingCount')}</h3>
            <HandCoins className="text-amber-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-amber-600">{outstandingCount}</p>
        </div>
      </div>
      )}

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('loans.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredLoans.length}
          totalCount={loansList.length}
          showAmount
          paidMethodOptions={PAID_METHODS.filter(m => m.value !== 'notSelected').map(m => ({ value: m.value, label: t(m.labelKey) }))}
          showDateRange
          showPhone
        />
      </CollapsibleSearchPanel>

      <FormModal
        open={canEdit && showForm}
        title={editingId ? t('loans.editLoan') : t('loans.addNew')}
        onClose={handleCancel}
        footer={
          <>
            <button
              type="submit"
              form="loans-form"
              className="flex-1 min-w-0 px-2 sm:px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {editingId ? t('common.update') : t('common.add')}
            </button>
            <FormModalCancelButton onClick={handleCancel} label={t('common.cancel')} />
          </>
        }
      >
          <form id="loans-form" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search donors + committee members — same picker/picked-card
                pattern as Record Collection, since a loan's lender is
                almost always already a standing Donor or Committee member. */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('committee.pickMember')}</label>
              {formData.donorName ? (
                <div className="flex items-start justify-between gap-3 px-4 py-3 border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 rounded-lg">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {formData.donorName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {pickedDonor?.unitNo ? `${pickedDonor.unitNo} · ` : ''}{formData.donorName}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {[
                          pickedDonor ? (pickedDonor.type === 'owner' ? t('donors.owner') : t('donors.tenant')) : null,
                          pickedDonor?.numPersons !== null && pickedDonor?.numPersons !== undefined ? `${pickedDonor.numPersons} ${t('donors.numPersons')}` : null,
                          formData.phone || null,
                        ].filter(Boolean).map((part, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-gray-400 dark:text-gray-600">·</span>}
                            {part}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setFormData(f => ({ ...f, donorId: null, donorName: '', phone: '' }))} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={16} /></button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={donorQuery}
                    onChange={(e) => setDonorQuery(e.target.value)}
                    placeholder={t('committee.searchFlatName')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                  {matchingPickablePeople.length > 0 && (
                    <div className="mt-1.5 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {matchingPickablePeople.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setFormData(f => ({ ...f, donorId: p.id, donorName: p.name, phone: p.phone })); setDonorQuery(''); }}
                          className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left hover:bg-orange-50 dark:hover:bg-orange-500/10"
                        >
                          <span className="text-gray-800 dark:text-gray-200 truncate">{p.name}{p.unit ? ` · ${p.unit}` : ''}</span>
                          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${p.source === 'donor' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'}`}>
                            {p.source === 'donor' ? t('donationAds.collectedByDonor') : t('donationAds.collectedByMember')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setQuickAddDonorOpen(true)}
                    className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1.5"
                  >
                    <UserIcon size={14} /> {t('chanda.notInListAddMember')}
                  </button>
                </div>
              )}
            </div>


            {/* Row 2: Amount Received | Date | Payment Method */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('loans.amountReceivedLabel')}<RequiredMark /></label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amountReceived}
                  onChange={(e) => setFormData({ ...formData, amountReceived: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('loans.amountPlaceholder')}
                />
              </div>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('loans.paymentMethod')}<RequiredMark /></label>
                <CustomSelect
                  value={formData.paymentMethod}
                  onChange={(v) => setFormData({ ...formData, paymentMethod: v as PaidMethod })}
                  options={PAID_METHODS.filter(m => m.value !== 'notSelected').map((m) => ({ value: m.value, label: t(m.labelKey) }))}
                  placeholder={t('common.paidMethod.notSelected')}
                />
              </div>
            </div>

            {/* Row 3: Amount Paid/Returned | Return Date | Amount Returned Method */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('loans.amountPaidLabel')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amountPaid}
                  onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('loans.amountPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('loans.returnDate')}</label>
                <input
                  type="date"
                  value={formData.returnDate}
                  onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('loans.returnMethod')}</label>
                <CustomSelect
                  value={formData.returnMethod}
                  onChange={(v) => setFormData({ ...formData, returnMethod: v as PaidMethod })}
                  options={PAID_METHODS.map((m) => ({ value: m.value, label: t(m.labelKey) }))}
                />
              </div>
            </div>

            {/* Row 4: Remarks */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('loans.remarksPlaceholder')}
                rows={2}
              />
            </div>
          </form>
      </FormModal>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <DataTableToolbar
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          activeSortLabel={tableCols.activeSortColumn?.label}
          sortDirection={tableCols.sortState.direction}
          onResetSort={tableCols.resetSort}
          columnDropdown={
            <ColumnVisibilityDropdown
              columns={tableCols.columns}
              isColumnVisible={tableCols.isColumnVisible}
              toggleColumn={tableCols.toggleColumn}
              showAllColumns={tableCols.showAllColumns}
              resetColumns={tableCols.resetColumns}
              hasCustomVisibility={tableCols.hasCustomVisibility}
              hiddenCount={tableCols.hiddenCount}
            />
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {tableCols.isColumnVisible('donorName') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'donorName')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('amountReceived') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'amountReceived')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('amountPaid') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'amountPaid')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('paymentMethod') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'paymentMethod')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('returnMethod') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'returnMethod')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('date') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'date')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('returnDate') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'returnDate')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('phone') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'phone')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('remarks') && (
                  <SortableTh column={loanColumns.find(c => c.id === 'remarks')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {(canEdit || canDelete) && tableCols.isColumnVisible('actions') && (
                  <th className="sticky right-0 z-10 px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">{t('common.action')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {tableCols.isColumnVisible('donorName') && (
                    <td className="px-6 py-4 text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => setViewTarget(loan)}
                        className="text-orange-600 hover:text-orange-700 hover:underline text-left"
                      >
                        {loan.donorName}
                      </button>
                    </td>
                  )}
                  {tableCols.isColumnVisible('amountReceived') && (
                    <td className={`px-6 py-4 text-sm font-bold ${
                      getLoanNetAmount(loan) <= 0 ? 'text-amber-500 line-through' : 'text-green-600'
                    }`}>
                      ₹{loan.amountReceived.toLocaleString()}
                    </td>
                  )}
                  {tableCols.isColumnVisible('amountPaid') && (
                    <td className="px-6 py-4 text-sm text-red-600 font-bold">₹{(loan.amountPaid || 0).toLocaleString()}</td>
                  )}
                  {tableCols.isColumnVisible('paymentMethod') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{paidMethodLabel(loan.paymentMethod || 'notSelected')}</td>
                  )}
                  {tableCols.isColumnVisible('returnMethod') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{paidMethodLabel(loan.returnMethod || 'notSelected')}</td>
                  )}
                  {tableCols.isColumnVisible('date') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(loan.date).toLocaleDateString(locale)}
                    </td>
                  )}
                  {tableCols.isColumnVisible('returnDate') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {loan.returnDate ? new Date(loan.returnDate).toLocaleDateString(locale) : '-'}
                    </td>
                  )}
                  {tableCols.isColumnVisible('phone') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{loan.phone || '-'}</td>
                  )}
                  {tableCols.isColumnVisible('remarks') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{loan.remarks || '-'}</td>
                  )}
                  {(canEdit || canDelete) && tableCols.isColumnVisible('actions') && (
                    <td className={`sticky right-0 px-6 py-4 text-right bg-white dark:bg-gray-900 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] ${openRowMenuId === loan.id ? 'z-30' : 'z-10'}`}>
                      <div className="relative inline-block" ref={openRowMenuId === loan.id ? rowMenuRef : undefined}>
                        <button
                          onClick={(e) => {
                            if (openRowMenuId === loan.id) { setOpenRowMenuId(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRowMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setOpenRowMenuId(loan.id);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openRowMenuId === loan.id && rowMenuPos && createPortal(
                          <div ref={rowMenuPortalRef} style={{ position: 'fixed', top: rowMenuPos.top, right: rowMenuPos.right }} className="w-36 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]">
                            {canEdit && (
                              <button onClick={() => { setOpenRowMenuId(null); handleEdit(loan); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <Edit2 size={14} className="text-gray-400" /> Edit
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => { setOpenRowMenuId(null); handleDelete(loan.id); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
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
              ))}
            </tbody>
            {filteredLoans.length > 0 && (tableCols.isColumnVisible('amountReceived') || tableCols.isColumnVisible('amountPaid')) && (
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-950 border-t-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">{t('common.total')}</td>
                  {tableCols.isColumnVisible('amountReceived') && (
                    <td className="px-6 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                      ₹{filteredLoans.reduce((sum, l) => sum + l.amountReceived, 0).toLocaleString()}
                    </td>
                  )}
                  {tableCols.isColumnVisible('amountPaid') && (
                    <td className="px-6 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                      ₹{filteredLoans.reduce((sum, l) => sum + (l.amountPaid || 0), 0).toLocaleString()}
                    </td>
                  )}
                  <td colSpan={100} />
                </tr>
              </tfoot>
            )}
          </table>
          {filteredLoans.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('loans.empty')}
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
        updateCount={0}
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
        columns={loanExportColumns.map(c => ({ id: c.id, label: c.label }))}
        storageKey="puja_export_cols_loans"
        onClose={() => setExportModalOpen(false)}
        onExport={orderedIds => {
          const csvContent = buildCsv(loansList, loanExportColumns, orderedIds);
          downloadCsv(csvContent, `loans-${new Date().toISOString().split('T')[0]}.csv`);
        }}
      />

      {quickAddDonorOpen && (
        <DonorFormModal
          donor={null}
          onCancel={() => setQuickAddDonorOpen(false)}
          onSave={async (input) => {
            const created = await createDonorRequest(input);
            setDonors([...donors, created]);
            setFormData(f => ({ ...f, donorId: created.id, donorName: donorFullName(created), phone: created.phone || '' }));
            setQuickAddDonorOpen(false);
          }}
        />
      )}

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} type={toastType} />
      <ViewModal
        open={!!viewTarget}
        title={viewTarget?.donorName || ''}
        onClose={() => setViewTarget(null)}
        onEdit={canEdit && viewTarget ? () => { const loan = viewTarget; setViewTarget(null); handleEdit(loan); } : undefined}
        fields={viewTarget ? [
          { label: t('loans.donorName'), value: viewTarget.donorName },
          { label: t('loans.amountReceivedLabel'), value: `₹${viewTarget.amountReceived.toLocaleString()}` },
          { label: t('loans.amountPaidLabel'), value: `₹${(viewTarget.amountPaid || 0).toLocaleString()}` },
          { label: t('loans.paymentMethod'), value: paidMethodLabel(viewTarget.paymentMethod || 'notSelected') },
          { label: t('loans.returnMethod'), value: paidMethodLabel(viewTarget.returnMethod || 'notSelected') },
          { label: t('common.date'), value: new Date(viewTarget.date).toLocaleDateString(locale) },
          { label: t('loans.returnDate'), value: viewTarget.returnDate ? new Date(viewTarget.returnDate).toLocaleDateString(locale) : '-' },
          { label: t('common.phone'), value: viewTarget.phone || '-' },
          { label: t('common.remarks'), value: viewTarget.remarks || '-', fullWidth: true },
        ] : []}
      />
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.donorName}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
