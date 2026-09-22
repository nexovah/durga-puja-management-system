import { useEffect, useState } from 'react';
import {
  Users, Wallet, Megaphone, Receipt, HandCoins, ClipboardList,
  CalendarClock, Activity, Moon, Sun, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getPlatformSettingsRequest } from '../lib/superAdminDb';
import { listSubscriptionPlansRequest, SubscriptionPlan } from '../lib/billingDb';

interface LandingPageProps {
  onGoToLogin: () => void;
  onGoToLegal: (slug: 'terms' | 'privacy' | 'refund') => void;
}

const FEATURES = [
  { icon: Users, title: 'Members', desc: 'Track every member, designation, membership dues and payment status in one place.' },
  { icon: HandCoins, title: 'Chanda Collection', desc: 'Record door-to-door and online chanda collections with receipts, in seconds.' },
  { icon: Megaphone, title: 'Donation Ads', desc: 'Manage sponsor ads and donation pledges with clear payment tracking.' },
  { icon: Receipt, title: 'Expenses', desc: 'Log every puja expense with vendor, category and bill references.' },
  { icon: Wallet, title: 'Treasury & Vendors', desc: 'See exact cash position, vendor dues and partial payments at a glance.' },
  { icon: ClipboardList, title: 'Estimation Budgeting', desc: 'Build a line-by-line puja budget, print-ready, before spending starts.' },
  { icon: CalendarClock, title: 'Tasks', desc: 'Assign and track committee tasks with due dates, right up to immersion day.' },
  { icon: Activity, title: 'Activity Log', desc: 'Full audit trail of who changed what, for complete transparency.' },
];

