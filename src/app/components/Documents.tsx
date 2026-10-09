import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Plus, Trash2, Eye, X, FileUp, List, LayoutGrid, Info,
  Shield, FlameKindling, Landmark, Users, Zap, FileSignature, LandPlot, FileText, MoreVertical, Square, CheckSquare,
} from 'lucide-react';
import { PageHeading } from './PageHeading';
import { Pagination, usePagination } from './Pagination';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SelectAllBanner } from './SelectAllBanner';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import {
  AppDocument, DocumentCategory, ActivityModule,
  uploadDocumentFile, createDocumentRequest, deleteDocumentRequest, fromDocumentRow,
} from '../lib/db';
import { User } from '../App';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface DocumentsProps {
  documents: AppDocument[];
  setDocuments: (d: AppDocument[] | ((prev: AppDocument[]) => AppDocument[])) => void;
  currentUser: User | null;
  canEdit: boolean;
  canDelete: boolean;
  eventLabel?: string;
  onLog: (action: 'create' | 'delete', module: ActivityModule, summary: string, count?: number, changes?: any, recordLabel?: string) => void;
}

const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

const CATEGORY_KEYS: { key: DocumentCategory; labelKey: TranslationKey; Icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; fg: string; border: string }[] = [
  { key: 'police', labelKey: 'documents.category.police', Icon: Shield, bg: 'bg-blue-50 dark:bg-blue-500/10', fg: 'text-blue-600 dark:text-blue-400', border: 'border-blue-400' },
  { key: 'fire', labelKey: 'documents.category.fire', Icon: FlameKindling, bg: 'bg-red-50 dark:bg-red-500/10', fg: 'text-red-600 dark:text-red-400', border: 'border-red-400' },
  { key: 'municipal', labelKey: 'documents.category.municipal', Icon: Landmark, bg: 'bg-amber-50 dark:bg-amber-500/10', fg: 'text-amber-700 dark:text-amber-400', border: 'border-amber-400' },
  { key: 'committee', labelKey: 'documents.category.committee', Icon: Users, bg: 'bg-green-50 dark:bg-green-500/10', fg: 'text-green-600 dark:text-green-400', border: 'border-green-400' },
  { key: 'electricity', labelKey: 'documents.category.electricity', Icon: Zap, bg: 'bg-yellow-50 dark:bg-yellow-500/10', fg: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-400' },
  { key: 'mom', labelKey: 'documents.category.mom', Icon: FileSignature, bg: 'bg-cyan-50 dark:bg-cyan-500/10', fg: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-400' },
  { key: 'land', labelKey: 'documents.category.land', Icon: LandPlot, bg: 'bg-emerald-50 dark:bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-400' },
  { key: 'other', labelKey: 'documents.category.other', Icon: FileText, bg: 'bg-gray-100 dark:bg-gray-800', fg: 'text-gray-600 dark:text-gray-400', border: 'border-gray-400' },
];

const toLocalDateTimeInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Event-scoped, unlike Assets — each Puja/Festival has its own government/
// committee permission paperwork (supabase/072_documents.sql).
export function Documents({ documents: docs, setDocuments: setDocs, currentUser, canEdit, canDelete, eventLabel, onLog }: DocumentsProps) {
  const { t } = useLanguage();
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppDocument | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categories = useMemo(() => CATEGORY_KEYS.map(c => ({
    ...c,
    label: t(c.labelKey),
  })), [t]);

  const getCategoryInfo = (k: DocumentCategory) => categories.find(c => c.key === k) || categories[categories.length - 1];

  // documents now comes from App.tsx (loaded once centrally so it survives
  // navigation/offline) — no local fetch-on-mount needed here.
  useRealtimeSync(true, 'documents', setDocs, fromDocumentRow);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return docs.filter(d => {
      if (q && !d.name.toLowerCase().includes(q)) return false;
      if (appliedFilters.status && d.category !== appliedFilters.status) return false;
      if (appliedFilters.dateFrom && d.uploadedAt.slice(0, 10) < appliedFilters.dateFrom) return false;
      if (appliedFilters.dateTo && d.uploadedAt.slice(0, 10) > appliedFilters.dateTo) return false;
      return true;
    });
  }, [docs, searchQuery, appliedFilters]);

  const pagination = usePagination(filtered);

  const handleUploaded = (doc: AppDocument) => {
    setDocs(prev => [doc, ...prev]);
    onLog('create', 'documents', doc.name, undefined, undefined, doc.name);
    setShowUpload(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocumentRequest(deleteTarget.id);
      setDocs(prev => prev.filter(d => d.id !== deleteTarget.id));
      onLog('delete', 'documents', deleteTarget.name, undefined, undefined, deleteTarget.name);
    } catch (err: any) {
      setError(err?.message || t('documents.validation.deleteFailed'));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setView('list')}
                aria-label={t('documents.viewList')}
                className={`p-2.5 transition-colors ${view === 'list' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setView('grid')}
                aria-label={t('documents.viewGrid')}
                className={`p-2.5 border-l border-gray-300 dark:border-gray-600 transition-colors ${view === 'grid' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
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
            {canEdit && (
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <FileUp size={20} /> {t('documents.uploadDoc')}
              </button>
            )}
          </div>
        }
      >
        {t('documents.pageTitle')}
      </PageHeading>

      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4 flex items-start gap-2.5 -mt-4">
        <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          {t('documents.info')}
        </p>
      </div>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('documents.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filtered.length}
          totalCount={docs.length}
          statusOptions={categories.map(c => ({ value: c.key, label: c.label }))}
          statusLabel={t('documents.category')}
          showDateRange
        />
      </CollapsibleSearchPanel>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {selectMode && (
        <SelectAllBanner
          pageSelectedCount={pagination.pageItems.filter(d => selectedIds.has(d.id)).length}
          totalSelectedCount={selectedIds.size}
          totalFilteredCount={filtered.length}
          onSelectAllFiltered={() => setSelectedIds(new Set(filtered.map(d => d.id)))}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        {docs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm">{t('documents.empty')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm">{t('documents.noMatch')}</p>
          </div>
        ) : (
          <>
            {view === 'list' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6">
                {pagination.pageItems.map(doc => (
                  <DocumentListRow
                    key={doc.id}
                    doc={doc}
                    categoryInfo={getCategoryInfo(doc.category)}
                    canDelete={canDelete}
                    onDelete={() => setDeleteTarget(doc)}
                    selectMode={selectMode}
                    selected={selectedIds.has(doc.id)}
                    onToggleSelect={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(doc.id);
                      else next.delete(doc.id);
                      setSelectedIds(next);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4 sm:p-6">
                {pagination.pageItems.map(doc => (
                  <DocumentThumb
                    key={doc.id}
                    doc={doc}
                    categoryInfo={getCategoryInfo(doc.category)}
                    canDelete={canDelete}
                    onDelete={() => setDeleteTarget(doc)}
                    selectMode={selectMode}
                    selected={selectedIds.has(doc.id)}
                    onToggleSelect={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(doc.id);
                      else next.delete(doc.id);
                      setSelectedIds(next);
                    }}
                  />
                ))}
              </div>
            )}

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
      </div>

      {showUpload && (
        <UploadDocumentModal
          currentUser={currentUser}
          eventLabel={eventLabel}
          categories={categories}
          onCancel={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function DocumentListRow({
  doc, categoryInfo, canDelete, onDelete, selectMode, selected, onToggleSelect,
}: {
  doc: AppDocument;
  categoryInfo: { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; fg: string; border: string };
  canDelete: boolean;
  onDelete: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
}) {
  const { t } = useLanguage();
  const cat = categoryInfo;
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      {selectMode && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onToggleSelect?.(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500 shrink-0"
        />
      )}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cat.bg} ${cat.fg}`}>
        <cat.Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-bold text-gray-800 dark:text-gray-200 truncate">{doc.name}</h4>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cat.bg} ${cat.fg}`}>{cat.label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{doc.uploadedByName} · {new Date(doc.uploadedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
      <DocumentRowMenu doc={doc} canDelete={canDelete} onDelete={onDelete} />
    </div>
  );
}

function DocumentRowMenu({ doc, canDelete, onDelete }: { doc: AppDocument; canDelete: boolean; onDelete: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Eye size={14} className="text-orange-500" /> {t('documents.view')}
          </a>
          {canDelete && (
            <button onClick={() => { setOpen(false); onDelete(); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 size={14} /> {t('documents.delete')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentThumb({
  doc, categoryInfo, canDelete, onDelete, selectMode, selected, onToggleSelect,
}: {
  doc: AppDocument;
  categoryInfo: { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; fg: string; border: string };
  canDelete: boolean;
  onDelete: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
}) {
  const { t } = useLanguage();
  const cat = categoryInfo;
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col relative">
      {selectMode && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onToggleSelect?.(e.target.checked)}
          className="absolute top-2 left-2 z-10 rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
        />
      )}
      <a
        href={doc.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`h-16 flex items-center justify-center ${cat.bg} ${cat.fg} hover:opacity-80 transition-opacity`}
      >
        <FileText size={22} />
      </a>
      <div className="p-3 space-y-1.5">
        <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate" title={doc.name}>{doc.name}</h4>
        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${cat.bg} ${cat.fg}`}>{cat.label}</span>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{doc.uploadedByName} · {new Date(doc.uploadedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        <div className="flex items-center justify-end pt-1">
          <DocumentRowMenu doc={doc} canDelete={canDelete} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}

function UploadDocumentModal({
  currentUser, eventLabel, categories, onCancel, onUploaded,
}: {
  currentUser: User | null;
  eventLabel?: string;
  categories: { key: DocumentCategory; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; fg: string; border: string }[];
  onCancel: () => void;
  onUploaded: (doc: AppDocument) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('police');
  const [file, setFile] = useState<File | null>(null);
  const [uploadedAt, setUploadedAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { setError(t('documents.validation.choosePdf')); return; }
    if (f.size > DOCUMENT_MAX_BYTES) { setError(t('documents.validation.fileTooLarge')); return; }
    setError('');
    setFile(f);
  };

  const handleUpload = async () => {
    if (!name.trim()) { setError(t('documents.validation.nameRequired')); return; }
    if (!file) { setError(t('documents.validation.choosePdf')); return; }
    if (!currentUser) return;
    setSaving(true);
    setError('');
    try {
      const fileUrl = await uploadDocumentFile(file);
      const doc = await createDocumentRequest({
        name: name.trim(),
        category,
        fileUrl,
        fileSizeBytes: file.size,
        uploadedByUserId: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedAt: new Date(uploadedAt).toISOString(),
      });
      onUploaded(doc);
    } catch (err: any) {
      setError(err?.message || t('documents.validation.uploadFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileUp size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('documents.modal.title')}</h3>
            {eventLabel && <p className="text-xs text-gray-400 dark:text-gray-500">{eventLabel} · {t('documents.modal.eventSubtitle')}</p>}
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('documents.modal.name')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('documents.modal.namePlaceholder')}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('documents.modal.categoryLabel')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    category === c.key ? `${c.border} ${c.bg} ${c.fg}` : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <c.Icon size={16} className="shrink-0" />
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('documents.modal.uploadedAt')}</label>
            <input
              type="datetime-local"
              value={uploadedAt}
              onChange={e => setUploadedAt(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('documents.modal.pdfFile')}</label>
            {file ? (
              <div className="flex items-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <FileText size={18} className="text-orange-600 dark:text-orange-400 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:border-orange-400">
                <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <FileUp size={16} />
                </div>
                {t('documents.modal.choosePdf')}
                <input type="file" accept="application/pdf" onChange={handlePickFile} className="hidden" />
              </label>
            )}
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
            onClick={handleUpload}
            disabled={saving}
            className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {saving ? t('documents.uploading') : t('documents.uploadDoc')}
          </button>
        </div>
      </div>
    </div>
  );
}
