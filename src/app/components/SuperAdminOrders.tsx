import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ShoppingCart, XCircle } from 'lucide-react';
import { Order, OrderDetail, listOrdersRequest, getOrderDetailRequest, cancelManualGrantRequest } from '../lib/superAdminDb';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';

const formatAmount = (paise: number, currency: string) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency });

// /super-admin/orders/<source>/<id> — parsed on mount so a refresh while
// viewing an order's detail lands back on that same detail, not the list.
function getSelectionFromPath(): { id: string; source: 'razorpay' | 'manual' } | null {
  const parts = window.location.pathname.replace(/^\/super-admin\/?/, '').split('/');
  if (parts[0] === 'orders' && (parts[1] === 'razorpay' || parts[1] === 'manual') && parts[2]) {
    return { source: parts[1], id: parts[2] };
  }
  return null;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    paid: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    manual: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    created: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
    cancelled: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 line-through',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.created}`}>
      {status === 'manual' ? 'manual — no payment' : status === 'cancelled' ? 'cancelled' : status}
    </span>
  );
}

export function SuperAdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tenantFilter, setTenantFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const [selected, setSelectedState] = useState<{ id: string; source: 'razorpay' | 'manual' } | null>(() => getSelectionFromPath());
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const reload = () => listOrdersRequest().then(setOrders).catch(err => setError(err?.message || 'Failed to load orders'));

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setError('');
    try {
      await cancelManualGrantRequest(cancelTarget.id);
      setCancelTarget(null);
      await reload();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel grant');
    } finally {
      setCancelling(false);
    }
  };

  const selectOrder = (order: { id: string; source: 'razorpay' | 'manual' }) => {
    setSelectedState(order);
    window.history.pushState(null, '', `/super-admin/orders/${order.source}/${order.id}`);
  };

  const backToList = () => {
    setSelectedState(null);
    window.history.pushState(null, '', '/super-admin/orders');
  };

  useEffect(() => {
    const onPopState = () => setSelectedState(getSelectionFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    listOrdersRequest()
      .then(setOrders)
      .catch(err => setError(err?.message || 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true);
    getOrderDetailRequest(selected.id, selected.source)
      .then(setDetail)
      .catch(err => setError(err?.message || 'Failed to load order'))
      .finally(() => setDetailLoading(false));
  }, [selected]);

  const tenants = useMemo(() => Array.from(new Set(orders.map(o => o.tenantName))).sort(), [orders]);
  const statuses = useMemo(() => Array.from(new Set(orders.map(o => o.status))).sort(), [orders]);

  const filtered = orders.filter(o => {
    if (tenantFilter && o.tenantName !== tenantFilter) return false;
    if (sourceFilter && o.source !== sourceFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q && !o.tenantName.toLowerCase().includes(q)) return false;
    const f = appliedFilters;
    if (f.status && o.status !== f.status) return false;
    if (f.dateFrom && new Date(o.createdAt).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(o.createdAt).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  if (selected) {
    return (
      <div className="max-w-xl">
        <button
          onClick={backToList}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" /> Order details
        </h1>
        {detailLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : !detail ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Order not found.</p>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Tenant</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{detail.tenantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Plan / period</span>
              <span className="font-medium capitalize">{detail.period}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Amount</span>
              <span className="font-medium">{formatAmount(detail.amountPaise, detail.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              {statusBadge(detail.status)}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Created</span>
              <span>{new Date(detail.createdAt).toLocaleString()}</span>
            </div>
            {detail.paidAt && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Paid at</span>
                <span>{new Date(detail.paidAt).toLocaleString()}</span>
              </div>
            )}
            {detail.source === 'razorpay' ? (
              <>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Razorpay order ID</span>
                  <span className="font-mono text-xs">{detail.razorpayOrderId || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Razorpay payment ID</span>
                  <span className="font-mono text-xs">{detail.razorpayPaymentId || '—'}</span>
                </div>
              </>
            ) : (
              <>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Granted by</span>
                  <span className="font-medium">{detail.grantedByName || '—'}</span>
                </div>
                {detail.note && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Note</span>
                    <span>{detail.note}</span>
                  </div>
                )}
                <p className="text-xs text-blue-600 dark:text-blue-400 pt-1">
                  Manually added by Super Admin — no payment was made for this order.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Orders</h1>
        <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
      </div>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder="Search by tenant name"
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filtered.length}
          totalCount={orders.length}
          statusOptions={statuses.map(s => ({ value: s, label: s }))}
          showDateRange
        />
      </CollapsibleSearchPanel>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
          <option value="">All tenants</option>
          {tenants.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
          <option value="">All sources</option>
          <option value="razorpay">Razorpay</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          {orders.length === 0 ? 'No orders yet.' : 'No orders match your search.'}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Tenant</th>
                <th className="text-left px-4 py-2.5 font-medium">Period</th>
                <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Source</th>
                <th className="text-left px-4 py-2.5 font-medium">Created</th>
                <th className="text-right px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(order => (
                <tr
                  key={`${order.source}-${order.id}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                  onClick={() => selectOrder({ id: order.id, source: order.source })}
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{order.tenantName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{order.period}</td>
                  <td className="px-4 py-3 font-medium">{formatAmount(order.amountPaise, order.currency)}</td>
                  <td className="px-4 py-3">{statusBadge(order.status)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{order.source}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {order.source === 'manual' && order.status !== 'cancelled' && (
                      <button
                        onClick={e => { e.stopPropagation(); setCancelTarget(order); }}
                        title="Cancel this manual grant"
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SuperAdminConfirmModal
        open={!!cancelTarget}
        title="Cancel manual grant"
        message={
          cancelTarget
            ? `This reverses the "${cancelTarget.period}" grant given manually to ${cancelTarget.tenantName} — their subscription will be rolled back by that period. Real Razorpay payments can never be cancelled this way. This cannot be undone.`
            : ''
        }
        confirmLabel={cancelling ? 'Cancelling…' : 'Cancel grant'}
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
      />
    </div>
  );
}
