import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download, Upload, Eye, Pencil, Plus, X, MoreVertical, CheckSquare, Square,
  Paperclip, FileText, Megaphone,
} from 'lucide-react';
import { DonationAd, User } from '../App';
import {
  Advertiser, AdvertiserInput, ActivityModule, ActivityFieldChange,
  AppDocument, DocumentCategory,
  createAdvertiserRequest, updateAdvertiserRequest, deleteAdvertiserRequest, fromAdvertiserRow,
  uploadDocumentFile, createAdvertiserDocumentRequest, fromDocumentRow,
} from '../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { PageHeading } from './PageHeading';
import { SelectAllBanner } from './SelectAllBanner';
import { Toast } from './Toast';
import { RequiredMark } from './RequiredMark';
import { ToggleSwitch } from './ToggleSwitch';
import { useLanguage } from '../i18n/LanguageContext';
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

interface AdvertisersProps {
  donationAds: DonationAd[];
  advertisers: Advertiser[];
  setAdvertisers: (a: Advertiser[] | ((prev: Advertiser[]) => Advertiser[])) => void;
  documents: AppDocument[];
  setDocuments: (d: AppDocument[] | ((prev: AppDocument[]) => AppDocument[])) => void;
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  currentUser: User | null;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: ActivityModule, summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
}

