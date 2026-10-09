import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Upload, Edit2, Trash2, Plus, X, MoreVertical, CheckSquare, Square, User as UserIcon } from 'lucide-react';
import {
  Donor, CommitteeMember, CommitteeMemberInput,
  ActivityModule, ActivityFieldChange,
  listCommitteeMembersRequest, createCommitteeMemberRequest, updateCommitteeMemberRequest, deleteCommitteeMemberRequest, fromCommitteeMemberRow,
} from '../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { PageHeading } from './PageHeading';
import { SelectAllBanner } from './SelectAllBanner';
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
import { useTableColumns, SortableTh, DataTableToolbar, ColumnDef, ColumnVisibilityDropdown } from './TableColumnManager';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { onlyDigits, isPhoneValid } from '../lib/validation';
import { rankSearchMatches } from '../lib/searchRank';
import { useAutoFocusFirstField } from '../lib/useAutoFocusFirstField';
import { donorFullName } from './Donors';

interface CommitteeProps {
  donors: Donor[];
  committeeMembers: CommitteeMember[];
  setCommitteeMembers: (members: CommitteeMember[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: ActivityModule, summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
  // Bumped by App.tsx's global Cmd/Ctrl+M shortcut to pop the Add form open
  // on arrival at this page, same convention as ChandaCollection's
  // initialAddRequestId.
  initialAddRequestId?: number;
}

export const ROLES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'president', labelKey: 'members.role.president' },
  { value: 'vicePresident', labelKey: 'members.role.vicePresident' },
  { value: 'secretary', labelKey: 'members.role.secretary' },
  { value: 'assistantSecretary', labelKey: 'members.role.assistantSecretary' },
  { value: 'treasurer', labelKey: 'members.role.treasurer' },
  { value: 'accountant', labelKey: 'members.role.accountant' },
  { value: 'executiveMember', labelKey: 'members.role.executiveMember' },
  { value: 'advisoryPatron', labelKey: 'members.role.advisoryPatron' },
  { value: 'volunteer', labelKey: 'members.role.volunteer' },
  { value: 'chiefAdviser', labelKey: 'members.role.chiefAdviser' },
  { value: 'adviser', labelKey: 'members.role.adviser' },
];

