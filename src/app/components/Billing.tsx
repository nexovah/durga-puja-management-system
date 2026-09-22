import { useEffect, useState } from 'react';
import { CheckCircle2, Receipt } from 'lucide-react';
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

interface BillingProps {
  currentUser: User | null;
  committeeName: string;
  onSubscriptionExtended: () => void | Promise<void>;
}

const formatAmount = (paise: number, currency: string) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency });

export function Billing({ currentUser, committeeName, onSubscriptionExtended }: BillingProps) {
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
      setError(err?.message || 'Failed to load billing info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const plan = plans.find(p => p.id === selectedPlanId);
  const expiresAt = currentUser?.subscriptionExpiresAt ? new Date(currentUser.subscriptionExpiresAt) : null;
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now();

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
            setSuccessMessage('Payment successful — subscription extended.');
            await load();
            await onSubscriptionExtended();
          } catch (err: any) {
            setError(err?.message || 'Payment verification failed');
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
      setError(err?.message || 'Failed to start payment');
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Billing</h1>
        <p className="text-sm mt-1">
          {expiresAt ? (
            <>
              Subscription {isExpired ? 'expired' : 'active until'}{' '}
              <span className="font-medium">{expiresAt.toLocaleDateString()}</span>{' '}
              <span className={isExpired ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                ({isExpired ? 'expired' : 'active'})
              </span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">No active subscription</span>
          )}
        </p>
      </div>

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
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 max-w-md">
            {plans.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Plan pricing not available right now.</p>
            ) : (
              <>
                {plans.length > 1 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {plans.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                          selectedPlanId === p.id
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}

                {plan && (
                  <>
                    <div className="text-3xl font-semibold mb-1">
                      {formatAmount(plan.amountPaise, plan.currency)}
                    </div>
                    {plan.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{plan.description}</p>}
                    <ul className="space-y-2 my-5">
                      {(plan.features ? plan.features.split('\n').filter(Boolean) : ['Unlimited members & users', 'All collection modules', 'Budgeting & estimation', 'Priority support']).map(item => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={handlePay}
                      disabled={paying}
                      className="w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-medium transition"
                    >
                      {paying ? 'Processing…' : `Pay ${formatAmount(plan.amountPaise, plan.currency)}`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
              <Receipt className="w-4 h-4" /> Billing history
            </h4>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No payments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="text-left font-medium pb-2">Plan</th>
                      <th className="text-left font-medium pb-2">Amount</th>
                      <th className="text-left font-medium pb-2">Status</th>
                      <th className="text-left font-medium pb-2">Activated</th>
                      <th className="text-left font-medium pb-2">Expires</th>
                      <th className="text-left font-medium pb-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {history.map(item => {
                      const activated = new Date(item.date);
                      const expires = new Date(activated);
                      expires.setMonth(expires.getMonth() + item.durationMonths);
                      return (
                        <tr key={item.id}>
                          <td className="py-2 capitalize text-gray-700 dark:text-gray-300">{item.period}</td>
                          <td className="py-2 font-medium">{formatAmount(item.amountPaise, item.currency)}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'paid'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : item.status === 'failed'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2 text-gray-500 dark:text-gray-400">{activated.toLocaleDateString()}</td>
                          <td className="py-2 text-gray-500 dark:text-gray-400">{expires.toLocaleDateString()}</td>
                          <td className="py-2 text-gray-500 dark:text-gray-400">
                            {item.source === 'manual' ? 'Manual grant' : 'Razorpay'}
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
