import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Receipt } from 'lucide-react';
import {
  SubscriptionPlan,
  BillingHistoryItem,
  listSubscriptionPlansRequest,
  listBillingHistoryRequest,
  createOrderRequest,
  verifyPaymentRequest,
  loadRazorpayCheckout,
} from '../lib/billingDb';
import { User } from '../App';
import { useLanguage } from '../i18n/LanguageContext';

interface BillingProps {
  currentUser: User | null;
  committeeName: string;
  onSubscriptionExtended: () => void | Promise<void>;
}

const formatAmount = (paise: number, currency: string) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency });

export function Billing({ currentUser, committeeName, onSubscriptionExtended }: BillingProps) {
  const { t, locale } = useLanguage();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [history, setHistory] = useState<BillingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [p, h] = await Promise.all([listSubscriptionPlansRequest(), listBillingHistoryRequest()]);
      setPlans(p);
      setSelectedPlanId(prev => prev && p.some(pl => pl.id === prev) ? prev : (p[0]?.id ?? null));
      setHistory(h);
    } catch (err: any) {
      setError(err?.message || t('billing.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const plan = plans.find(p => p.id === selectedPlanId);
  const expiresAt = currentUser?.subscriptionExpiresAt ? new Date(currentUser.subscriptionExpiresAt) : null;
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now();

  const latestHistoryItem = history.length
    ? [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;
  const grantedPlanId = latestHistoryItem
    ? plans.find(p => p.durationMonths === latestHistoryItem.durationMonths)?.id ?? null
    : null;
  const activePlanId = !isExpired ? grantedPlanId : null;
  const expiredPlanId = isExpired ? grantedPlanId : null;

  const translatePlanName = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('monthly')) return t('billing.plan.monthly');
    if (n.includes('yearly')) return t('billing.plan.yearly');
    return name;
  };

  const translatePlanDesc = (desc?: string) => {
    if (!desc) return '';
    const d = desc.toLowerCase();
    if (d.includes('monthly')) return t('billing.plan.monthlyDesc');
    if (d.includes('yearly')) return t('billing.plan.yearlyDesc');
    return desc;
  };

  const translateFeature = (feature: string) => {
    const f = feature.trim().toLowerCase();
    if (f.includes('unlimited members')) return t('billing.feature.unlimitedMembers');
    if (f.includes('all collection modules')) return t('billing.feature.allModules');
    if (f.includes('budgeting & estimation') || f.includes('budgeting')) return t('billing.feature.budgeting');
    if (f.includes('task management') || f.includes('task')) return t('billing.feature.tasks');
    if (f.includes('full activity log') || f.includes('activity log')) return t('billing.feature.activityLog');
    if (f.includes('priority support') || f.includes('support')) return t('billing.feature.support');
    return feature;
  };

  const translatePeriod = (period: string) => {
    const p = period.toLowerCase();
    if (p === 'monthly') return t('billing.history.period.monthly');
    if (p === 'yearly') return t('billing.history.period.yearly');
    return period;
  };

  const translateStatus = (status: string) => {
    if (status === 'paid') return t('billing.history.status.paid');
    if (status === 'failed') return t('billing.history.status.failed');
    return status;
  };

  const translateSource = (source: string) => {
    if (source === 'manual') return t('billing.history.source.manual');
    return t('billing.history.source.razorpay');
  };

  const handlePay = async () => {
    if (!plan) return;
    setPaying(true);
    setError('');
    setSuccessMessage('');
    try {
      await loadRazorpayCheckout();
      const order = await createOrderRequest(plan.id);

      const razorpay = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Durga CRM',
        description: `${plan.name} — ${committeeName}`,
        handler: async (response: any) => {
          try {
            await verifyPaymentRequest(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
            setSuccessMessage(t('billing.paymentSuccess'));
            await load();
            await onSubscriptionExtended();
          } catch (err: any) {
            setError(err?.message || t('billing.verificationFailed'));
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
        theme: { color: '#ea580c' },
      });
      razorpay.open();
    } catch (err: any) {
      setError(err?.message || t('billing.startFailed'));
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('billing.title')}</h1>
        {!isExpired && (
          <p className="text-sm mt-1">
            {expiresAt ? (
              <>
                {t('billing.activeUntil')}{' '}
                <span className="font-medium">{expiresAt.toLocaleDateString(locale)}</span>{' '}
                <span className="text-green-600 dark:text-green-400">{t('billing.activeStatus')}</span>
              </>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{t('billing.noActive')}</span>
            )}
          </p>
        )}
      </div>

      {isExpired && (
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-red-600 dark:bg-red-700 text-white shadow-md">
          <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {expiresAt
                ? t('billing.expiredOn').replace('{date}', expiresAt.toLocaleDateString(locale))
                : t('billing.expired')}
            </p>
            <p className="text-sm text-red-100 mt-0.5">
              {t('billing.expiredNotice')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="px-4 py-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">{t('billing.loading')}</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 max-w-md">
            {plans.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('billing.notAvailable')}</p>
            ) : (
              <>
                {plans.length > 1 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {plans.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlanId(p.id)}
                        disabled={p.id === activePlanId}
                        className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition ${
                          p.id === activePlanId
                            ? 'bg-green-600 text-white cursor-not-allowed opacity-90'
                            : p.id === expiredPlanId
                            ? 'bg-red-600 text-white'
                            : selectedPlanId === p.id
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {translatePlanName(p.name)}
                        {p.id === activePlanId && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/25 align-middle">
                            {t('billing.active')}
                          </span>
                        )}
                        {p.id === expiredPlanId && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/25 align-middle">
                            {t('billing.expiredBadge')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {plan && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-3xl font-semibold">
                        {formatAmount(plan.amountPaise, plan.currency)}
                      </div>
                      {plan.id === activePlanId && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          {t('billing.activePlan')}
                        </span>
                      )}
                      {plan.id === expiredPlanId && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          {t('billing.expiredPlan')}
                        </span>
                      )}
                    </div>
                    {plan.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{translatePlanDesc(plan.description)}</p>}
                    <ul className="space-y-2 my-5">
                      {(plan.features ? plan.features.split('\n').filter(Boolean) : [
                        'Unlimited members & users',
                        'All collection modules',
                        'Budgeting & estimation',
                        'Task management',
                        'Full activity log',
                        'Priority support',
                      ]).map(item => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                          {translateFeature(item)}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={handlePay}
                      disabled={paying || plan.id === activePlanId}
                      className="w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium transition"
                    >
                      {paying
                        ? t('billing.processing')
                        : plan.id === activePlanId
                        ? t('billing.currentPlan')
                        : t('billing.pay').replace('{amount}', formatAmount(plan.amountPaise, plan.currency))}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Receipt className="w-4 h-4" /> {t('billing.history.title')}
              </h4>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 px-6 py-6">{t('billing.history.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('billing.history.col.plan')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('billing.history.col.amount')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('billing.history.col.status')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('billing.history.col.activated')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('billing.history.col.expires')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('billing.history.col.source')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {history.map(item => {
                      const activated = new Date(item.date);
                      const expires = new Date(activated);
                      expires.setMonth(expires.getMonth() + item.durationMonths);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-6 py-4 text-sm capitalize text-gray-700 dark:text-gray-300">{translatePeriod(item.period)}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{formatAmount(item.amountPaise, item.currency)}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'paid'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : item.status === 'failed'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            }`}>
                              {translateStatus(item.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{activated.toLocaleDateString(locale)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{expires.toLocaleDateString(locale)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {translateSource(item.source)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
