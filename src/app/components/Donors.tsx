import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Upload, Edit2, Trash2, Plus, X, MoreVertical, CheckSquare, Square, UserPlus } from 'lucide-react';
import {
  Donor, DonorInput, CommitteeMember, CommitteeMemberInput, EventInfo,
  ActivityModule, ActivityFieldChange,
  listDonorsRequest, createDonorRequest, updateDonorRequest, deleteDonorRequest, fromDonorRow,
  createCommitteeMemberRequest,
} from '../lib/db';
import { DonorDetailModal } from './DonorDetailModal';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { PageHeading } from './PageHeading';
import { SelectAllBanner } from './SelectAllBanner';
import { Toast } from './Toast';
import { RequiredMark } from './RequiredMark';
import { CustomSelect } from './CustomSelect';
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
import { useTableColumns, SortableTh, DataTableToolbar, ColumnDef, ColumnVisibilityDropdown } from './TableColumnManager';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { onlyDigits, isPhoneValid } from '../lib/validation';
import { useAutoFocusFirstField } from '../lib/useAutoFocusFirstField';
import { ROLES } from './Committee';

interface DonorsProps {
  donors: Donor[];
  setDonors: (donors: Donor[]) => void;
  committeeMembers: CommitteeMember[];
  setCommitteeMembers: (members: CommitteeMember[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: ActivityModule, summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
  // For the donor detail modal's cross-event contribution history + its
  // "Add Collection" footer button.
  events: EventInfo[];
  onAddCollectionForDonor: (donorId: string) => void;
}

export const DONOR_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'vip', label: 'VIP' },
  { value: 'other', label: 'Other' },
];