export function Advertisers({ donationAds, advertisers, setAdvertisers, documents, setDocuments, canEdit, canDelete, canBulkImport, currentUser, onLog }: AdvertisersProps) {
  const { t, locale } = useLanguage();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [showForm, setShowForm] = useState(false);
  const [editingAdvertiser, setEditingAdvertiser] = useState<Advertiser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Advertiser | null>(null);
  const [attachTarget, setAttachTarget] = useState<Advertiser | null>(null);
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

  // advertisers/documents now come from App.tsx (loaded once centrally so
  // they survive navigation/offline) — no local fetch-on-mount needed here.
  useRealtimeSync(true, 'advertisers', setAdvertisers, fromAdvertiserRow);
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

  // Each advertiser's own Ads-category third-party entries — prefer the
  // real advertiser_id link (set by the backfill migration + the picker in
  // DonationAdsCollection), falling back to a name match for any row
  // somehow not yet linked (should be rare/none after the migration).
  const adsFor = (a: Advertiser) => donationAds.filter(ad =>
    ad.category === 'ads' && (ad.advertiserId ? ad.advertiserId === a.id : (ad.companyName || ad.donorName || '').trim().toLowerCase() === a.name.trim().toLowerCase())
  );

  const documentsFor = (advertiserId: string) => documents.filter(d => d.advertiserId === advertiserId);

  const advertiserTotals = useMemo(() => {
    const map = new Map<string, { totalAmount: number; transactions: number }>();
    for (const a of advertisers) {
      const rows = adsFor(a);
      map.set(a.id, {
        totalAmount: rows.reduce((s, r) => s + r.amount, 0),
        transactions: rows.length,
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertisers, donationAds]);

  const openCreate = () => { setEditingAdvertiser(null); setShowForm(true); };
  const openEdit = (a: Advertiser) => { setEditingAdvertiser(a); setShowForm(true); };

  const handleSave = async (input: AdvertiserInput) => {
    if (editingAdvertiser) {
      const updated = await updateAdvertiserRequest(editingAdvertiser.id, input);
      setAdvertisers(advertisers.map(a => (a.id === updated.id ? updated : a)));
      onLog('update', 'advertisers', updated.name, undefined, undefined, updated.name);
    } else {
      const created = await createAdvertiserRequest(input);
      setAdvertisers([...advertisers, created]);
      onLog('create', 'advertisers', created.name, undefined, undefined, created.name);
    }
    setShowForm(false);
    setEditingAdvertiser(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAdvertiserRequest(deleteTarget.id);
    setAdvertisers(advertisers.filter(a => a.id !== deleteTarget.id));
    onLog('delete', 'advertisers', deleteTarget.name, undefined, undefined, deleteTarget.name);
    setToastType('success');
    setToastMessage(t('common.deletedSuccess'));
    setDeleteTarget(null);
  };

  const filteredAdvertisers = advertisers.filter(a => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [a.name, a.companyName, a.phone, a.phone2, a.city].some(p => p && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }
    const f = appliedFilters;
    if (f.phone && !(a.phone || '').includes(f.phone.trim()) && !(a.phone2 || '').includes(f.phone.trim())) return false;
    return true;
  });

  const sortedAdvertisers = useMemo(
    () => [...filteredAdvertisers].sort((a, b) => (advertiserTotals.get(b.id)?.totalAmount || 0) - (advertiserTotals.get(a.id)?.totalAmount || 0)),
    [filteredAdvertisers, advertiserTotals]
  );
  const pagination = usePagination(sortedAdvertisers);

  const advertiserExportColumns: ExportColumnDef<Advertiser>[] = [
    { id: 'name', label: t('advertisers.name'), value: a => a.name },
    { id: 'companyName', label: t('advertisers.companyName'), value: a => a.companyName || '' },
    { id: 'ownerFirstName', label: t('advertisers.ownerFirstName'), value: a => a.ownerFirstName || '' },
    { id: 'ownerLastName', label: t('advertisers.ownerLastName'), value: a => a.ownerLastName || '' },
    { id: 'category', label: t('advertisers.category'), value: a => a.category || '' },
    { id: 'phone', label: t('common.phone'), value: a => a.phone || '' },
    { id: 'phone2', label: t('advertisers.phone2'), value: a => a.phone2 || '' },
    { id: 'whatsapp', label: t('donors.whatsapp'), value: a => a.whatsapp || '' },
    { id: 'address', label: t('advertisers.address'), value: a => a.address || '' },
    { id: 'city', label: t('advertisers.city'), value: a => a.city || '' },
  ];

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const handleExport = () => setExportModalOpen(true);
  const handleExportSelected = () => {
    const selected = advertisers.filter(a => selectedIds.has(a.id));
    const csvContent = buildCsv(selected, advertiserExportColumns, advertiserExportColumns.map(c => c.id));
    downloadCsv(csvContent, `advertisers-selected-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const [importPreview, setImportPreview] = useState<{ toInsert: AdvertiserInput[]; errors: ImportRowError[]; totalRows: number } | null>(null);
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
      const imported: AdvertiserInput[] = [];
      const rowErrors: ImportRowError[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const lineNum = i - firstDataRow + 1;
        const [name, companyName, ownerFirstName, ownerLastName, category, phone, phone2, whatsapp, address, city] = rows[i];
        if (!name || !name.trim()) {
          rowErrors.push({ line: lineNum, reason: 'Advertiser name is required' });
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
    const created: Advertiser[] = [];
    for (const input of importPreview.toInsert) {
      try {
        created.push(await createAdvertiserRequest(input));
      } catch {
        // skip row-level failures silently — already-validated rows only
      }
    }
    setAdvertisers([...advertisers, ...created]);
    onLog('bulk_import', 'advertisers', `${t('common.importResult')}: ${created.length}`, created.length);
    setImportResults({
      totalRows: importPreview.totalRows,
      importedCount: created.length,
      insertedCount: created.length,
      updatedCount: 0,
      errors: importPreview.errors,
    });
    setImportPreview(null);
  };

  const viewingAdvertiser = advertisers.find(a => a.id === viewingId) || null;
  const viewingRows = viewingAdvertiser ? adsFor(viewingAdvertiser).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
  const viewingTotals = viewingAdvertiser ? advertiserTotals.get(viewingAdvertiser.id) : undefined;

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
                <Plus size={20} /> {t('advertisers.addAdvertiser')}
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
        {t('advertisers.pageTitle')}
      </PageHeading>

      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4">{t('advertisers.hint')}</p>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('advertisers.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredAdvertisers.length}
          totalCount={advertisers.length}
          showPhone
        />
      </CollapsibleSearchPanel>

      {selectMode && (
        <SelectAllBanner
          pageSelectedCount={pagination.pageItems.filter(a => selectedIds.has(a.id)).length}
          totalSelectedCount={selectedIds.size}
          totalFilteredCount={sortedAdvertisers.length}
          onSelectAllFiltered={() => setSelectedIds(new Set(sortedAdvertisers.map(a => a.id)))}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {selectMode && canEdit && selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5">
          <span className="text-sm text-gray-600 dark:text-gray-400">{selectedIds.size} {t('table.select')}</span>
          <button onClick={handleExportSelected} className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium">
            <Download size={14} /> {t('table.exportSelected')} ({selectedIds.size})
          </button>
        </div>
      )}

      {advertisers.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-center py-16 text-gray-500 dark:text-gray-400">
          <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-60" />
          <p className="text-sm">{t('advertisers.empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagination.pageItems.map((a) => {
              const totals = advertiserTotals.get(a.id) || { totalAmount: 0, transactions: 0 };
              const advDocs = documentsFor(a.id);
              return (
                <div key={a.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(a.id)}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                          setSelectedIds(next);
                        }}
                        className="mt-2.5"
                      />
                    )}
                    <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 font-bold">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 truncate">{a.name}</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{a.category || '-'}</p>
                    </div>
                    <div className="relative shrink-0" ref={openRowMenuId === a.id ? rowMenuRef : undefined}>
                      <button
                        onClick={(e) => {
                          if (openRowMenuId === a.id) { setOpenRowMenuId(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setRowMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 176) });
                          setOpenRowMenuId(a.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openRowMenuId === a.id && rowMenuPos && createPortal(
                        <div ref={rowMenuPortalRef} style={{ position: 'fixed', top: rowMenuPos.top, left: rowMenuPos.left }} className="w-44 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]">
                          <button onClick={() => { setOpenRowMenuId(null); setViewingId(a.id); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <Eye size={14} className="text-gray-400" /> {t('vendors.view')}
                          </button>
                          {canEdit && (
                            <button onClick={() => { setOpenRowMenuId(null); openEdit(a); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <Pencil size={14} className="text-gray-500" /> {t('common.edit')}
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => { setOpenRowMenuId(null); setAttachTarget(a); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <Paperclip size={14} className="text-gray-400" /> {t('vendors.attachDocument')}
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => { setOpenRowMenuId(null); setDeleteTarget(a); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                              <X size={14} /> {t('common.delete')}
                            </button>
                          )}
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {(a.ownerFirstName || a.ownerLastName) && (
                      <p className="truncate">{[a.ownerFirstName, a.ownerLastName].filter(Boolean).join(' ')}</p>
                    )}
                    {(a.phone || a.phone2) && <p>{[a.phone, a.phone2].filter(Boolean).join(' · ')}</p>}
                    {a.city && <p className="truncate">{a.city}</p>}
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

                  {advDocs.length > 0 && (
                    <div className="flex items-center gap-1 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                      <Paperclip size={12} /> {advDocs.length} {t('vendors.attachments')}
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

      {viewingAdvertiser && (
        <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewingId(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{viewingAdvertiser.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{[viewingAdvertiser.phone, viewingAdvertiser.phone2].filter(Boolean).join(' · ') || '-'}</p>
                {viewingAdvertiser.category && (
                  <span className="inline-block mt-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    {viewingAdvertiser.category}
                  </span>
                )}
              </div>
              <button onClick={() => setViewingId(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
                <X size={22} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.totalAmount')}</p>
                  <p className="text-lg font-bold text-green-600">₹{(viewingTotals?.totalAmount || 0).toLocaleString()}</p>
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
                        <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{row.companyName || row.donorName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {row.date ? new Date(row.date).toLocaleDateString(locale) : '-'}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-green-600 shrink-0">₹{row.amount.toLocaleString()}</span>
                    </div>
                    {row.remarks && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">{row.remarks}</p>
                    )}
                  </div>
                ))}
                {viewingRows.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">{t('vendors.noTransactions')}</p>
                )}
              </div>

              {documentsFor(viewingAdvertiser.id).length > 0 && (
                <>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 mt-6">{t('vendors.attachments')}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {documentsFor(viewingAdvertiser.id).map(doc => (
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
        <AdvertiserFormModal
          advertiser={editingAdvertiser}
          documents={documents}
          onCancel={() => { setShowForm(false); setEditingAdvertiser(null); }}
          onSave={handleSave}
        />
      )}

      {attachTarget && currentUser && (
        <AdvertiserAttachModal
          advertiser={attachTarget}
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
        columns={advertiserExportColumns.map(c => ({ id: c.id, label: c.label }))}
        storageKey="puja_export_cols_advertisers"
        onClose={() => setExportModalOpen(false)}
        onExport={orderedIds => {
          const csvContent = buildCsv(advertisers, advertiserExportColumns, orderedIds);
          downloadCsv(csvContent, `advertisers-${new Date().toISOString().split('T')[0]}.csv`);
        }}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} type={toastType} />
    </div>
  );
}

export function AdvertiserFormModal({
  advertiser, documents, onCancel, onSave,
}: {
  advertiser: Advertiser | null;
  documents: AppDocument[];
  onCancel: () => void;
  onSave: (input: AdvertiserInput) => Promise<void>;
}) {
  const { t } = useLanguage();
  const formRef = useRef<HTMLDivElement>(null);
  useAutoFocusFirstField(formRef);
  const [name, setName] = useState(advertiser?.name || '');
  const [companyName, setCompanyName] = useState(advertiser?.companyName || '');
  const [category, setCategory] = useState(advertiser?.category || '');
  const [ownerFirstName, setOwnerFirstName] = useState(advertiser?.ownerFirstName || '');
  const [ownerLastName, setOwnerLastName] = useState(advertiser?.ownerLastName || '');
  const [phone, setPhone] = useState(advertiser?.phone || '');
  const [phone2, setPhone2] = useState(advertiser?.phone2 || '');
  const [sameAsContact, setSameAsContact] = useState(advertiser?.sameAsContact !== false);
  const [whatsapp, setWhatsapp] = useState(advertiser?.whatsapp || '');
  const [address, setAddress] = useState(advertiser?.address || '');
  const [city, setCity] = useState(advertiser?.city || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError(t('advertisers.nameRequired')); return; }
    if (!isPhoneValid(phone, false) || !isPhoneValid(phone2, false) || !isPhoneValid(whatsapp, false)) { setError(t('validation.phoneMinDigits')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(), companyName: companyName.trim(), category: category.trim() || null,
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
            <Megaphone size={20} />
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{advertiser ? t('advertisers.editAdvertiser') : t('advertisers.addAdvertiser')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('vendors.reusableAcrossFestivals')}</p>
          </div>
          <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('advertisers.name')}<RequiredMark /></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('advertisers.namePlaceholder')} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('advertisers.category')}</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder={t('advertisers.categoryPlaceholder')} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('advertisers.companyName')}</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
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

          {!advertiser && (
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 rounded-lg p-3">
              {t('vendors.attachAfterSaveHint')}
            </p>
          )}

          {advertiser && documents.some(d => d.advertiserId === advertiser.id) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('vendors.attachments')}</label>
              <div className="grid grid-cols-3 gap-2">
                {documents.filter(d => d.advertiserId === advertiser.id).map(doc => (
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
            {saving ? '...' : advertiser ? t('common.save') : t('advertisers.saveAdvertiser')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdvertiserAttachModal({
  advertiser, currentUser, onCancel, onUploaded,
}: {
  advertiser: Advertiser;
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
      const doc = await createAdvertiserDocumentRequest({
        advertiserId: advertiser.id,
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
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('vendors.attachDocument')} — {advertiser.name}</h3>
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
