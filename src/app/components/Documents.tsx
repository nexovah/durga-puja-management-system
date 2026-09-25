import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Eye, X, FileUp, List, LayoutGrid, Info,
  Shield, FlameKindling, Landmark, Users, Zap, FileSignature, LandPlot, FileText,
} from 'lucide-react';
import { PageHeading } from './PageHeading';
import { Pagination, usePagination } from './Pagination';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import {
  AppDocument, DocumentCategory, ActivityModule,
  listDocumentsRequest, uploadDocumentFile, createDocumentRequest, deleteDocumentRequest,
} from '../lib/db';
import { User } from '../App';

interface DocumentsProps {
  currentUser: User | null;
  canEdit: boolean;
  canDelete: boolean;
  eventLabel?: string;
  onLog: (action: 'create' | 'delete', module: ActivityModule, summary: string, count?: number, changes?: any, recordLabel?: string) => void;
}

const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

const CATEGORIES: { key: DocumentCategory; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; fg: string; border: string }[] = [
  { key: 'police', label: 'Police', Icon: Shield, bg: 'bg-blue-50 dark:bg-blue-500/10', fg: 'text-blue-600 dark:text-blue-400', border: 'border-blue-400' },
  { key: 'fire', label: 'Fire dept.', Icon: FlameKindling, bg: 'bg-red-50 dark:bg-red-500/10', fg: 'text-red-600 dark:text-red-400', border: 'border-red-400' },
  { key: 'municipal', label: 'Municipal', Icon: Landmark, bg: 'bg-amber-50 dark:bg-amber-500/10', fg: 'text-amber-700 dark:text-amber-400', border: 'border-amber-400' },
  { key: 'committee', label: 'Society committee', Icon: Users, bg: 'bg-purple-50 dark:bg-purple-500/10', fg: 'text-purple-600 dark:text-purple-400', border: 'border-purple-400' },
  { key: 'electricity', label: 'Electricity', Icon: Zap, bg: 'bg-yellow-50 dark:bg-yellow-500/10', fg: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-400' },
  { key: 'mom', label: 'MOM (minutes)', Icon: FileSignature, bg: 'bg-cyan-50 dark:bg-cyan-500/10', fg: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-400' },
  { key: 'land', label: 'Land Permission', Icon: LandPlot, bg: 'bg-emerald-50 dark:bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-400' },
  { key: 'other', label: 'Other', Icon: FileText, bg: 'bg-gray-100 dark:bg-gray-800', fg: 'text-gray-600 dark:text-gray-400', border: 'border-gray-400' },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));
const categoryInfo = (k: DocumentCategory) => CATEGORY_MAP[k] || CATEGORIES[CATEGORIES.length - 1];

const toLocalDateTimeInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Event-scoped, unlike Assets — each Puja/Festival has its own government/
// committee permission paperwork (supabase/072_documents.sql).
export function Documents({ currentUser, canEdit, canDelete, eventLabel, onLog }: DocumentsProps) {
  const [docs, setDocs] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppDocument | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const reload = () => {
    setLoading(true);
    listDocumentsRequest()
      .then(setDocs)
      .catch(err => setError(err?.message || 'Failed to load documents'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

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
      setError(err?.message || 'Failed to delete');
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
                aria-label="List view"
                className={`p-2.5 transition-colors ${view === 'list' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setView('grid')}
                aria-label="Folder / thumbnail view"
                className={`p-2.5 border-l border-gray-300 dark:border-gray-600 transition-colors ${view === 'grid' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <FileUp size={20} /> Upload document
              </button>
            )}
          </div>
        }
      >
        Documents
      </PageHeading>

      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4 flex items-start gap-2.5 -mt-4">
        <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Keep government & committee permissions here — police NOC, fire clearance, municipal pandal permission, land permission, society resolution. Upload each as a PDF.
        </p>
      </div>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder="Search by document name"
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filtered.length}
          totalCount={docs.length}
          statusOptions={CATEGORIES.map(c => ({ value: c.key, label: c.label }))}
          statusLabel="Category"
          showDateRange
        />
      </CollapsibleSearchPanel>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm">No documents uploaded yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm">No documents match your search.</p>
          </div>
        ) : (
          <>
            {view === 'list' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6">
                {pagination.pageItems.map(doc => (
                  <DocumentListRow key={doc.id} doc={doc} canDelete={canDelete} onDelete={() => setDeleteTarget(doc)} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4 sm:p-6">
                {pagination.pageItems.map(doc => (
                  <DocumentThumb key={doc.id} doc={doc} canDelete={canDelete} onDelete={() => setDeleteTarget(doc)} />
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

function DocumentListRow({ doc, canDelete, onDelete }: { doc: AppDocument; canDelete: boolean; onDelete: () => void }) {
  const cat = categoryInfo(doc.category);
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
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
      <div className="flex items-center gap-3 shrink-0">
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600" aria-label="View">
          <Eye size={18} />
        </a>
        {canDelete && (
          <button onClick={onDelete} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400" aria-label="Delete">
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentThumb({ doc, canDelete, onDelete }: { doc: AppDocument; canDelete: boolean; onDelete: () => void }) {
  const cat = categoryInfo(doc.category);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
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
        <div className="flex items-center justify-end gap-3 pt-1">
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600" aria-label="View">
            <Eye size={16} />
          </a>
          {canDelete && (
            <button onClick={onDelete} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400" aria-label="Delete">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadDocumentModal({
  currentUser, eventLabel, onCancel, onUploaded,
}: {
  currentUser: User | null;
  eventLabel?: string;
  onCancel: () => void;
  onUploaded: (doc: AppDocument) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('police');
  const [file, setFile] = useState<File | null>(null);
  const [uploadedAt, setUploadedAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Please choose a PDF file.'); return; }
    if (f.size > DOCUMENT_MAX_BYTES) { setError('File is larger than 5 MB.'); return; }
    setError('');
    setFile(f);
  };

  const handleUpload = async () => {
    if (!name.trim()) { setError('Document name is required.'); return; }
    if (!file) { setError('Please choose a PDF file.'); return; }
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
      setError(err?.message || 'Failed to upload — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileUp size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Upload document</h3>
            {eventLabel && <p className="text-xs text-gray-400 dark:text-gray-500">{eventLabel} · permissions & approvals</p>}
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Document name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Police NOC, pandal & procession"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Issued by / category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map(c => (
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Uploaded at</label>
            <input
              type="datetime-local"
              value={uploadedAt}
              onChange={e => setUploadedAt(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">PDF file</label>
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
                Choose a PDF (max 5 MB)
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
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={saving}
            className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      </div>
    </div>
  );
}
