import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download, Upload, Eye, Pencil, Plus, X, MoreVertical, CheckSquare, Square,
  Paperclip, FileText, Truck,
} from 'lucide-react';
import { Expense, getExpenseCreditAmount, User } from '../App';
import {
  Vendor, VendorInput, ActivityModule, ActivityFieldChange,
  AppDocument, DocumentCategory,
  listVendorsRequest, createVendorRequest, updateVendorRequest, deleteVendorRequest, fromVendorRow,
  listDocumentsRequest, uploadDocumentFile, createVendorDocumentRequest, deleteDocumentRequest, fromDocumentRow,
} from '../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { EXPENSE_CATEGORIES } from './Expenses';
import { PageHeading } from './PageHeading';
import { Toast } from './Toast';
import { RequiredMark } from './RequiredMark';
import { CustomSelect } from './CustomSelect';
import { ToggleSwitch } from './ToggleSwitch';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { parseCSV, buildCsv, downloadCsv, ExportColumnDef } from '../lib/csv';
import { ExportColumnSelectorModal } from './ExportColumnSelectorModal';
import { ImportResultsModal, ImportResultsSummary } from './ImportResultsModal';
import { ImportPreviewModal, ImportRowError } from './ImportPreviewModal';
import { Pagination, usePagination } from './Pagination';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { onlyDigits, isPhoneValid } from '../lib/validation';
import { useAutoFocusFirstField } from '../lib/useAutoFocusFirstField';

interface VendorsProps {
  expenses: Expense[];
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  currentUser: User | null;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: ActivityModule, summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
}

interface PaymentRow {
  id: string;
  date: string; // sort key only — falls back to the parent expense's date when the installment has none of its own
  displayDate: string; // '' when this installment genuinely has no recorded date — never fabricated
  title: string;
  category: string;
  voucherNumber: string;
  amount: number;
  paymentStatus: Expense['paymentStatus'];
  paidThrough: Expense['paidThrough'];
  totalAmount: number;
  remarks: string;
}

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