function committeeFullName(m: { firstName: string; lastName: string }): string {
  return [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
}

export function Committee({ donors, committeeMembers, setCommitteeMembers, canEdit, canDelete, canBulkImport, onLog, initialAddRequestId }: CommitteeProps) {
  const { t } = useLanguage();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<CommitteeMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommitteeMember | null>(null);
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

  useEffect(() => {
    listCommitteeMembersRequest().then(setCommitteeMembers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtimeSync(true, 'committee_members', setCommitteeMembers, fromCommitteeMemberRow);

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

  const roleLabel = (value: string) => {
    const found = ROLES.find(r => r.value === value);
    return found ? t(found.labelKey) : value;
  };

  const openCreate = () => { setEditingMember(null); setShowForm(true); };

  useEffect(() => {
    if (initialAddRequestId && initialAddRequestId > 0) {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddRequestId]);
  const openEdit = (m: CommitteeMember) => { setEditingMember(m); setShowForm(true); };

  const handleSave = async (input: CommitteeMemberInput) => {
    if (editingMember) {
      const updated = await updateCommitteeMemberRequest(editingMember.id, input);
      setCommitteeMembers(committeeMembers.map(m => (m.id === updated.id ? updated : m)));
      onLog('update', 'committee', committeeFullName(updated), undefined, undefined, committeeFullName(updated));
    } else {
      const created = await createCommitteeMemberRequest(input);
      setCommitteeMembers([...committeeMembers, created]);
      onLog('create', 'committee', committeeFullName(created), undefined, undefined, committeeFullName(created));
    }
    setShowForm(false);
    setEditingMember(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCommitteeMemberRequest(deleteTarget.id);
    setCommitteeMembers(committeeMembers.filter(m => m.id !== deleteTarget.id));
    onLog('delete', 'committee', committeeFullName(deleteTarget), undefined, undefined, committeeFullName(deleteTarget));
    setToastType('success');
    setToastMessage(t('common.deletedSuccess'));
    setDeleteTarget(null);
  };

  const filteredMembers = committeeMembers.filter(m => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [committeeFullName(m), m.phone, m.email, roleLabel(m.designation)]
        .some(p => p && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }
    const f = appliedFilters;
    if (f.designation && m.designation !== f.designation) return false;
    if (f.phone && !(m.phone || '').includes(f.phone.trim())) return false;
    return true;
  });

  const committeeColumns: ColumnDef<CommitteeMember>[] = useMemo(() => [
    { id: 'name', label: t('common.name'), required: true, sortValue: m => committeeFullName(m) },
    { id: 'designation', label: t('members.role'), sortValue: m => roleLabel(m.designation) },
    { id: 'phone', label: t('common.phone'), sortValue: m => m.phone || '' },
    { id: 'whatsapp', label: t('donors.whatsapp'), defaultVisible: false, sortValue: m => m.whatsapp || '' },
    { id: 'email', label: t('donors.email'), defaultVisible: false, sortValue: m => m.email || '' },
    { id: 'source', label: t('committee.source'), sortValue: m => (m.donorId ? 1 : 0) },
    ...((canEdit || canDelete) ? [{ id: 'actions', label: t('common.action'), required: true, sortable: false, align: 'right' as const }] : []),
  ], [t, canEdit, canDelete]);

  const tableCols = useTableColumns<CommitteeMember>({
    tableId: 'committee',
    columns: committeeColumns,
    defaultSort: { columnId: 'name', direction: 'asc' },
  });

  const sortedMembers = useMemo(() => tableCols.sortItems(filteredMembers), [tableCols, filteredMembers]);
  const pagination = usePagination(sortedMembers);

  const committeeExportColumns: ExportColumnDef<CommitteeMember>[] = [
    { id: 'firstName', label: t('donors.firstName'), value: m => m.firstName },
    { id: 'lastName', label: t('donors.lastName'), value: m => m.lastName },
    { id: 'designation', label: t('members.role'), value: m => roleLabel(m.designation) },
    { id: 'phone', label: t('common.phone'), value: m => m.phone || '' },
    { id: 'whatsapp', label: t('donors.whatsapp'), value: m => m.whatsapp || '' },
    { id: 'email', label: t('donors.email'), value: m => m.email || '' },
    { id: 'relatedFlat', label: t('donors.relatedFlat'), value: m => m.relatedFlat || '' },
    { id: 'source', label: t('committee.source'), value: m => (m.donorId ? t('committee.fromDonor') : t('committee.standalone')) },
  ];

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const handleExport = () => setExportModalOpen(true);
  const handleExportSelected = () => {
    const selected = committeeMembers.filter(m => selectedIds.has(m.id));
    const csvContent = buildCsv(selected, committeeExportColumns, committeeExportColumns.map(c => c.id));
    downloadCsv(csvContent, `committee-selected-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const [importPreview, setImportPreview] = useState<{ toInsert: CommitteeMemberInput[]; errors: ImportRowError[]; totalRows: number } | null>(null);
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
      const imported: CommitteeMemberInput[] = [];
      const rowErrors: ImportRowError[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const lineNum = i - firstDataRow + 1;
        const [firstName, lastName, designation, phone, whatsapp, email] = rows[i];
        if (!firstName || !firstName.trim()) {
          rowErrors.push({ line: lineNum, reason: 'First name is required' });
          continue;
        }
        imported.push({
          firstName: firstName.trim(),
          lastName: (lastName || '').trim(),
          designation: (designation || 'volunteer').trim() || 'volunteer',
          phone: onlyDigits(phone || ''),
          whatsapp: onlyDigits(whatsapp || ''),
          email: (email || '').trim(),
          isActive: true,
        });
      }
      setImportPreview({ toInsert: imported, errors: rowErrors, totalRows: rows.length - firstDataRow });
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const created: CommitteeMember[] = [];
    for (const input of importPreview.toInsert) {
      try {
        created.push(await createCommitteeMemberRequest(input));
      } catch {
        // skip row-level failures silently — already-validated rows only
      }
    }
    setCommitteeMembers([...committeeMembers, ...created]);
    onLog('bulk_import', 'committee', `${t('common.importResult')}: ${created.length}`, created.length);
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
                <Plus size={20} /> {t('committee.addMember')}
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
        {t('committee.pageTitle')}
      </PageHeading>

      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4">{t('committee.hint')}</p>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('committee.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredMembers.length}
          totalCount={committeeMembers.length}
          showPhone
          designationOptions={ROLES.map(r => ({ value: r.value, label: t(r.labelKey) }))}
        />
      </CollapsibleSearchPanel>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <DataTableToolbar
          totalItems={committeeMembers.length}
          filteredItemsCount={filteredMembers.length}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          columns={committeeColumns}
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
            pageSelectedCount={pagination.pageItems.filter(m => selectedIds.has(m.id)).length}
            totalSelectedCount={selectedIds.size}
            totalFilteredCount={sortedMembers.length}
            onSelectAllFiltered={() => setSelectedIds(new Set(sortedMembers.map(m => m.id)))}
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
                      checked={pagination.pageItems.length > 0 && pagination.pageItems.every(m => selectedIds.has(m.id))}
                      onChange={() => {
                        const allChecked = pagination.pageItems.length > 0 && pagination.pageItems.every(m => selectedIds.has(m.id));
                        const next = new Set(selectedIds);
                        pagination.pageItems.forEach(m => (allChecked ? next.delete(m.id) : next.add(m.id)));
                        setSelectedIds(next);
                      }}
                    />
                  </th>
                )}
                {tableCols.isColumnVisible('name') && (<SortableTh columnId="name" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('common.name')}</SortableTh>)}
                {tableCols.isColumnVisible('designation') && (<SortableTh columnId="designation" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('members.role')}</SortableTh>)}
                {tableCols.isColumnVisible('phone') && (<SortableTh columnId="phone" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('common.phone')}</SortableTh>)}
                {tableCols.isColumnVisible('whatsapp') && (<SortableTh columnId="whatsapp" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.whatsapp')}</SortableTh>)}
                {tableCols.isColumnVisible('email') && (<SortableTh columnId="email" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('donors.email')}</SortableTh>)}
                {tableCols.isColumnVisible('source') && (<SortableTh columnId="source" sortState={tableCols.sortState} onToggleSort={tableCols.toggleSort}>{t('committee.source')}</SortableTh>)}
                {tableCols.isColumnVisible('actions') && (
                  <th className="sticky right-0 z-10 px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                    {t('common.action')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {selectMode && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                  )}
                  {tableCols.isColumnVisible('name') && (<td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200 font-medium">{committeeFullName(m)}</td>)}
                  {tableCols.isColumnVisible('designation') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{roleLabel(m.designation)}</td>)}
                  {tableCols.isColumnVisible('phone') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{m.phone || '-'}</td>)}
                  {tableCols.isColumnVisible('whatsapp') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{m.whatsapp || '-'}</td>)}
                  {tableCols.isColumnVisible('email') && (<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{m.email || '-'}</td>)}
                  {tableCols.isColumnVisible('source') && (
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${m.donorId ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                        {m.donorId ? t('committee.fromDonor') : t('committee.standalone')}
                      </span>
                    </td>
                  )}
                  {tableCols.isColumnVisible('actions') && (
                    <td className={`sticky right-0 px-6 py-4 text-right bg-white dark:bg-gray-900 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] ${openRowMenuId === m.id ? 'z-30' : 'z-10'}`}>
                      <div className="relative inline-block" ref={openRowMenuId === m.id ? rowMenuRef : undefined}>
                        <button
                          onClick={(e) => {
                            if (openRowMenuId === m.id) { setOpenRowMenuId(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRowMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setOpenRowMenuId(m.id);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openRowMenuId === m.id && rowMenuPos && createPortal(
                          <div ref={rowMenuPortalRef} style={{ position: 'fixed', top: rowMenuPos.top, right: rowMenuPos.right }} className="w-36 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]">
                            {canEdit && (
                              <button onClick={() => { setOpenRowMenuId(null); openEdit(m); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <Edit2 size={14} className="text-gray-400" /> {t('common.edit')}
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => { setOpenRowMenuId(null); setDeleteTarget(m); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
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
          {committeeMembers.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('committee.empty')}</div>
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
        <CommitteeFormModal
          member={editingMember}
          donors={donors}
          onCancel={() => { setShowForm(false); setEditingMember(null); }}
          onSave={handleSave}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget ? committeeFullName(deleteTarget) : ''}
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
        columns={committeeExportColumns.map(c => ({ id: c.id, label: c.label }))}
        storageKey="puja_export_cols_committee"
        onClose={() => setExportModalOpen(false)}
        onExport={orderedIds => {
          const csvContent = buildCsv(committeeMembers, committeeExportColumns, orderedIds);
          downloadCsv(csvContent, `committee-${new Date().toISOString().split('T')[0]}.csv`);
        }}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} type={toastType} />
    </div>
  );
}

type AddTab = 'fromDonor' | 'new';

function CommitteeFormModal({
  member, donors, onCancel, onSave,
}: {
  member: CommitteeMember | null;
  donors: Donor[];
  onCancel: () => void;
  onSave: (input: CommitteeMemberInput) => Promise<void>;
}) {
  const { t } = useLanguage();
  const formRef = useRef<HTMLDivElement>(null);
  useAutoFocusFirstField(formRef);
  const [tab, setTab] = useState<AddTab>(member ? 'new' : 'fromDonor');
  const [donorQuery, setDonorQuery] = useState('');
  const [pickedDonor, setPickedDonor] = useState<Donor | null>(member?.donorId ? donors.find(d => d.id === member.donorId) || null : null);
  const [designation, setDesignation] = useState(member?.designation || 'volunteer');
  const [firstName, setFirstName] = useState(member?.firstName || '');
  const [lastName, setLastName] = useState(member?.lastName || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [sameAsContact, setSameAsContact] = useState(!member?.whatsapp || member.whatsapp === member?.phone);
  const [whatsapp, setWhatsapp] = useState(member?.whatsapp || '');
  const [email, setEmail] = useState(member?.email || '');
  const [relatedFlat, setRelatedFlat] = useState(member?.relatedFlat || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const matchingDonors = useMemo(() => {
    return rankSearchMatches(donors, donorQuery, d => donorFullName(d), d => [d.unitNo]);
  }, [donorQuery, donors]);

  const handleSave = async () => {
    if (!isPhoneValid(phone, false) || !isPhoneValid(whatsapp, false)) { setError(t('validation.phoneMinDigits')); return; }

    if (tab === 'fromDonor') {
      if (!pickedDonor) { setError(t('committee.pickDonorRequired')); return; }
      setSaving(true);
      setError('');
      try {
        await onSave({
          donorId: pickedDonor.id,
          designation,
          firstName: pickedDonor.firstName,
          lastName: pickedDonor.lastName,
          phone: pickedDonor.phone,
          whatsapp: pickedDonor.whatsapp,
          email: pickedDonor.email,
          isActive: true,
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to save — please try again.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!firstName.trim()) { setError(t('donors.firstNameRequired')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        donorId: member ? member.donorId : null,
        designation,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        whatsapp: sameAsContact ? phone.trim() : whatsapp.trim(),
        email: email.trim(),
        relatedFlat: relatedFlat.trim(),
        isActive: true,
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
            <UserIcon size={20} />
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('committee.addMember')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('committee.addMemberHint')}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {!member && (
          <div className="px-6 pt-5">
            <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-1 gap-1">
              <button
                type="button"
                onClick={() => setTab('fromDonor')}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${tab === 'fromDonor' ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
              >
                {t('committee.chooseFromMembers')}
              </button>
              <button
                type="button"
                onClick={() => setTab('new')}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${tab === 'new' ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
              >
                {t('committee.addNewPerson')}
              </button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-4">
          {tab === 'fromDonor' && !member ? (
            <>
              <p className="text-sm bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 rounded-lg p-3">
                {t('committee.chooseFromMembersHint')}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('committee.pickMember')}</label>
                {pickedDonor ? (
                  <div className="flex items-start justify-between gap-3 px-4 py-3 border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 rounded-lg">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {donorFullName(pickedDonor).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {pickedDonor.unitNo ? `${pickedDonor.unitNo} · ` : ''}{donorFullName(pickedDonor)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {[
                            pickedDonor.type === 'owner' ? t('donors.owner') : t('donors.tenant'),
                            pickedDonor.numPersons !== null && pickedDonor.numPersons !== undefined ? `${pickedDonor.numPersons} ${t('donors.numPersons')}` : null,
                            pickedDonor.phone || null,
                            pickedDonor.email || null,
                          ].filter(Boolean).map((part, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                              {i > 0 && <span className="text-gray-400 dark:text-gray-600">·</span>}
                              {part}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setPickedDonor(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={donorQuery}
                      onChange={e => setDonorQuery(e.target.value)}
                      placeholder={t('committee.searchFlatName')}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                    {matchingDonors.length > 0 && (
                      <div className="mt-1.5 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        {matchingDonors.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => { setPickedDonor(d); setDonorQuery(''); }}
                            className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-left hover:bg-orange-50 dark:hover:bg-orange-500/10"
                          >
                            <span className="text-gray-800 dark:text-gray-200">{donorFullName(d)}</span>
                            <span className="text-gray-400">{d.unitNo || ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('committee.designation')}</label>
                <CustomSelect value={designation} onChange={setDesignation} options={ROLES.map(r => ({ value: r.value, label: t(r.labelKey) }))} className="py-2.5 text-sm" />
              </div>
            </>
          ) : (
            <>
              {!member && (
                <p className="text-sm bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 rounded-lg p-3">
                  {t('committee.addNewPersonHint')}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('committee.designation')}</label>
                <CustomSelect value={designation} onChange={setDesignation} options={ROLES.map(r => ({ value: r.value, label: t(r.labelKey) }))} className="py-2.5 text-sm" />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('donors.relatedFlat')} <span className="text-orange-500 font-normal">({t('donors.relatedFlatHint')})</span></label>
                <input value={relatedFlat} onChange={e => setRelatedFlat(e.target.value)} placeholder={t('donors.unitNoPlaceholder')} className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none" />
              </div>
            </>
          )}

          <Toast message={error || null} onDone={() => setError('')} type="error" />
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors">
            {saving ? '...' : member ? t('common.save') : t('committee.addToCommittee')}
          </button>
        </div>
      </div>
    </div>
  );
}
