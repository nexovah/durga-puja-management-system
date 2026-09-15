import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { fetchActivityLog, ActivityLogEntry, ActivityAction, ActivityModule } from '../lib/db';
import { Pagination, usePagination } from './Pagination';

// Read-only audit trail: append-only `activity_log` table (RLS grants only
// select+insert — no update/delete — so once a row lands here it can't be
// tampered with from the client). Every create/edit/delete/bulk-import across
// Members, Chanda, Donation/Ads, Expenses, Loans and User Management writes
// one row here via App.tsx's `handleLog`.
export function ActivityLog() {
  const { t, locale } = useLanguage();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<'all' | ActivityModule>('all');
  const [actionFilter, setActionFilter] = useState<'all' | ActivityAction>('all');

  const load = () => {
    setLoading(true);
    fetchActivityLog()
      .then(setEntries)
      .catch(err => console.error('Failed to load activity log', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moduleLabel = (m: ActivityModule) => t(`activityLog.module.${m}` as any) || m;
  const actionLabel = (a: ActivityAction) => t(`activityLog.action.${a}` as any) || a;

  const actionBadge: Record<ActivityAction, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    bulk_import: 'bg-purple-100 text-purple-700',
  };

  const filtered = entries.filter(
    e => (moduleFilter === 'all' || e.module === moduleFilter) && (actionFilter === 'all' || e.action === actionFilter)
  );

  const modules: ActivityModule[] = ['members', 'chanda', 'donation_ads', 'expenses', 'loans', 'tasks', 'users', 'settings'];
  const actions: ActivityAction[] = ['create', 'update', 'delete', 'bulk_import'];

  const pagination = usePagination(filtered);

  return (
    <div>
      <PageHeading
        action={
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 text-sm sm:text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        }
      >
        {t('activityLog.title')}
      </PageHeading>

      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
        >
          <option value="all">{t('activityLog.allModules')}</option>
          {modules.map(m => (
            <option key={m} value={m}>{moduleLabel(m)}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
        >
          <option value="all">{t('activityLog.allActions')}</option>
          {actions.map(a => (
            <option key={a} value={a}>{actionLabel(a)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('activityLog.col.time')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('activityLog.col.user')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('activityLog.col.action')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('activityLog.col.module')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('activityLog.col.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    {t('activityLog.empty')}
                  </td>
                </tr>
              )}
              {pagination.pageItems.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {new Date(entry.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                    {entry.userName} <span className="text-gray-400 font-normal">({entry.username})</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${actionBadge[entry.action]}`}>
                      {actionLabel(entry.action)}
                      {entry.recordCount > 1 ? ` (${entry.recordCount})` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{moduleLabel(entry.module)}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
}