// One row per actual payment received, not per expense record — an
// expense paid in 3 partial installments is 3 separate payments to the
// vendor and must count as 3 transactions, not 1 (each installment keeps
// its own amount/date/voucher, but shares the parent expense's title/
// category/payment-status/paid-through/remarks for display).
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
          displayDate: payment.date || '',
          title: exp.title,
          category: exp.category,
          voucherNumber: payment.voucherNumber || exp.voucherNumber || '',
          amount: payment.amount,
          paymentStatus: exp.paymentStatus,
          paidThrough: exp.paidThrough,
          totalAmount: exp.amount,
          remarks: exp.remarks,
        });
      });
    } else {
      rows.push({
        id: exp.id,
        date: exp.date,
        displayDate: exp.date,
        title: exp.title,
        category: exp.category,
        voucherNumber: exp.voucherNumber || '',
        amount: getExpenseCreditAmount(exp),
        paymentStatus: exp.paymentStatus,
        paidThrough: exp.paidThrough,
        totalAmount: exp.amount,
        remarks: exp.remarks,
      });
    }
  }
  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function Vendors({ expenses, canEdit, canDelete, canBulkImport, currentUser, onLog }: VendorsProps) {
  const { t, locale } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [attachTarget, setAttachTarget] = useState<Vendor | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const [rowMenuPos, setRowMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rowMenuPortalRef = useRef<HTMLDivElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listVendorsRequest().then(setVendors).catch(() => {});
    listDocumentsRequest().then(setDocuments).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtimeSync(true, 'vendors', setVendors, fromVendorRow);
  useRealtimeSync(true, 'documents', setDocuments, fromDocumentRow);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (rowMenuRef.current?.contains(e.target as Node)) return;
      if (rowMenuPortalRef.current?.contains(e.target as Node)) return;
      setOpenRowMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categoryLabel = (value: string | null) => {
    if (!value) return '-';
    const key = `expenses.category.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };

  // Each vendor's own expenses — prefer the real vendor_id link (set by the
  // backfill migration + Expenses' own autocomplete), falling back to a
  // name match for any row somehow not yet linked (should be rare/none
  // after the migration, kept only as a safety net).
  const expensesFor = (v: Vendor) => expenses.filter(exp =>
    exp.vendorId ? exp.vendorId === v.id : (exp.vendorName || '').trim().toLowerCase() === v.name.trim().toLowerCase()
  );

  const documentsFor = (vendorId: string) => documents.filter(d => d.vendorId === vendorId);

  // "Transactions" counts actual payments received, not expense records —
  // an expense paid in 3 partial installments is 3 transactions to the
  // vendor, matching paymentRowsFor's own per-installment splitting below.
  const vendorTotals = useMemo(() => {
    const map = new Map<string, { totalContractAmount: number; totalAmount: number; transactions: number }>();
    for (const v of vendors) {
      const rows = expensesFor(v);
      const paymentRows = paymentRowsFor(rows);
      map.set(v.id, {
        totalContractAmount: rows.reduce((s, e) => s + e.amount, 0),
        totalAmount: paymentRows.reduce((s, r) => s + r.amount, 0),
        transactions: paymentRows.length,
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors, expenses]);

  const openCreate = () => { setEditingVendor(null); setShowForm(true); };
  const openEdit = (v: Vendor) => { setEditingVendor(v); setShowForm(true); };

  const handleSave = async (input: VendorInput) => {
    if (editingVendor) {
      const updated = await updateVendorRequest(editingVendor.id, input);
      setVendors(vendors.map(v => (v.id === updated.id ? updated : v)));
      onLog('update', 'vendors', updated.name, undefined, undefined, updated.name);
    } else {
      const created = await createVendorRequest(input);
      setVendors([...vendors, created]);
      onLog('create', 'vendors', created.name, undefined, undefined, created.name);
    }
    setShowForm(false);
    setEditingVendor(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteVendorRequest(deleteTarget.id);
    setVendors(vendors.filter(v => v.id !== deleteTarget.id));
    onLog('delete', 'vendors', deleteTarget.name, undefined, undefined, deleteTarget.name);
    setToastType('success');
    setToastMessage(t('common.deletedSuccess'));
    setDeleteTarget(null);
  };

  const filteredVendors = vendors.filter(v => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [v.name, v.companyName, v.phone, v.phone2, v.city].some(p => p && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }
    const f = appliedFilters;
    if (f.phone && !(v.phone || '').includes(f.phone.trim()) && !(v.phone2 || '').includes(f.phone.trim())) return false;
    if (f.category && v.category !== f.category) return false;
    return true;
  });

  const sortedVendors = useMemo(
    () => [...filteredVendors].sort((a, b) => (vendorTotals.get(b.id)?.totalAmount || 0) - (vendorTotals.get(a.id)?.totalAmount || 0)),
    [filteredVendors, vendorTotals]
  );
  const pagination = usePagination(sortedVendors);

  const vendorExportColumns: ExportColumnDef<Vendor>[] = [
    { id: 'name', label: t('vendors.name'), value: v => v.name },
    { id: 'companyName', label: t('vendors.companyName'), value: v => v.companyName || '' },
    { id: 'ownerFirstName', label: t('vendors.ownerFirstName'), value: v => v.ownerFirstName || '' },
    { id: 'ownerLastName', label: t('vendors.ownerLastName'), value: v => v.ownerLastName || '' },
    { id: 'category', label: t('expenses.category'), value: v => categoryLabel(v.category) },
    { id: 'phone', label: t('common.phone'), value: v => v.phone || '' },
    { id: 'phone2', label: t('vendors.phone2'), value: v => v.phone2 || '' },
    { id: 'whatsapp', label: t('donors.whatsapp'), value: v => v.whatsapp || '' },
    { id: 'address', label: t('vendors.address'), value: v => v.address || '' },
    { id: 'city', label: t('vendors.city'), value: v => v.city || '' },
  ];

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const handleExport = () => setExportModalOpen(true);
  const handleExportSelected = () => {
    const selected = vendors.filter(v => selectedIds.has(v.id));
    const csvContent = buildCsv(selected, vendorExportColumns, vendorExportColumns.map(c => c.id));
    downloadCsv(csvContent, `vendors-selected-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const [importPreview, setImportPreview] = useState<{ toInsert: VendorInput[]; errors: ImportRowError[]; totalRows: number } | null>(null);
  const [importResults, setImportResults] = useState<ImportResultsSummary | null>(null);
  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result || ''));
      if (rows.length === 0) return;
      const firstDataRow = /^[A-Za-z]/.test((rows[0][0] || '').trim()) ? 1 : 0;
      const imported: VendorInput[] = [];
      const rowErrors: ImportRowError[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const lineNum = i - firstDataRow + 1;
        const [name, companyName, ownerFirstName, ownerLastName, category, phone, phone2, whatsapp, address, city] = rows[i];
        if (!name || !name.trim()) {
          rowErrors.push({ line: lineNum, reason: 'Vendor name is required' });
          continue;
        }
        imported.push({
          name: name.trim(),
          companyName: (companyName || '').trim(),
          ownerFirstName: (ownerFirstName || '').trim(),
          ownerLastName: (ownerLastName || '').trim(),
          category: (category || '').trim(),
          phone: onlyDigits(phone || ''),
          phone2: onlyDigits(phone2 || ''),
          whatsapp: onlyDigits(whatsapp || ''),
          sameAsContact: false,
          address: (address || '').trim(),
          city: (city || '').trim(),
        });
      }
      setImportPreview({ toInsert: imported, errors: rowErrors, totalRows: rows.length - firstDataRow });
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const created: Vendor[] = [];
    for (const input of importPreview.toInsert) {
      try {
        created.push(await createVendorRequest(input));
      } catch {
        // skip row-level failures silently — already-validated rows only
      }
    }
    setVendors([...vendors, ...created]);
    onLog('bulk_import', 'vendors', `${t('common.importResult')}: ${created.length}`, created.length);
    setImportResults({
      totalRows: importPreview.totalRows,
      importedCount: created.length,
      insertedCount: created.length,
      updatedCount: 0,
      errors: importPreview.errors,
    });
    setImportPreview(null);
  };

  const viewingVendor = vendors.find(v => v.id === viewingId) || null;
  const viewingRows = viewingVendor ? paymentRowsFor(expensesFor(viewingVendor)) : [];
  const viewingTotals = viewingVendor ? vendorTotals.get(viewingVendor.id) : undefined;

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3 page-actions-row">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            {canEdit && canBulkImport && (
              <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />
            )}
            {canEdit && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} /> {t('vendors.addVendor')}
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
                  <button
                    onClick={() => { setMenuOpen(false); setSelectMode(s => !s); setSelectedIds(new Set()); }}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {selectMode ? <CheckSquare size={16} /> : <Square size={16} />} {t('table.select')}
                  </button>
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
                </div>
              )}
            </div>
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
          resultCount={filteredVendors.length}
          totalCount={vendors.length}
          showPhone
          categoryOptions={EXPENSE_CATEGORIES.map(c => ({ value: c.value, label: t(c.labelKey) }))}
          categoryLabel={t('expenses.category')}
        />
      </CollapsibleSearchPanel>

      {selectMode && canEdit && selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5">
          <span className="text-sm text-gray-600 dark:text-gray-400">{selectedIds.size} {t('table.select')}</span>
          <button onClick={handleExportSelected} className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium">
            <Download size={14} /> {t('table.exportSelected')} ({selectedIds.size})
          </button>
        </div>
      )}

      {vendors.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-center py-16 text-gray-500 dark:text-gray-400">
          <Truck className="w-8 h-8 mx-auto mb-2 opacity-60" />
          <p className="text-sm">{t('vendors.empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagination.pageItems.map((v) => {
              const totals = vendorTotals.get(v.id) || { totalContractAmount: 0, totalAmount: 0, transactions: 0 };
              const vendorDocs = documentsFor(v.id);
              return (
                <div key={v.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(v.id)}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          if (next.has(v.id)) next.delete(v.id); else next.add(v.id);
                          setSelectedIds(next);
                        }}
                        className="mt-2.5"
                      />
                    )}
                    <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 font-bold">
                      {v.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 truncate">{v.name}</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{categoryLabel(v.category)}</p>
                    </div>
                    <div className="relative shrink-0" ref={openRowMenuId === v.id ? rowMenuRef : undefined}>
                      <button
                        onClick={(e) => {
                          if (openRowMenuId === v.id) { setOpenRowMenuId(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setRowMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 176) });
                          setOpenRowMenuId(v.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openRowMenuId === v.id && rowMenuPos && createPortal(
                        <div ref={rowMenuPortalRef} style={{ position: 'fixed', top: rowMenuPos.top, left: rowMenuPos.left }} className="w-44 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]">
                          <button onClick={() => { setOpenRowMenuId(null); setViewingId(v.id); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <Eye size={14} className="text-gray-400" /> {t('vendors.view')}
                          </button>
                          {canEdit && (
                            <button onClick={() => { setOpenRowMenuId(null); openEdit(v); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <Pencil size={14} className="text-gray-500" /> {t('common.edit')}
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => { setOpenRowMenuId(null); setAttachTarget(v); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <Paperclip size={14} className="text-gray-400" /> {t('vendors.attachDocument')}
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => { setOpenRowMenuId(null); setDeleteTarget(v); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                              <X size={14} /> {t('common.delete')}
                            </button>
                          )}
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {(v.ownerFirstName || v.ownerLastName) && (
                      <p className="truncate">{[v.ownerFirstName, v.ownerLastName].filter(Boolean).join(' ')}</p>
                    )}
                    {(v.phone || v.phone2) && <p>{[v.phone, v.phone2].filter(Boolean).join(' · ')}</p>}
                    {v.city && <p className="truncate">{v.city}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-green-700 dark:text-green-400">₹{totals.totalAmount.toLocaleString()}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('vendors.totalAmount')}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{totals.transactions}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('vendors.transactions')}</p>
                    </div>
                  </div>

                  {vendorDocs.length > 0 && (
                    <div className="flex items-center gap-1 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                      <Paperclip size={12} /> {vendorDocs.length} {t('vendors.attachments')}
                    </div>
                  )}
                </div>
              );
            })}
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
        </>
      )}

      {viewingVendor && (
        <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewingId(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{viewingVendor.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{[viewingVendor.phone, viewingVendor.phone2].filter(Boolean).join(' · ') || '-'}</p>
                {viewingVendor.category && (
                  <span className="inline-block mt-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    {categoryLabel(viewingVendor.category)}
                  </span>
                )}
              </div>
              <button onClick={() => setViewingId(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
                <X size={22} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.totalContractAmount')}</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">₹{(viewingTotals?.totalContractAmount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.totalAmount')}</p>
                  <p className="text-lg font-bold text-green-600">₹{(viewingTotals?.totalAmount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.pendingAmount')}</p>
                  <p className="text-lg font-bold text-yellow-600">
                    ₹{Math.max(0, (viewingTotals?.totalContractAmount || 0) - (viewingTotals?.totalAmount || 0)).toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.transactions')}</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{viewingRows.length}</p>
                </div>
              </div>

              <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">{t('vendors.paymentHistory')}</h4>
              <div className="space-y-3">
                {viewingRows.map(row => (
                  <div key={row.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{row.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {row.displayDate ? new Date(row.displayDate).toLocaleDateString(locale) : '-'} · {categoryLabel(row.category)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-green-600 shrink-0">₹{row.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${PAYMENT_STATUS_BADGE[row.paymentStatus] || 'bg-gray-100 text-gray-700'}`}>
                        {row.paymentStatus}
                      </span>
                      {row.paidThrough && row.paidThrough !== 'notSelected' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{row.paidThrough}</span>
                      )}
                      {row.voucherNumber && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">#{row.voucherNumber}</span>
                      )}
                    </div>
                    {row.paymentStatus === 'partial' && row.amount !== row.totalAmount && (
                      <p className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('vendors.partialPayment')} — {t('vendors.paidAmountPartial')}: ₹{row.amount.toLocaleString()} {t('vendors.towardsTotal')} ₹{row.totalAmount.toLocaleString()}
                      </p>
                    )}
                    {row.remarks && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">{row.remarks}</p>
                    )}
                  </div>
                ))}
                {viewingRows.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">{t('vendors.noTransactions')}</p>
                )}
              </div>

              {documentsFor(viewingVendor.id).length > 0 && (
                <>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 mt-6">{t('vendors.attachments')}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {documentsFor(viewingVendor.id).map(doc => (
                      <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                        <FileText size={16} className="text-orange-600 shrink-0" />
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{doc.name}</span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <VendorFormModal
          vendor={editingVendor}
          documents={documents}
          onCancel={() => { setShowForm(false); setEditingVendor(null); }}
          onSave={handleSave}
        />
      )}

      {attachTarget && currentUser && (
        <VendorAttachModal
          vendor={attachTarget}
          currentUser={currentUser}
          onCancel={() => setAttachTarget(null)}
          onUploaded={(doc) => { setDocuments([...documents, doc]); setAttachTarget(null); }}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.name || ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

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
        columns={vendorExportColumns.map(c => ({ id: c.id, label: c.label }))}
        storageKey="puja_export_cols_vendors"
        onClose={() => setExportModalOpen(false)}
        onExport={orderedIds => {
          const csvContent = buildCsv(vendors, vendorExportColumns, orderedIds);
          downloadCsv(csvContent, `vendors-${new Date().toISOString().split('T')[0]}.csv`);
        }}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} type={toastType} />
    </div>
  );
}

export function VendorFormModal({
  vendor, documents, onCancel, onSave,
}: {
  vendor: Vendor | null;
  documents: AppDocument[];
  onCancel: () => void;
  onSave: (input: VendorInput) => Promise<void>;
}) {
  const { t } = useLanguage();
  const formRef = useRef<HTMLDivElement>(null);
  useAutoFocusFirstField(formRef);
  const [name, setName] = useState(vendor?.name || '');
  const [companyName, setCompanyName] = useState(vendor?.companyName || '');
  const [category, setCategory] = useState(vendor?.category || '');
  const [ownerFirstName, setOwnerFirstName] = useState(vendor?.ownerFirstName || '');
  const [ownerLastName, setOwnerLastName] = useState(vendor?.ownerLastName || '');
  const [phone, setPhone] = useState(vendor?.phone || '');
  const [phone2, setPhone2] = useState(vendor?.phone2 || '');
  const [sameAsContact, setSameAsContact] = useState(vendor?.sameAsContact !== false);
  const [whatsapp, setWhatsapp] = useState(vendor?.whatsapp || '');
  const [address, setAddress] = useState(vendor?.address || '');
  const [city, setCity] = useState(vendor?.city || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError(t('vendors.nameRequired')); return; }
    if (!isPhoneValid(phone, false) || !isPhoneValid(phone2, false) || !isPhoneValid(whatsapp, false)) { setError(t('validation.phoneMinDigits')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(), companyName: companyName.trim(), category: category || null,
        ownerFirstName: ownerFirstName.trim(), ownerLastName: ownerLastName.trim(),
        phone: phone.trim(), phone2: phone2.trim(), whatsapp: sameAsContact ? phone.trim() : whatsapp.trim(), sameAsContact,
        address: address.trim(), city: city.trim(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div ref={formRef} className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <span className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
            <Truck size={20} />
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{vendor ? t('vendors.editVendor') : t('vendors.addVendor')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('vendors.reusableAcrossFestivals')}</p>
          </div>
          <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.name')}<RequiredMark /></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('vendors.namePlaceholder')} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.category')}</label>
              <CustomSelect value={category} onChange={setCategory} placeholder={t('search.any')} options={EXPENSE_CATEGORIES.map(c => ({ value: c.value, label: t(c.labelKey) }))} className="py-2.5 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.ownerFirstName')}</label>
              <input value={ownerFirstName} onChange={e => setOwnerFirstName(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.ownerLastName')}</label>
              <input value={ownerLastName} onChange={e => setOwnerLastName(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.contact')}</label>
              <input type="tel" value={phone} onChange={e => setPhone(onlyDigits(e.target.value))} placeholder={t('donors.phonePlaceholder')} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('donors.whatsapp')}</label>
                <ToggleSwitch checked={sameAsContact} onChange={setSameAsContact} label={t('donors.sameAsContact')} />
              </div>
              <input
                type="tel"
                value={sameAsContact ? phone : whatsapp}
                disabled={sameAsContact}
                onChange={e => setWhatsapp(onlyDigits(e.target.value))}
                placeholder={t('donors.phonePlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.address')}</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder={t('vendors.addressPlaceholder')} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.city')}</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder={t('vendors.cityPlaceholder')} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
          </div>

          {!vendor && (
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 rounded-lg p-3">
              {t('vendors.attachAfterSaveHint')}
            </p>
          )}

          {vendor && documents.some(d => d.vendorId === vendor.id) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.attachments')}</label>
              <div className="grid grid-cols-3 gap-2">
                {documents.filter(d => d.vendorId === vendor.id).map(doc => (
                  <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <FileText size={18} className="text-orange-600" />
                    <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate w-full text-center">{doc.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <Toast message={error || null} onDone={() => setError('')} type="error" />
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors">
            {saving ? '...' : vendor ? t('common.save') : t('vendors.saveVendor')}
          </button>
        </div>
      </div>
    </div>
  );
}

function VendorAttachModal({
  vendor, currentUser, onCancel, onUploaded,
}: {
  vendor: Vendor;
  currentUser: User;
  onCancel: () => void;
  onUploaded: (doc: AppDocument) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError(t('documents.validation.fileTooLarge')); return; }
    setError('');
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!file) { setError(t('vendors.chooseFileRequired')); return; }
    if (!name.trim()) { setError(t('documents.validation.nameRequired')); return; }
    setSaving(true);
    setError('');
    try {
      const fileUrl = await uploadDocumentFile(file);
      const doc = await createVendorDocumentRequest({
        vendorId: vendor.id,
        name: name.trim(),
        category: 'other' as DocumentCategory,
        fileUrl,
        fileSizeBytes: file.size,
        uploadedByUserId: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedAt: new Date().toISOString(),
      });
      onUploaded(doc);
    } catch (err: any) {
      setError(err?.message || 'Upload failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('vendors.attachDocument')} — {vendor.name}</h3>
          <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.documentName')}</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.chooseFile')}</label>
            <input type="file" onChange={handlePickFile} className="w-full text-sm text-gray-700 dark:text-gray-300" />
            {file && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{file.name}</p>}
          </div>
          <Toast message={error || null} onDone={() => setError('')} type="error" />
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={handleUpload} disabled={saving} className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors">
            {saving ? '...' : t('vendors.uploadAttachment')}
          </button>
        </div>
      </div>
    </div>
  );
}