export function donorFullName(d: { firstName: string; lastName: string }): string {
  return [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
}

export function Donors({ donors, setDonors, committeeMembers, setCommitteeMembers, canEdit, canDelete, canBulkImport, onLog, events, onAddCollectionForDonor }: DonorsProps) {
  const { t } = useLanguage();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [showForm, setShowForm] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Donor | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const [rowMenuPos, setRowMenuPos] = useState<{ top: number; right: number } | null>(null);
  const rowMenuPortalRef = useRef<HTMLDivElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const importInputRef = useRef<HTMLInputElement>(null);
  const [viewingDonorId, setViewingDonorId] = useState<string | null>(null);

  useEffect(() => {
    listDonorsRequest().then(setDonors).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtimeSync(true, 'donors', setDonors, fromDonorRow);

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

  const categoryLabel = (value: string) => DONOR_CATEGORIES.find(c => c.value === value)?.label || value;

  const openCreate = () => { setEditingDonor(null); setShowForm(true); };
  const openEdit = (d: Donor) => { setEditingDonor(d); setShowForm(true); };

  const handleSave = async (input: DonorInput, designation?: string) => {
    if (editingDonor) {
      const updated = await updateDonorRequest(editingDonor.id, input);
      setDonors(donors.map(d => (d.id === updated.id ? updated : d)));
      onLog('update', 'donors', donorFullName(updated), undefined, undefined, donorFullName(updated));
      if (input.isCommitteeMember && !editingDonor.isCommitteeMember) {
        await createCommitteeFromDonor(updated, designation);
      }
    } else {
      const created = await createDonorRequest(input);
      setDonors([...donors, created]);
      onLog('create', 'donors', donorFullName(created), undefined, undefined, donorFullName(created));
      if (input.isCommitteeMember) {
        await createCommitteeFromDonor(created, designation);
      }
    }
    setShowForm(false);
    setEditingDonor(null);
  };

  const createCommitteeFromDonor = async (donor: Donor, designation?: string) => {
    const payload: CommitteeMemberInput = {
      donorId: donor.id,
      designation: designation || 'volunteer',
      firstName: donor.firstName,
      lastName: donor.lastName,
      phone: donor.phone,
      whatsapp: donor.whatsapp,
      email: donor.email,
      isActive: true,
    };
    const created = await createCommitteeMemberRequest(payload);
    setCommitteeMembers([...committeeMembers, created]);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDonorRequest(deleteTarget.id);
    setDonors(donors.filter(d => d.id !== deleteTarget.id));
    onLog('delete', 'donors', donorFullName(deleteTarget), undefined, undefined, donorFullName(deleteTarget));
    setToastType('success');
    setToastMessage(t('common.deletedSuccess'));
    setDeleteTarget(null);
  };

  const filteredDonors = donors.filter(d => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [donorFullName(d), d.unitNo, d.phone, d.email].some(p => p && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }
    const f = appliedFilters;
    if (f.phone && !(d.phone || '').includes(f.phone.trim())) return false;
    if (f.category && d.category !== f.category) return false;
    if (f.type && d.type !== f.type) return false;
    if (f.unitNo && !(d.unitNo || '').toLowerCase().includes(f.unitNo.trim().toLowerCase())) return false;
    return true;
  });

  const donorColumns: ColumnDef<Donor>[] = useMemo(() => [
    { id: 'unitNo', label: t('donors.unitNo'), sortValue: d => d.unitNo || '' },
    { id: 'name', label: t('donors.name'), required: true, sortValue: d => donorFullName(d) },
    { id: 'category', label: t('donors.category'), sortValue: d => categoryLabel(d.category) },
    { id: 'type', label: t('donors.type'), sortValue: d => d.type },
    { id: 'numPersons', label: t('donors.numPersons'), defaultVisible: false, sortValue: d => d.numPersons ?? -1 },
    { id: 'phone', label: t('common.phone'), sortValue: d => d.phone || '' },
    { id: 'whatsapp', label: t('donors.whatsapp'), defaultVisible: false, sortValue: d => d.whatsapp || '' },
    { id: 'email', label: t('donors.email'), defaultVisible: false, sortValue: d => d.email || '' },
    { id: 'committee', label: t('donors.committeeMember'), sortValue: d => (d.isCommitteeMember ? 1 : 0) },
    ...((canEdit || canDelete) ? [{ id: 'actions', label: t('common.action'), required: true, sortable: false, align: 'right' as const }] : []),
  ], [t, canEdit, canDelete]);

  const tableCols = useTableColumns<Donor>({
    tableId: 'donors',
    columns: donorColumns,
    defaultSort: { columnId: 'name', direction: 'asc' },
  });

  const sortedDonors = useMemo(() => tableCols.sortItems(filteredDonors), [tableCols, filteredDonors]);
  const pagination = usePagination(sortedDonors);

  const donorExportColumns: ExportColumnDef<Donor>[] = [
    { id: 'unitNo', label: t('donors.unitNo'), value: d => d.unitNo || '' },
    { id: 'numPersons', label: t('donors.numPersons'), value: d => d.numPersons ?? '' },
    { id: 'firstName', label: t('donors.firstName'), value: d => d.firstName },
    { id: 'lastName', label: t('donors.lastName'), value: d => d.lastName },
    { id: 'category', label: t('donors.category'), value: d => categoryLabel(d.category) },
    { id: 'type', label: t('donors.type'), value: d => d.type },
    { id: 'phone', label: t('common.phone'), value: d => d.phone || '' },
    { id: 'whatsapp', label: t('donors.whatsapp'), value: d => d.whatsapp || '' },
    { id: 'email', label: t('donors.email'), value: d => d.email || '' },
    { id: 'relatedFlat', label: t('donors.relatedFlat'), value: d => d.relatedFlat || '' },
    { id: 'committee', label: t('donors.committeeMember'), value: d => (d.isCommitteeMember ? 'Yes' : 'No') },
  ];

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const handleExport = () => setExportModalOpen(true);
  const handleExportSelected = () => {
    const selected = donors.filter(d => selectedIds.has(d.id));
    const csvContent = buildCsv(selected, donorExportColumns, donorExportColumns.map(c => c.id));
    downloadCsv(csvContent, `donors-selected-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const [importPreview, setImportPreview] = useState<{ toInsert: DonorInput[]; errors: ImportRowError[]; totalRows: number } | null>(null);
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
      const firstDataRow = /^[A-Za-z]/.test((rows[0][1] || '').trim()) ? 1 : 0;
      const imported: DonorInput[] = [];
      const rowErrors: ImportRowError[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const lineNum = i - firstDataRow + 1;
        const [unitNo, firstName, lastName, category, type, phone, whatsapp, email] = rows[i];
        if (!firstName || !firstName.trim()) {
          rowErrors.push({ line: lineNum, reason: 'First name is required' });
          continue;
        }
        imported.push({
          unitNo: (unitNo || '').trim(),
          firstName: firstName.trim(),
          lastName: (lastName || '').trim(),
          category: (category || 'general').trim() || 'general',
          type: (type || '').trim().toLowerCase() === 'tenant' ? 'tenant' : 'owner',
          phone: onlyDigits(phone || ''),
          whatsapp: onlyDigits(whatsapp || ''),
          email: (email || '').trim(),
          sameAsContact: false,
          isCommitteeMember: false,
        });
      }
      setImportPreview({ toInsert: imported, errors: rowErrors, totalRows: rows.length - firstDataRow });
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const created: Donor[] = [];
    for (const input of importPreview.toInsert) {
      try {
        created.push(await createDonorRequest(input));
      } catch {
        // skip row-level failures silently — already-validated rows only
      }
    }
    setDonors([...donors, ...created]);
    onLog('bulk_import', 'donors', `${t('common.importResult')}: ${created.length}`, created.length);
    setImportResults({
      totalRows: importPreview.totalRows,
      importedCount: created.length,
      insertedCount: created.length,
      updatedCount: 0,
      errors: importPreview.errors,
    });
    setImportPreview(null);
  };

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
                <Plus size={20} /> {t('donors.addDonor')}
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
                </div>
              )}
            </div>
          </div>
        }
      >
        {t('donors.pageTitle')}
      </PageHeading>

      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4">{t('donors.hint')}</p>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('donors.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredDonors.length}
          totalCount={donors.length}
          showPhone
          categoryOptions={DONOR_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
          typeOptions={[{ value: 'owner', label: t('donors.owner') }, { value: 'tenant', label: t('donors.tenant') }]}
          showUnitNo
          unitNoLabel={t('donors.unitNo')}
        />
      </CollapsibleSearchPanel>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <DataTableToolbar
          totalItems={donors.length}
          filteredItemsCount={filteredDonors.length}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          columns={donorColumns}
          isColumnVisible={tableCols.isColumnVisible}
          onToggleColumn={tableCols.toggleColumn}
          onResetColumns={tableCols.resetColumns}
          onShowAllColumns={tableCols.showAllColumns}
          sortState={tableCols.sortState}
          onClearSort={tableCols.resetSort}
          columnDropdown={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-all shadow-sm ${
                  selectMode
                    ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 text-orange-600 dark:text-orange-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {selectMode ? <CheckSquare size={15} className="shrink-0" /> : <Square size={15} className="shrink-0" />}
                <span>{t('table.select')}</span>
              </button>
              {canEdit && selectMode && selectedIds.size > 0 && (
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
            pageSelectedCount={pagination.pageItems.filter(d => selectedIds.has(d.id)).length}
            totalSelectedCount={selectedIds.size}
            totalFilteredCount={sortedDonors.length}
            onSelectAllFiltered={() => setSelectedIds(new Set(sortedDonors.map(d => d.id)))}
            onClear={() => setSelectedIds(new Set())}
          />
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {selectMode && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={pagination.pageItems.length > 0 && pagination.pageItems.every(d => selectedIds.has(d.id))}
                      onChange={() => {
                        const allChecked = pagination.pageItems.length > 0 && pagination.pageItems.every(d => selectedIds.has(d.id));
                        const next = new Set(selectedIds);
                        pagination.pageItems.forEach(d => (allChecked ? next.delete(d.id) : next.add(d.id)));
                        setSelectedIds(next);
                      }}
                    />
                  </th>
                )}
                {tableCols.isColumnVisible('unitNo') && (<SortableTh columnId="unitNo" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.unitNo')}</SortableTh>)}
                {tableCols.isColumnVisible('name') && (<SortableTh columnId="name" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.name')}</SortableTh>)}
                {tableCols.isColumnVisible('category') && (<SortableTh columnId="category" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.category')}</SortableTh>)}
                {tableCols.isColumnVisible('type') && (<SortableTh columnId="type" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.type')}</SortableTh>)}
                {tableCols.isColumnVisible('numPersons') && (<SortableTh columnId="numPersons" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.numPersons')}</SortableTh>)}
                {tableCols.isColumnVisible('phone') && (<SortableTh columnId="phone" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('common.phone')}</SortableTh>)}
                {tableCols.isColumnVisible('whatsapp') && (<SortableTh columnId="whatsapp" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.whatsapp')}</SortableTh>)}
                {tableCols.isColumnVisible('email') && (<SortableTh columnId="email" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.email')}</SortableTh>)}
                {tableCols.isColumnVisible('committee') && (<SortableTh columnId="committee" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.committeeMember')}</SortableTh>)}
                {tableCols.isColumnVisible('actions') && (
                  <th className="sticky right-0 z-10 px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                    {t('common.action')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {selectMode && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                  )}
                  {tableCols.isColumnVisible('unitNo') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{d.unitNo || '-'}</td>)}
                  {tableCols.isColumnVisible('name') && (
                    <td className="px-6 py-4 text-sm font-medium">
                      <button
                        onClick={() => setViewingDonorId(d.id)}
                        className="text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400 hover:underline text-left"
                      >
                        {donorFullName(d)}
                      </button>
                    </td>
                  )}
                  {tableCols.isColumnVisible('category') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{categoryLabel(d.category)}</td>)}
                  {tableCols.isColumnVisible('type') && (
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${d.type === 'owner' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {d.type === 'owner' ? t('donors.owner') : t('donors.tenant')}
                      </span>
                    </td>
                  )}
                  {tableCols.isColumnVisible('numPersons') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{d.numPersons ?? '-'}</td>)}
                  {tableCols.isColumnVisible('phone') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{d.phone || '-'}</td>)}
                  {tableCols.isColumnVisible('whatsapp') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{d.whatsapp || '-'}</td>)}
                  {tableCols.isColumnVisible('email') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{d.email || '-'}</td>)}
                  {tableCols.isColumnVisible('committee') && (
                    <td className="px-6 py-4 text-sm">
                      {d.isCommitteeMember ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{t('common.yes')}</span>
                      ) : '-'}
                    </td>
                  )}
                  {tableCols.isColumnVisible('actions') && (
                    <td className={`sticky right-0 px-6 py-4 text-right bg-white dark:bg-gray-900 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] ${openRowMenuId === d.id ? 'z-30' : 'z-10'}`}>
                      <div className="relative inline-block" ref={openRowMenuId === d.id ? rowMenuRef : undefined}>
                        <button
                          onClick={(e) => {
                            if (openRowMenuId === d.id) { setOpenRowMenuId(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRowMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setOpenRowMenuId(d.id);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openRowMenuId === d.id && rowMenuPos && createPortal(
                          <div ref={rowMenuPortalRef} style={{ position: 'fixed', top: rowMenuPos.top, right: rowMenuPos.right }} className="w-44 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]">
                            {canEdit && (
                              <button onClick={() => { setOpenRowMenuId(null); openEdit(d); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <Edit2 size={14} className="text-gray-400" /> {t('common.edit')}
                              </button>
                            )}
                            {canEdit && !d.isCommitteeMember && (
                              <button onClick={async () => { setOpenRowMenuId(null); await createCommitteeFromDonor(d); setDonors(donors.map(x => (x.id === d.id ? { ...x, isCommitteeMember: true } : x))); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <UserPlus size={14} className="text-gray-400" /> {t('donors.addToCommittee')}
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => { setOpenRowMenuId(null); setDeleteTarget(d); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <Trash2 size={14} /> {t('common.delete')}
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
          </table>
          {donors.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('donors.empty')}</div>
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
        <DonorFormModal
          donor={editingDonor}
          onCancel={() => { setShowForm(false); setEditingDonor(null); }}
          onSave={handleSave}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget ? donorFullName(deleteTarget) : ''}
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
        columns={donorExportColumns.map(c => ({ id: c.id, label: c.label }))}
        storageKey="puja_export_cols_donors"
        onClose={() => setExportModalOpen(false)}
        onExport={orderedIds => {
          const csvContent = buildCsv(donors, donorExportColumns, orderedIds);
          downloadCsv(csvContent, `donors-${new Date().toISOString().split('T')[0]}.csv`);
        }}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} type={toastType} />

      {viewingDonorId && (() => {
        const viewingDonor = donors.find(d => d.id === viewingDonorId);
        if (!viewingDonor) return null;
        return (
          <DonorDetailModal
            donor={viewingDonor}
            events={events}
            onClose={() => setViewingDonorId(null)}
            onAddCollection={(donorId) => { setViewingDonorId(null); onAddCollectionForDonor(donorId); }}
          />
        );
      })()}
    </div>
  );
}

export function DonorFormModal({
  donor, onCancel, onSave,
}: {
  donor: Donor | null;
  onCancel: () => void;
  onSave: (input: DonorInput, designation?: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const formRef = useRef<HTMLDivElement>(null);
  useAutoFocusFirstField(formRef);
  const [category, setCategory] = useState(donor?.category || 'general');
  const [type, setType] = useState<'owner' | 'tenant'>(donor?.type || 'owner');
  const [unitNo, setUnitNo] = useState(donor?.unitNo || '');
  const [numPersons, setNumPersons] = useState(donor?.numPersons !== null && donor?.numPersons !== undefined ? String(donor.numPersons) : '');
  const [firstName, setFirstName] = useState(donor?.firstName || '');
  const [lastName, setLastName] = useState(donor?.lastName || '');
  const [phone, setPhone] = useState(donor?.phone || '');
  const [sameAsContact, setSameAsContact] = useState(donor?.sameAsContact !== false);
  const [whatsapp, setWhatsapp] = useState(donor?.whatsapp || '');
  const [email, setEmail] = useState(donor?.email || '');
  const [relatedFlat, setRelatedFlat] = useState(donor?.relatedFlat || '');
  const [isCommitteeMember, setIsCommitteeMember] = useState(donor?.isCommitteeMember || false);
  const [designation, setDesignation] = useState('volunteer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!firstName.trim()) { setError(t('donors.firstNameRequired')); return; }
    if (!isPhoneValid(phone, false) || !isPhoneValid(whatsapp, false)) { setError(t('validation.phoneMinDigits')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        category, type, unitNo: unitNo.trim(), numPersons: numPersons.trim() !== '' ? parseInt(numPersons, 10) : null,
        firstName: firstName.trim(), lastName: lastName.trim(),
        phone: phone.trim(), whatsapp: sameAsContact ? phone.trim() : whatsapp.trim(), email: email.trim(),
        sameAsContact, relatedFlat: relatedFlat.trim(), isCommitteeMember,
      }, isCommitteeMember ? designation : undefined);
    } catch (err: any) {
      setError(err?.message || 'Failed to save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div ref={formRef} className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            {donor ? t('donors.editDonor') : t('donors.addDonor')}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.category')}</label>
              <CustomSelect value={category} onChange={setCategory} options={DONOR_CATEGORIES} className="py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.type')}</label>
              <div className="flex gap-2">
                {(['owner', 'tenant'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setType(opt)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      type === opt ? 'border-orange-600 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {opt === 'owner' ? t('donors.owner') : t('donors.tenant')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.unitNo')}</label>
              <input value={unitNo} onChange={e => setUnitNo(e.target.value)} placeholder={t('donors.unitNoPlaceholder')} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.numPersons')}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={numPersons}
                onChange={e => setNumPersons(onlyDigits(e.target.value))}
                placeholder={t('donors.numPersonsPlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.firstName')}<RequiredMark /></label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.lastName')}</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.email')} <span className="text-orange-500 font-normal">({t('common.optional')})</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('donors.alsoCommitteeMember')}</span>
              <ToggleSwitch checked={isCommitteeMember} onChange={setIsCommitteeMember} />
            </div>
            {isCommitteeMember && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('committee.designation')}</label>
                <CustomSelect value={designation} onChange={setDesignation} options={ROLES.map(r => ({ value: r.value, label: t(r.labelKey) }))} className="py-2.5 text-sm" />
              </div>
            )}
          </div>

          <Toast message={error || null} onDone={() => setError('')} type="error" />
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors">
            {saving ? '...' : donor ? t('common.save') : t('donors.addDonor')}
          </button>
        </div>
      </div>
    </div>
  );
}
