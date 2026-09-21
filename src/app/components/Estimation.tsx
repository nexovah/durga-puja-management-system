import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, ArrowLeft, Save, Calculator, GripVertical, Printer } from 'lucide-react';
import { Estimation, EstimationLineItem, EstimationColumnLabels } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { Pagination, usePagination } from './Pagination';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';

interface EstimationPageProps {
  estimationsList: Estimation[];
  setEstimationsList: (list: Estimation[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string;
  currentUserName: string;
  committeeAssociation: string;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'estimation', summary: string, count?: number) => void;
}

const emptyLineItem = (): EstimationLineItem => ({
  id: crypto.randomUUID(),
  title: '',
  customField: '',
  customField2: '',
  amount: 0,
});

const defaultColumnLabels = (t: (key: any) => string): EstimationColumnLabels => ({
  serialNo: t('estimation.serialNo'),
  title: t('estimation.itemTitle'),
  customField: t('estimation.customFieldDefault'),
  customField2: t('estimation.customField2Default'),
  amount: t('estimation.amount'),
});

const totalAmount = (est: Estimation) => est.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

const OPEN_ESTIMATION_KEY = 'puja-open-estimation-id';

// Budgeting/projection tool, separate from the actual Expenses module.
// List view (like Tasks) of named estimations; clicking one opens a
// full-width in-page detail view (not a modal — the unlimited-rows editor
// needs more room than FormModal gives) with an editable line-item table
// and a live-computed total.
export function EstimationPage({
  estimationsList, setEstimationsList, canEdit, canDelete, currentUserId, currentUserName, committeeAssociation, onLog,
}: EstimationPageProps) {
  const { t, locale } = useLanguage();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [draft, setDraft] = useState<Estimation | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Estimation | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [rowSearchQuery, setRowSearchQuery] = useState('');
  const [rowShowSearch, setRowShowSearch] = useState(false);

  const filteredEstimations = estimationsList.filter(est =>
    !searchQuery.trim() || est.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const sortedEstimations = [...filteredEstimations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const pagination = usePagination(sortedEstimations);

  const openNew = () => {
    setDraft({
      id: crypto.randomUUID(),
      title: '',
      lineItems: [emptyLineItem()],
      columnLabels: defaultColumnLabels(t),
      createdAt: new Date().toISOString(),
      createdBy: currentUserId,
      createdByName: currentUserName,
    });
    setIsNew(true);
    setRowSearchQuery('');
    setView('detail');
  };

  const openExisting = (est: Estimation) => {
    setDraft({
      ...est,
      lineItems: est.lineItems.map(item => ({ customField: '', customField2: '', ...item })),
      columnLabels: est.columnLabels || defaultColumnLabels(t),
    });
    setIsNew(false);
    setRowSearchQuery('');
    setView('detail');
    try {
      sessionStorage.setItem(OPEN_ESTIMATION_KEY, est.id);
    } catch {
      // sessionStorage unavailable — just means a refresh won't restore the open page
    }
  };

  const backToList = () => {
    setDraft(null);
    setView('list');
    try {
      sessionStorage.removeItem(OPEN_ESTIMATION_KEY);
    } catch {
      // ignore
    }
  };

  // Restore the open detail page across a refresh — the list<->detail
  // switch is local component state, not part of the URL, so without this
  // reloading the page always dropped back to the list. Only restores
  // *existing, saved* estimations (never an unsaved "new" draft), and only
  // once estimationsList has actually loaded from Supabase.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || view !== 'list' || estimationsList.length === 0) return;
    restoredRef.current = true;
    let openId: string | null = null;
    try {
      openId = sessionStorage.getItem(OPEN_ESTIMATION_KEY);
    } catch {
      openId = null;
    }
    if (!openId) return;
    const match = estimationsList.find(est => est.id === openId);
    if (match) openExisting(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimationsList]);

  const updateDraftItem = (itemId: string, patch: Partial<EstimationLineItem>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      lineItems: draft.lineItems.map(item => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  };

  const addRow = () => {
    if (!draft) return;
    setDraft({ ...draft, lineItems: [...draft.lineItems, emptyLineItem()] });
  };

  const removeRow = (itemId: string) => {
    if (!draft) return;
    setDraft({ ...draft, lineItems: draft.lineItems.filter(item => item.id !== itemId) });
  };

  // Drag-and-drop row reordering — serial numbers are just each row's
  // position in the array (index + 1), so moving an item automatically
  // renumbers everything, no separate "order" field to keep in sync.
  const moveRow = (from: number, to: number) => {
    if (!draft || from === to) return;
    const items = [...draft.lineItems];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    setDraft({ ...draft, lineItems: items });
  };

  const handleRowDrop = (index: number) => {
    if (dragIndex !== null) moveRow(dragIndex, index);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = () => {
    if (!draft) return;
    const cleanedItems = draft.lineItems.filter(item => item.title.trim() !== '' || item.amount);
    const cleanedDraft: Estimation = { ...draft, lineItems: cleanedItems };

    if (isNew) {
      setEstimationsList([...estimationsList, cleanedDraft]);
      onLog('create', 'estimation', `${cleanedDraft.title} — ₹${totalAmount(cleanedDraft).toLocaleString()}`);
      setToastMessage(t('common.savedSuccess'));
    } else {
      setEstimationsList(estimationsList.map(est => (est.id === cleanedDraft.id ? cleanedDraft : est)));
      onLog('update', 'estimation', `${cleanedDraft.title} — ₹${totalAmount(cleanedDraft).toLocaleString()}`);
      setToastMessage(t('common.updatedSuccess'));
    }
    backToList();
  };

  const handleDelete = (est: Estimation) => setDeleteTarget(est);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setEstimationsList(estimationsList.filter(est => est.id !== deleteTarget.id));
    onLog('delete', 'estimation', deleteTarget.title);
    setDeleteTarget(null);
    setToastMessage(t('common.deletedSuccess'));
  };

  if (view === 'detail' && draft) {
    const draftTotal = totalAmount(draft);
    const rowQuery = rowSearchQuery.trim().toLowerCase();
    const visibleRows = draft.lineItems
      .map((item, trueIndex) => ({ item, trueIndex }))
      .filter(({ item }) => !rowQuery
        || item.title.toLowerCase().includes(rowQuery)
        || item.customField.toLowerCase().includes(rowQuery)
        || item.customField2.toLowerCase().includes(rowQuery)
        || String(item.amount ?? '').toLowerCase().includes(rowQuery));
    return (
      <div className="space-y-6">
        <PageHeading
          action={
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={backToList}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <ArrowLeft size={18} />
                {t('estimation.backToList')}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Printer size={18} />
                {t('estimation.print')}
              </button>
              {canEdit && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
                >
                  <Save size={18} />
                  {t('common.save')}
                </button>
              )}
            </div>
          }
        >
          {t('estimation.pageTitle')}
        </PageHeading>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('estimation.titleLabel')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                disabled={!canEdit}
                placeholder={t('estimation.titlePlaceholder')}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800"
              />
              <SearchToggleButton open={rowShowSearch} onToggle={() => setRowShowSearch(o => !o)} />
            </div>
          </div>

          <CollapsibleSearchPanel open={rowShowSearch}>
            <input
              type="text"
              value={rowSearchQuery}
              onChange={(e) => setRowSearchQuery(e.target.value)}
              placeholder={t('estimation.rowSearchPlaceholder')}
              className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </CollapsibleSearchPanel>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {canEdit && <th className="w-8" />}
                  <th className="px-2 py-2 text-left w-14">
                    <EditableHeaderLabel
                      value={draft.columnLabels.serialNo}
                      onChange={(v) => setDraft({ ...draft, columnLabels: { ...draft.columnLabels, serialNo: v } })}
                      canEdit={canEdit}
                    />
                  </th>
                  <th className="px-2 py-2 text-left">
                    <EditableHeaderLabel
                      value={draft.columnLabels.title}
                      onChange={(v) => setDraft({ ...draft, columnLabels: { ...draft.columnLabels, title: v } })}
                      canEdit={canEdit}
                    />
                  </th>
                  <th className="px-2 py-2 text-left w-44">
                    <EditableHeaderLabel
                      value={draft.columnLabels.customField}
                      onChange={(v) => setDraft({ ...draft, columnLabels: { ...draft.columnLabels, customField: v } })}
                      canEdit={canEdit}
                    />
                  </th>
                  <th className="px-2 py-2 text-left w-44">
                    <EditableHeaderLabel
                      value={draft.columnLabels.customField2}
                      onChange={(v) => setDraft({ ...draft, columnLabels: { ...draft.columnLabels, customField2: v } })}
                      canEdit={canEdit}
                    />
                  </th>
                  <th className="px-2 py-2 text-left w-40">
                    <EditableHeaderLabel
                      value={draft.columnLabels.amount}
                      onChange={(v) => setDraft({ ...draft, columnLabels: { ...draft.columnLabels, amount: v } })}
                      canEdit={canEdit}
                    />
                  </th>
                  {canEdit && <th className="px-2 py-2 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visibleRows.map(({ item, trueIndex: index }) => (
                  <tr
                    key={item.id}
                    draggable={canEdit}
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                    onDragLeave={() => setDragOverIndex(prev => (prev === index ? null : prev))}
                    onDrop={() => handleRowDrop(index)}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    className={`${dragIndex === index ? 'opacity-40' : ''} ${dragOverIndex === index && dragIndex !== null && dragIndex !== index ? 'border-t-2 border-orange-400' : ''}`}
                  >
                    {canEdit && (
                      <td className="px-1 py-2 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} />
                      </td>
                    )}
                    <td className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">{index + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateDraftItem(item.id, { title: e.target.value })}
                        disabled={!canEdit}
                        placeholder={t('estimation.itemTitlePlaceholder')}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.customField}
                        onChange={(e) => updateDraftItem(item.id, { customField: e.target.value })}
                        disabled={!canEdit}
                        placeholder={draft.columnLabels.customField}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.customField2}
                        onChange={(e) => updateDraftItem(item.id, { customField2: e.target.value })}
                        disabled={!canEdit}
                        placeholder={draft.columnLabels.customField2}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount || ''}
                        onChange={(e) => updateDraftItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                        disabled={!canEdit}
                        placeholder="0"
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800"
                      />
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => removeRow(item.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td colSpan={canEdit ? 5 : 4} className="px-2 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">
                    {t('estimation.totalItems')}: {draft.lineItems.filter(i => i.title.trim() !== '' || i.amount).length}
                    {'   '}·{'   '}
                    {t('estimation.totalAmount')}
                  </td>
                  <td className="px-2 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">₹{draftTotal.toLocaleString()}</td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {canEdit && (
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
            >
              <Plus size={16} />
              {t('estimation.addRow')}
            </button>
          )}
        </div>

        {/* A4 print/PDF layout — portaled straight onto <body> (a sibling of
            #root, not nested inside it) so the print stylesheet can hide
            #root with display:none and this reflows as the only content on
            the page. Nesting it inside #root and hiding everything else via
            visibility:hidden left the whole app's layout height reserved,
            which pushed an extra blank page onto the end of every printout.
            Hidden on screen, shown only when the Print button below
            triggers window.print(). Uses the estimation's own column labels
            and skips blank rows, same "has a title or an amount" rule as Save. */}
        {createPortal(
          <div id="estimation-print-area" className="hidden print:block bg-white text-gray-900 p-0">
            <h1 className="text-lg font-normal text-gray-900 mb-1">
              {t('estimation.printHeading').replace('{name}', committeeAssociation || '')}
            </h1>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">{draft.title || t('estimation.pageTitle')}</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-left py-2 pr-2 text-sm font-bold">{draft.columnLabels.serialNo}</th>
                  <th className="text-left py-2 pr-2 text-sm font-bold">{draft.columnLabels.title}</th>
                  <th className="text-left py-2 pr-2 text-sm font-bold">{draft.columnLabels.customField}</th>
                  <th className="text-left py-2 pr-2 text-sm font-bold">{draft.columnLabels.customField2}</th>
                  <th className="text-right py-2 text-sm font-bold">{draft.columnLabels.amount}</th>
                </tr>
              </thead>
              <tbody>
                {draft.lineItems
                  .filter(item => item.title.trim() !== '' || item.amount)
                  .map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-300">
                      <td className="py-2 pr-2 text-sm">{index + 1}</td>
                      <td className="py-2 pr-2 text-sm">{item.title}</td>
                      <td className="py-2 pr-2 text-sm">{item.customField}</td>
                      <td className="py-2 pr-2 text-sm">{item.customField2}</td>
                      <td className="py-2 text-sm text-right">₹{(item.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-6 pt-4 border-t-2 border-gray-800">
              <div className="text-right">
                <p className="text-sm font-bold uppercase tracking-wide">{t('estimation.totalAmount')}</p>
                <p className="text-2xl font-bold">₹{draftTotal.toLocaleString()}</p>
              </div>
            </div>
          </div>,
          document.body
        )}

        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            {canEdit && (
              <button
                onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
              >
                <Plus size={20} />
                {t('estimation.addNew')}
              </button>
            )}
          </div>
        }
      >
        {t('estimation.pageTitle')}
      </PageHeading>

      <CollapsibleSearchPanel open={showSearch}>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('estimation.searchPlaceholder')}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          />
        </div>
      </CollapsibleSearchPanel>

      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('estimation.titleLabel')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('estimation.totalItems')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('estimation.totalAmount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.date')}</th>
                {(canEdit || canDelete) && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((est) => (
                <tr key={est.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => openExisting(est)}
                      className="text-orange-600 hover:text-orange-700 hover:underline text-left"
                    >
                      {est.title || '-'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{est.lineItems.length}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100">₹{totalAmount(est).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(est.createdAt).toLocaleDateString(locale)}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button
                            onClick={() => openExisting(est)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(est)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {estimationsList.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
            <Calculator size={28} className="text-gray-300" />
            {t('estimation.empty')}
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
      </div>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.title}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// A table header cell that's also an inline-editable text input — lets the
// user rename any column (S. No. / Title / the custom field / Amount) per
// estimation. Read-only span when the page's edit permission is off.
function EditableHeaderLabel({
  value, onChange, canEdit,
}: {
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
}) {
  if (!canEdit) {
    return <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{value}</span>;
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border-0 border-b border-dashed border-gray-300 dark:border-gray-600 px-0 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase focus:ring-0 focus:border-orange-500 outline-none"
    />
  );
}