// This page intentionally does NOT use Tailwind's `dark:` variant. This
// project's dark mode is configured as `@is(.dark *)` in globals.css, which
// matches ANY ancestor with class "dark" — not just the nearest one. Since
// the shared committee-app theme (App.tsx's ThemeProvider) defaults to the
// visitor's OS preference and can set `dark` on <html>, a `dark:` class
// here would fire regardless of this page's own toggle. A public marketing
// page should default to light and control its own theme independently, so
// every color below is chosen explicitly from local `dark` state instead.
export function LandingPage({ onGoToLogin, onGoToLegal }: LandingPageProps) {
  const [dark, setDark] = useState(false);
  const [form, setForm] = useState({ committeeName: '', contactName: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [platformLogo, setPlatformLogo] = useState('');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    getPlatformSettingsRequest().then(p => setPlatformLogo(p.logoUrl)).catch(() => {});
    listSubscriptionPlansRequest().then(p => {
      setPlans(p);
      setSelectedPlanId(p[0]?.id ?? null);
    }).catch(() => {});
  }, []);

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];
  const c = (light: string, darkCls: string) => (dark ? darkCls : light);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.committeeName || !form.contactName || !form.phone) {
      setError('Committee name, contact name and phone are required.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('leads').insert({
        committee_name: form.committeeName,
        contact_name: form.contactName,
        phone: form.phone,
        email: form.email || null,
      });
      if (insertError) throw insertError;
      setSubmitted(true);
      setForm({ committeeName: '', contactName: '', phone: '', email: '' });
    } catch {
      setError('Could not submit right now. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen ${c('bg-white text-gray-900', 'bg-gray-950 text-gray-100')}`}>
      {/* Top bar */}
      <header className={`sticky top-0 z-30 backdrop-blur border-b ${c('bg-white/80 border-gray-200', 'bg-gray-950/80 border-gray-800')}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-lg overflow-hidden">
              {platformLogo ? <img src={platformLogo} alt="Logo" className="w-full h-full object-cover" /> : '🕉️'}
            </div>
            <span className="font-semibold text-lg">Durga CRM</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDark(d => !d)}
              className={`p-2 rounded-full transition ${c('hover:bg-gray-100', 'hover:bg-gray-800')}`}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onGoToLogin}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition"
            >
              Committee Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${c('from-amber-50 via-orange-50 to-amber-100', 'from-gray-950 via-gray-900 to-gray-950')}`} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-5 ${c('bg-orange-100 text-orange-700', 'bg-orange-900/30 text-orange-300')}`}>
            Built for Any Puja committees
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-5">
            Run your puja committee<br className="hidden sm:block" /> like a well-oiled machine
          </h1>
          <p className={`max-w-2xl mx-auto text-base sm:text-lg mb-8 ${c('text-gray-600', 'text-gray-400')}`}>
            Members, chanda collection, donation ads, expenses, vendors, budgeting
            and tasks — everything your committee needs, in one simple dashboard.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="#pricing" className="px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition inline-flex items-center gap-2">
              See pricing <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#lead-form" className={`px-6 py-3 rounded-lg border font-medium transition ${c('border-gray-300 hover:bg-gray-50', 'border-gray-700 hover:bg-gray-900')}`}>
              Get started
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Everything your committee already does — organized</h2>
        <p className={`text-center mb-12 max-w-xl mx-auto ${c('text-gray-600', 'text-gray-400')}`}>
          No new workflow to learn. Just the same committee work, without the WhatsApp
          groups, notebooks and spreadsheets.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className={`p-5 rounded-xl border hover:shadow-md hover:-translate-y-0.5 transition ${c('border-gray-200 bg-white', 'border-gray-800 bg-gray-900')}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${c('bg-orange-100', 'bg-orange-900/30')}`}>
                <Icon className={`w-5 h-5 ${c('text-orange-600', 'text-orange-400')}`} />
              </div>
              <h3 className="font-medium mb-1.5">{title}</h3>
              <p className={`text-sm ${c('text-gray-600', 'text-gray-400')}`}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Simple pricing, one plan</h2>
        <p className={`text-center mb-8 ${c('text-gray-600', 'text-gray-400')}`}>
          Everything included. No hidden tiers.
        </p>
        {plans.length === 0 ? (
          <p className={`text-center ${c('text-gray-500', 'text-gray-400')}`}>Pricing coming soon.</p>
        ) : (
          <>
            {plans.length > 1 && (
              <div className="flex items-center justify-center mb-10">
                <div className={`inline-flex p-1 rounded-full ${c('bg-gray-100', 'bg-gray-800')}`}>
                  {plans.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                        selectedPlanId === p.id ? c('bg-white shadow text-gray-900', 'bg-gray-950 shadow text-gray-100') : c('text-gray-500', 'text-gray-400')
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selectedPlan && (
              <div className={`max-w-sm mx-auto p-8 rounded-2xl border text-center bg-gradient-to-br ${c('border-orange-200 from-orange-50 to-amber-50', 'border-orange-900/50 from-gray-900 to-gray-900')}`}>
                <div className="text-4xl font-semibold mb-1">
                  {(selectedPlan.amountPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: selectedPlan.currency })}
                </div>
                <p className={`text-sm mb-6 ${c('text-gray-500', 'text-gray-400')}`}>
                  {selectedPlan.description || `Billed every ${selectedPlan.durationMonths === 1 ? 'month' : `${selectedPlan.durationMonths} months`}, cancel anytime`}
                </p>
                <ul className="text-left space-y-2.5 mb-8">
                  {(selectedPlan.features ? selectedPlan.features.split('\n').filter(Boolean) : ['Unlimited members & users', 'All collection modules', 'Budgeting & estimation', 'Priority support']).map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${c('text-orange-600', 'text-orange-400')}`} />
                      {item}
                    </li>
                  ))}
                </ul>
                <a href="#lead-form" className="block w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition">
                  Get started
                </a>
              </div>
            )}
          </>
        )}
      </section>

      {/* Lead form */}
      <section id="lead-form" className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Bring your committee online</h2>
        <p className={`text-center mb-10 ${c('text-gray-600', 'text-gray-400')}`}>
          Tell us about your committee — we'll get you set up.
        </p>
        {submitted ? (
          <div className={`p-6 rounded-xl border text-center ${c('border-green-200 bg-green-50', 'border-green-900/50 bg-green-900/20')}`}>
            <CheckCircle2 className={`w-8 h-8 mx-auto mb-2 ${c('text-green-600', 'text-green-400')}`} />
            <p className="font-medium">Thanks! We've received your details.</p>
            <p className={`text-sm mt-1 ${c('text-gray-600', 'text-gray-400')}`}>Our team will reach out shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Committee name *</label>
                <input
                  value={form.committeeName}
                  onChange={e => setForm(f => ({ ...f, committeeName: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500 ${c('border-gray-300 bg-white', 'border-gray-700 bg-gray-900')}`}
                  placeholder="e.g. Paschim Pansila Sarbojanin Saradatsav"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Contact name *</label>
                <input
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500 ${c('border-gray-300 bg-white', 'border-gray-700 bg-gray-900')}`}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone *</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500 ${c('border-gray-300 bg-white', 'border-gray-700 bg-gray-900')}`}
                  placeholder="10-digit mobile number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500 ${c('border-gray-300 bg-white', 'border-gray-700 bg-gray-900')}`}
                  placeholder="optional"
                />
              </div>
            </div>
            {error && <p className={`text-sm ${c('text-red-600', 'text-red-400')}`}>{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-medium transition"
            >
              {submitting ? 'Submitting…' : 'Request access'}
            </button>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className={`border-t py-8 text-center text-sm ${c('border-gray-200 text-gray-500', 'border-gray-800 text-gray-400')}`}>
        <div className="flex items-center justify-center gap-4 mb-3">
          <button onClick={() => onGoToLegal('terms')} className={`hover:underline ${c('hover:text-orange-600', 'hover:text-orange-400')}`}>Terms & Conditions</button>
          <span aria-hidden="true">·</span>
          <button onClick={() => onGoToLegal('privacy')} className={`hover:underline ${c('hover:text-orange-600', 'hover:text-orange-400')}`}>Privacy Policy</button>
          <span aria-hidden="true">·</span>
          <button onClick={() => onGoToLegal('refund')} className={`hover:underline ${c('hover:text-orange-600', 'hover:text-orange-400')}`}>Refund Policy</button>
        </div>
        © {new Date().getFullYear()} Durga CRM. All rights reserved.
      </footer>
    </div>
  );
}
