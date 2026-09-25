import { useEffect, useState } from 'react';
import { RefreshCw, Globe, Smartphone, Apple } from 'lucide-react';
import { PageHeading } from './PageHeading';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { useLanguage } from '../i18n/LanguageContext';
import { fetchActivityLog, ActivityLogEntry, ActivityAction, ActivityModule, ActivityDevice } from '../lib/db';
import { Pagination, usePagination } from './Pagination';

const DEVICE_META: Record<ActivityDevice, { label: string; icon: typeof Globe; className: string }> = {
  web: { label: 'Web', icon: Globe, className: 'bg-gray-100 text-gray-700' },
  android: { label: 'Android', icon: Smartphone, className: 'bg-green-100 text-green-700' },
  ios: { label: 'iOS', icon: Apple, className: 'bg-gray-800 text-gray-100' },
};

function DeviceBadge({ device }: { device: ActivityDevice | null }) {
  const meta = DEVICE_META[device ?? 'web'];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${meta.className}`}>
      <Icon size={12} />
      {meta.label}
    </span>
  );
}

// Renders an update's field-level diff: old value struck through, new value
// in normal text — falls back to the plain summary when no diff was
// captured (creates/deletes, bulk imports, or log rows from before this
// feature existed).
function DetailsCell({ entry }: { entry: ActivityLogEntry }) {
  if (entry.action !== 'update' || !entry.changes || entry.changes.length === 0) {
    return <span className="text-gray-700 dark:text-gray-300">{entry.summary}</span>;
  }
  return (
    <div className="space-y-0.5">
      {entry.changes.map((c, i) => (
        <div key={i} className="text-gray-700 dark:text-gray-300">
          <span className="font-medium text-gray-500 dark:text-gray-400">{c.field}:</span>{' '}
          <span className="line-through text-gray-400 dark:text-gray-500">{c.old}</span>{' '}
          <span>{c.new}</span>
        </div>
      ))}
    </div>
  );
}

// The record's identifying name/title (donor name, member name, expense
// title, etc.) — always shown regardless of which fields actually changed,
// so an update to e.g. only the amount still shows whose record it was.
// Falls back to the leading part of the summary for log rows written
// before `recordLabel` was tracked.
function whoLabel(entry: ActivityLogEntry): string {
  if (entry.recordLabel) return entry.recordLabel;
  const leading = entry.summary.split(' — ')[0]?.trim();
  return leading || '—';
}

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
  const [userFilter, setUserFilter] = useState<'all' | string>('all');
  const [deviceFilter, setDeviceFilter] = useState<'all' | ActivityDevice>('all');
  const [showSearch, setShowSearch] = useState(false);

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
    e =>
      (moduleFilter === 'all' || e.module === moduleFilter) &&
      (actionFilter === 'all' || e.action === actionFilter) &&
      (userFilter === 'all' || e.userId === userFilter) &&
      (deviceFilter === 'all' || (e.device ?? 'web') === deviceFilter)
  );

  const modules: ActivityModule[] = ['members', 'chanda', 'donation_ads', 'expenses', 'loans', 'tasks', 'users', 'settings'];
  const actions: ActivityAction[] = ['create', 'update', 'delete', 'bulk_import'];
  const devices: ActivityDevice[] = ['web', 'android', 'ios'];

  // Distinct users seen in the log so far — keyed by userId (falls back to
  // username for older rows saved before userId was tracked, if any).
  const userOptions = Array.from(
    new Map(
      entries
        .filter(e => e.userId)
        .map(e => [e.userId as string, e.userName])
    )
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const pagination = usePagination(filtered);

  return (
    <div>
      <PageHeading
        action={
          <div className="flex items-center gap-2">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </button>
          </div>
        }
      >
        {t('activityLog.title')}
      </PageHeading>

      <CollapsibleSearchPanel open={showSearch}>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-wrap gap-2 sm:gap-3">
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900"
        >
          <option value="all">{t('activityLog.allModules')}</option>
          {modules.map(m => (
            <option key={m} value={m}>{moduleLabel(m)}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900"
        >
          <option value="all">{t('activityLog.allActions')}</option>
          {actions.map(a => (
            <option key={a} value={a}>{actionLabel(a)}</option>
          ))}
        </select>
        <select
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900"
        >
          <option value="all">{t('activityLog.allUsers')}</option>
          {userOptions.map(([userId, userName]) => (
            <option key={userId} value={userId}>{userName}</option>
          ))}
        </select>
        <select
          value={deviceFilter}
          onChange={e => setDeviceFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900"
        >
          <option value="all">All Devices</option>
          {devices.map(d => (
            <option key={d} value={d}>{DEVICE_META[d].label}</option>
          ))}
        </select>
      </div>
      </CollapsibleSearchPanel>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{t('activityLog.col.time')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Device</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{t('activityLog.col.user')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{t('activityLog.col.action')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{t('activityLog.col.module')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Who</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{t('activityLog.col.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    {t('activityLog.empty')}
                  </td>
                </tr>
              )}
              {pagination.pageItems.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(entry.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DeviceBadge device={entry.device} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">
                    {entry.userName} <span className="text-gray-400 dark:text-gray-500 font-normal">({entry.username})</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${actionBadge[entry.action]}`}>
                      {actionLabel(entry.action)}
                      {entry.recordCount > 1 ? ` (${entry.recordCount})` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{moduleLabel(entry.module)}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">{whoLabel(entry)}</td>
                  <td className="px-4 py-3">
                    <DetailsCell entry={entry} />
                  </td>
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
