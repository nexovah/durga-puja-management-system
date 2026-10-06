import { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Check, Mail, Phone, Building2, ArrowRight } from 'lucide-react';
import {
  listSubscriptionPlansRequest,
  createSubscriptionRequest,
  verifySubscriptionPaymentRequest,
  loadRazorpayCheckout,
  SubscriptionPlan,
} from '../lib/billingDb';
import { setOwnPhoneRequest, fetchTenantSubscriptionExpiry } from '../lib/db';
import { onlyDigits, isPhoneValid } from '../lib/validation';

export interface CheckoutDoneUpdates {
  subscriptionExpiresAt?: string;
  phone?: string;
}

// Reached right after a new signup that started from a landing-page plan
// selection (/checkout?plan=<id>) — a dedicated review/pay screen in
// front of the existing, unmodified Razorpay Standard Checkout flow
// (which already natively offers UPI/QR, Card, Netbanking and Wallet the
// moment it opens). The tenant session is already authenticated at this
// point (App.tsx called loginRequest/Google auth before rendering this
// page), just not yet transitioned into the main app — `onDone` does
// that, whether payment succeeded or was skipped (the free trial from
// signup already covers that case). `onDone` is handed the real
// post-checkout state (refreshed subscription expiry if paid, phone if
// just collected here) so App.tsx's gates see accurate data instead of
// the pre-checkout snapshot.
export function CheckoutPage({
  planId,
  userId,
  tenantId,
  committeeName,
  email,
  phone,
  onDone,
}: {
  planId: string;
  userId: string;
  tenantId: string;
  committeeName: string;
  email: string;
  phone: string;
  onDone: (updates: CheckoutDoneUpdates) => void;
}) {
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  // Google-signup users have no phone on file yet — collect it right
  // here instead of a separate interstitial. Manual-signup users already
  // have one from the signup form, shown read-only.
  const [phoneInput, setPhoneInput] = useState(phone);
  const needsPhone = !phone;

  useEffect(() => {
    listSubscriptionPlansRequest()
      .then(plans => setPlan(plans.find(p => p.id === planId) || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [planId]);

  const savePhoneIfNeeded = async (): Promise<string | undefined> => {
    if (!needsPhone) return undefined;
    if (!isPhoneValid(phoneInput, true)) {
      setError('Enter a valid 10-digit phone number.');
      return undefined;
    }
    const trimmed = phoneInput.trim();
    await setOwnPhoneRequest(userId, trimmed);
    return trimmed;
  };

  const handlePay = async () => {
    if (!plan) return;
    setError('');
    const savedPhone = await savePhoneIfNeeded();
    if (needsPhone && !savedPhone) return; // validation failed, error already set
    setPaying(true);
    try {
      await loadRazorpayCheckout();
      const sub = await createSubscriptionRequest(plan.id);
      const razorpay = new window.Razorpay({
        key: sub.keyId,
        subscription_id: sub.subscriptionId,
        name: 'Durga CRM',
        description: `${plan.name} — ${committeeName}`,
        prefill: { name: committeeName, email, contact: savedPhone || phone },
        handler: async (response: any) => {
          let freshExpiry: string | undefined;
          try {
            await verifySubscriptionPaymentRequest(response.razorpay_payment_id, response.razorpay_subscription_id, response.razorpay_signature);
            freshExpiry = (await fetchTenantSubscriptionExpiry(tenantId)) || undefined;
          } catch {
            // Verification failing here doesn't strand the account — the
            // webhook (api/billing/webhook.js) is an independent,
            // idempotent fallback that reconciles it shortly after. We
            // just won't have the freshly-extended date on this render.
          } finally {
            onDone({ subscriptionExpiresAt: freshExpiry, phone: savedPhone });
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
        theme: { color: '#ea580c' },
      });
      razorpay.open();
    } catch (err: any) {
      setError(err?.message || 'Could not start payment — please try again.');
      setPaying(false);
    }
  };

  const handleSkip = async () => {
    setError('');
    const savedPhone = await savePhoneIfNeeded();
    if (needsPhone && !savedPhone) return;
    onDone({ phone: savedPhone });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-600">Secure checkout</p>
          <h1 className="mt-2 text-2xl font-extrabold text-gray-900">Finish setting up your committee</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500">Loading your plan…</div>
          ) : !plan ? (
            <div className="p-10 text-center text-gray-500">
              <p>We couldn't find that plan.</p>
              <button onClick={() => onDone({})} className="mt-4 text-orange-600 font-bold hover:underline">
                Continue to your dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gray-900 text-white px-6 py-6">
                <p className="text-sm font-bold text-orange-400">{plan.name}</p>
                <p className="mt-2 text-4xl font-extrabold">
                  {(plan.amountPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 })}
                </p>
                <p className="mt-1 text-sm text-white/60">per {plan.durationMonths === 1 ? 'month' : `${plan.durationMonths} months`}</p>
                {plan.features && (
                  <ul className="mt-4 space-y-1.5">
                    {plan.features.split('\n').filter(Boolean).map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-white/80">
                        <Check size={15} className="text-orange-400 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="px-6 py-5 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Billing details</p>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-gray-400" /> {committeeName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" /> {email}
                  </div>
                  {needsPhone ? (
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-gray-400 shrink-0" />
                      <input
                        type="tel"
                        required
                        value={phoneInput}
                        onChange={e => setPhoneInput(onlyDigits(e.target.value))}
                        placeholder="Phone number"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" /> {phone}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-5">
                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors"
                >
                  {paying ? 'Opening secure payment…' : `Pay ${(plan.amountPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 })} Securely`}
                  {!paying && <ArrowRight size={18} />}
                </button>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Lock size={12} /> Payments secured by Razorpay
                </div>
                <button onClick={handleSkip} disabled={paying} className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-60">
                  Skip for now, pay later from Billing
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <ShieldCheck size={14} /> Your committee's data stays private and secure
        </div>
      </div>
    </div>
  );
}
