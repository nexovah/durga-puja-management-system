import { useState } from 'react';
import { Plus, Trash2, Edit2, ArrowLeft, Save, Calculator } from 'lucide-react';
import { Estimation, EstimationLineItem } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { Pagination, usePagination } from './Pagination';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface EstimationPageProps {
  estimationsList: Estimation[];
  setEstimationsList: (list: Estimation[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string;
  currentUserName: string;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'estimation', summary: string, count?: number) => void;
}

const emptyLineItem = (): EstimationLineItem => ({
  id: crypto.randomUUID(),
  title: '',
  date: '',
  amount: 0,
});

const totalAmount = (est: Estimation) => est.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

// Budgeting/projection tool, separate from the actual Expenses module.
// List view (like Tasks) of named estimations; clicking one opens a
// full-width in-page detail view (not a modal — the unlimited-rows editor
// needs more room than FormModal gives) with an editable line-item table
// and a live-computed total.
export function EstimationPage({
  estimationsList, setEstimationsList, canEdit, canDelete, currentUserId, currentUserName, onLog,
}: EstimationPageProps) {
  const { t, locale } = useLanguage();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [draft, setDraft] = useState<Estimation | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Estimation | null>(null);

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
      createdAt: new Date().toISOString(),
      createdBy: currentUserId,
      createdByName: currentUserName,
    });
    setIsNew(true);
    setView('detail');
  };

  const openExisting = (est: Estimation) => {
    setDraft({ ...est, lineItems: est.lineItems.map(item => ({ ...item })) });
    setIsNew(false);
    setView('detail');
  };

  const backToList = () => {
    setDraft(null);
    setView('list');
  };

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
    return (
      <div className="space-y-6">
        <PageHeading
          action={
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={backToList}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <ArrowLeft size={18} />
                {t('estimation.backToList')}
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

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('estimation.titleLabel')}</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              disabled={!canEdit}
              placeholder={t('estimation.titlePlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase w-14">{t('estimation.serialNo')}</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('estimation.itemTitle')}</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase w-44">{t('estimation.date')}</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase w-40">{t('estimation.amount')}</th>
                  {canEdit && <th className="px-2 py-2 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {draft.lineItems.map((item, index) => (
                  <tr key={item.id}>
                    <td className="px-2 py-2 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateDraftItem(item.id, { title: e.target.value })}
                        disabled={!canEdit}
                        placeholder={t('estimation.itemTitlePlaceholder')}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => updateDraftItem(item.id, { date: e.target.value })}
                        disabled={!canEdit}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50"
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
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-50"
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
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td colSpan={3} className="px-2 py-3 text-sm font-semibold text-gray-700 text-right">
                    {t('estimation.totalItems')}: {draft.lineItems.filter(i => i.title.trim() !== '' || i.amount).length}
                    {'   '}·{'   '}
                    {t('estimation.totalAmount')}
                  </td>
                  <td className="px-2 py-3 text-sm font-bold text-gray-900">₹{draftTotal.toLocaleString()}</td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {canEdit && (
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
            >
              <Plus size={16} />
              {t('estimation.addRow')}
            </button>
          )}
        </div>

        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          canEdit && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
            >
              <Plus size={20} />
              {t('estimation.addNew')}
            </button>
          )
        }
      >
        {t('estimation.pageTitle')}
      </PageHeading>

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('estimation.searchPlaceholder')}
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('estimation.titleLabel')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('estimation.totalItems')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('estimation.totalAmount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                {(canEdit || canDelete) && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagination.pageItems.map((est) => (
                <tr key={est.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => openExisting(est)}
                      className="text-orange-600 hover:text-orange-700 hover:underline text-left"
                    >
                      {est.title || '-'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{est.lineItems.length}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">₹{totalAmount(est).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
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
          <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
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
