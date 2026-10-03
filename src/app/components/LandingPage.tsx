import { useEffect, useState } from 'react';
import {
  Users, Wallet, Megaphone, Receipt, HandCoins, ClipboardList,
  CalendarClock, Activity, Moon, Sun, CheckCircle2, ArrowRight,
} from 'lucide-react';
import androidDownloadIcon from '../assets/android-download-icon.svg';
import iosAppIcon from '../assets/ios-app-icon.svg';

// Static APK hosted by this app itself (public/downloads/) — a permanent
// same-origin URL, unlike EAS's signed build-artifact links which expire.
const ANDROID_APK_URL = '/downloads/durga-crm.apk';

// A Play-Store-style download badge — same two-line "GET IT ON" layout as
// the familiar Play Store badge, but with its own icon/wording since this
// is a direct APK download, not a real Play Store listing (using Google's
// actual mark here would misrepresent the distribution channel).
function AndroidBadge({ dark, className = '' }: { dark: boolean; className?: string }) {
  return (
    <a
      href={ANDROID_APK_URL}
      download
      aria-label="Download the Android app (APK)"
      className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition ${
        dark ? 'border-gray-100 bg-black hover:bg-gray-900 text-white' : 'border-gray-900 bg-black hover:bg-gray-800 text-white'
      } ${className}`}
    >
      <img src={androidDownloadIcon} alt="" className="w-[30px] h-[30px] shrink-0" />
      <span className="leading-tight text-left">
        <span className="block text-[10px] tracking-wide opacity-80">GET IT ON</span>
        <span className="block text-base font-semibold -mt-0.5">Android APK</span>
      </span>
    </a>
  );
}

// Matching badge for iOS — disabled/faded since there's no build yet.
function IOSBadge({ className = '' }: { className?: string }) {
  return (
    <div
      aria-disabled="true"
      className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 ${className}`}
    >
      <img src={iosAppIcon} alt="" className="w-[30px] h-[30px] shrink-0" />
      <span className="leading-tight text-left">
        <span className="block text-[10px] tracking-wide">COMING SOON</span>
        <span className="block text-base font-semibold -mt-0.5">iOS App</span>
      </span>
    </div>
  );
}
import { getPlatformSettingsRequest, getTurnstileSiteKeyRequest } from '../lib/superAdminDb';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void }) => string;
    };
  }
}
import { listSubscriptionPlansRequest, SubscriptionPlan } from '../lib/billingDb';
import { onlyDigits, isPhoneValid } from '../lib/validation';

interface LandingPageProps {
  onGoToLogin: () => void;
  onGoToSignup: () => void;
  onGoToLegal: (slug: 'terms' | 'privacy' | 'refund') => void;
}

const FEATURES = [
  { icon: Users, title: 'Committee & Members', desc: 'Manage members, roles, designations, contact details, membership fees and subscriptions from one centralized system.' },
  { icon: HandCoins, title: 'Collection', desc: 'Record collections, contributors, amounts, payment methods, payment status and collection history.' },
  { icon: Megaphone, title: 'Donations & Sponsorship', desc: 'Manage donations, advertisers and sponsors — commitments, amounts, payment status and outstanding collections.' },
  { icon: Receipt, title: 'Expense Management', desc: 'Record expenses, categories, vendors, bills, payment methods, partial payments and outstanding amounts.' },
  { icon: Wallet, title: 'Loan Management', desc: 'Track initial funds and committee loans — lender, amount, repayment status and outstanding balance.' },
  { icon: ClipboardList, title: 'Estimation & Budget', desc: 'Estimate expected costs, plan your budget and compare estimated spending with actual expenses.' },
  { icon: CalendarClock, title: 'Task Management', desc: 'Assign responsibilities, set priorities and track deadlines — nothing forgotten, right up to immersion day.' },
  { icon: Activity, title: 'Activity Log', desc: 'Full audit trail of who changed what, from which device, for complete transparency.' },
];

// Default content — used until (or unless) a Super Admin sets custom
// content via Settings -> Comparison Table (platform_settings.comparison_table).
export const DEFAULT_COMPARISON_GROUPS = [
  {
    category: 'Collections & Community',
    rows: [
      { feature: 'Collection', before: 'Chanda in notebooks', after: 'Digital collection tracking' },
      { feature: 'Donation', before: 'Records scattered across chats & paper', after: 'Centralized donation management' },
      { feature: 'Members', before: 'Scattered across contacts', after: 'Centralized member records' },
      { feature: 'Sponsorship', before: 'Sponsor info across WhatsApp conversations', after: 'Complete sponsorship management' },
    ],
  },
  {
    category: 'Finance & Operations',
    rows: [
      { feature: 'Vendor Payments', before: 'Difficult to track', after: 'Track all vendor payments in one place' },
      { feature: 'Estimation', before: 'Estimates vs. actuals unclear', after: 'Budget and actual tracking' },
      { feature: 'Partial Payments', before: 'Easily forgotten', after: 'Clear payment status and tracking' },
      { feature: 'Loan Records', before: 'Difficult to maintain', after: 'Loans, dues & repayments' },
      { feature: 'Expenses', before: 'Bills & expenses tracked manually', after: 'Organized expense management' },
      { feature: 'Treasury', before: 'Cash flow difficult to monitor', after: 'Complete treasury overview' },
      { feature: 'Cash in Hand & Bank', before: 'Separate records & manual reconciliation', after: 'Cash and bank balances in one view' },
    ],
  },
  {
    category: 'Records & Control',
    rows: [
      { feature: 'Reports', before: 'Manual calculations & spreadsheets', after: 'Instant financial & collection reports' },
      { feature: 'Documents', before: 'Files scattered across devices & chats', after: 'Centralized document management' },
      { feature: 'Assets', before: 'Asset records maintained manually', after: 'Organized asset tracking' },
      { feature: 'Activity Log', before: 'No clear history of changes', after: 'Complete activity & action history' },
      { feature: 'Committee Tasks', before: 'Tasks lost in group chats', after: 'Priorities, deadlines & task tracking' },
    ],
  },
];

const FESTIVALS = [
  'Durga Puja', 'Kali Puja', 'Jagaddhatri Puja', 'Lakshmi Puja', 'Saraswati Puja',
  'Ganesh Chaturthi', 'Rath Yatra', 'Janmashtami', 'Navratri', 'Diwali',
  'Dussehra', 'Chhath Puja', 'Sankranti', 'Community & Cultural Festivals',
];

// This page intentionally does NOT use Tailwind's `dark:` variant. This
// project's dark mode is configured as `@is(.dark *)` in globals.css, which
// matches ANY ancestor with class "dark" — not just the nearest one. Since
// the shared committee-app theme (App.tsx's ThemeProvider) defaults to the
// visitor's OS preference and can set `dark` on <html>, a `dark:` class
// here would fire regardless of this page's own toggle. A public marketing
// page should default to light and control its own theme independently, so
// every color below is chosen explicitly from local `dark` state instead.
export function LandingPage({ onGoToLogin, onGoToSignup, onGoToLegal }: LandingPageProps) {
  const [dark, setDark] = useState(false);
  const [form, setForm] = useState({ committeeName: '', contactName: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [platformLogo, setPlatformLogo] = useState('');
  const [comparisonGroups, setComparisonGroups] = useState(DEFAULT_COMPARISON_GROUPS);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  useEffect(() => {
    getPlatformSettingsRequest().then(p => {
      setPlatformLogo(p.logoUrl);
      if (p.comparisonGroups) setComparisonGroups(p.comparisonGroups);
    }).catch(() => {});
    listSubscriptionPlansRequest().then(p => {
      setPlans(p);
      setSelectedPlanId(p[0]?.id ?? null);
    }).catch(() => {});
    getTurnstileSiteKeyRequest().then(setTurnstileSiteKey).catch(() => {});
  }, []);

  // Renders the widget once both the site key (fetched above) and the
  // Turnstile script (loaded via index.html's <script>, may not be ready
  // yet) are available — polls briefly since there's no load event hook
  // available from a plain <script> tag added outside React's control.
  useEffect(() => {
    if (!turnstileSiteKey) return;
    let cancelled = false;
    let widgetId: string | null = null;
    const tryRender = () => {
      if (cancelled) return;
      const container = document.getElementById('cf-turnstile');
      if (window.turnstile && container && !widgetId) {
        widgetId = window.turnstile.render(container, {
          sitekey: turnstileSiteKey,
          callback: token => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
        });
      } else if (!widgetId) {
        setTimeout(tryRender, 200);
      }
    };
    tryRender();
    return () => { cancelled = true; };
  }, [turnstileSiteKey]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];
  const c = (light: string, darkCls: string) => (dark ? darkCls : light);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.committeeName || !form.contactName || !form.phone) {
      setError('Committee name, contact name and phone are required.');
      return;
    }
    if (!isPhoneValid(form.phone, true)) {
      setError('Phone number must be at least 10 digits');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committeeName: form.committeeName,
          contactName: form.contactName,
          phone: form.phone,
          email: form.email || undefined,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setSubmitted(true);
      setForm({ committeeName: '', contactName: '', phone: '', email: '' });
      setTurnstileToken('');
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
            Built for Puja & Festival Committees
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-5">
            One Platform. Every Puja.<br className="hidden sm:block" /> Everything Organized.
          </h1>
          <p className={`max-w-2xl mx-auto text-base sm:text-lg mb-3 ${c('text-gray-600', 'text-gray-400')}`}>
            Everything your Puja committee needs, all in one place — manage chanda,
            donations, subscriptions, sponsors, expenses, loans, budgets, estimates and
            tasks with complete clarity and control.
          </p>
          <p className={`text-sm font-medium mb-8 ${c('text-orange-700', 'text-orange-400')}`}>
            Plan. Collect. Manage. Celebrate.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button type="button" onClick={onGoToSignup} className="px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition inline-flex items-center justify-center gap-2 whitespace-nowrap">
              Create Your Committee <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#features" className={`px-6 py-3 rounded-lg border font-medium transition text-center whitespace-nowrap ${c('border-gray-300 hover:bg-gray-50', 'border-gray-700 hover:bg-gray-900')}`}>
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Positioning */}
      <section className={`border-y ${c('border-gray-200 bg-gray-50', 'border-gray-800 bg-gray-900/40')}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-4">
            Not Just Chanda Management. Your Complete Puja Management System.
          </h2>
          <p className={`mb-6 ${c('text-gray-600', 'text-gray-400')}`}>
            A Puja committee handles much more than collecting chanda — plan the budget,
            estimate expenses, arrange initial funds, collect chanda, manage subscriptions
            and member fees, approach sponsors, pay vendors, track partial payments,
            assign committee tasks, manage deadlines, monitor expenses and reconcile
            everything. Durga CRM brings all of it together.
          </p>
          <p className="font-semibold text-orange-600 mb-8">
            One committee. One dashboard. One organized system.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <AndroidBadge dark={dark} />
            <IOSBadge />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Everything Your Puja Committee Already Does — Now Organized</h2>
        <p className={`text-center mb-12 max-w-xl mx-auto ${c('text-gray-600', 'text-gray-400')}`}>
          No complicated accounting system. No scattered notebooks. No hunting
          through WhatsApp conversations.
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

      {/* Pricing + Before/After — merged into one section per the Figma
          reference's structure: each column's pricing header sits directly
          above that column's feature rows, instead of a separate pricing
          section above a separate comparison table. "Before" has no
          price (it's the manual/no-tool baseline); "With Durga CRM" gets
          our actual plan card — price, monthly/yearly toggle, CTA — as
          that column's header, then the highlight continues straight down
          through every feature row below it. */}
      <section id="pricing" className={`border-y ${c('border-gray-200 bg-gray-50', 'border-gray-800 bg-gray-900/40')}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-2">
            Still Managing Your Puja With Notebooks, Excel &amp; WhatsApp?
          </h2>
          <p className={`text-center mb-10 text-sm ${c('text-gray-500', 'text-gray-400')}`}>
            Every part of running a Puja, side by side — before and with Durga CRM.
          </p>

          <div className={`rounded-2xl border overflow-hidden ${c('border-gray-200 bg-white', 'border-gray-800 bg-gray-900')}`}>
            {/* Column headers — feature label blank, Before is a plain
                baseline label, With Durga CRM carries the actual pricing
                card. Stacked above the table on mobile instead of a 3rd grid column. */}
            <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr] sm:items-end">
              <div className={`hidden sm:block px-6 py-3 border-b ${c('border-gray-200', 'border-gray-800')}`} />
              <div className={`hidden sm:flex flex-col justify-end px-6 py-3 border-b ${c('border-gray-200', 'border-gray-800')}`}>
                <h3 className={`text-sm font-semibold ${c('text-gray-500', 'text-gray-400')}`}>Before</h3>
                <p className={`text-xs mt-1 ${c('text-gray-400', 'text-gray-500')}`}>Doing it all manually</p>
              </div>
              <div className={`px-5 sm:px-6 py-6 border-b ${c('border-orange-200 bg-orange-50', 'border-orange-900/40 bg-orange-500/10')}`}>
                <h3 className={`text-sm font-bold mb-3 ${c('text-orange-700', 'text-orange-400')}`}>With Durga CRM</h3>
                {plans.length === 0 ? (
                  <p className={`text-sm ${c('text-gray-500', 'text-gray-400')}`}>Pricing coming soon.</p>
                ) : (
                  <>
                    {plans.length > 1 && (
                      <div className={`inline-flex p-0.5 rounded-full mb-3 ${c('bg-white', 'bg-gray-900')}`}>
                        {plans.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPlanId(p.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                              selectedPlanId === p.id ? 'bg-orange-600 text-white' : c('text-gray-500', 'text-gray-400')
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedPlan && (
                      <>
                        <div className={`text-2xl sm:text-3xl font-bold ${c('text-gray-900', 'text-gray-100')}`}>
                          {(selectedPlan.amountPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: selectedPlan.currency, maximumFractionDigits: 0 })}
                          <span className={`text-xs font-normal ml-1 ${c('text-gray-500', 'text-gray-400')}`}>
                            /{selectedPlan.durationMonths === 1 ? 'month' : `${selectedPlan.durationMonths} months`}
                          </span>
                        </div>
                        <a
                          href="#lead-form"
                          className="mt-3 block text-center px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition"
                        >
                          Get started
                        </a>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {comparisonGroups.map((group, gi) => (
              <div key={group.category}>
                <div className={`grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr] ${gi > 0 ? `border-t ${c('border-gray-200', 'border-gray-800')}` : ''}`}>
                  <div className={`px-6 pt-5 pb-2 sm:pb-3 text-sm font-bold ${c('text-gray-900', 'text-gray-100')}`}>{group.category}</div>
                  <div className={`hidden sm:block ${c('bg-white', 'bg-gray-900')}`} />
                  <div className={c('bg-orange-50/60', 'bg-orange-500/5')} />
                </div>
                <div className={`divide-y ${c('divide-gray-100', 'divide-gray-800')}`}>
                  {group.rows.map(row => (
                    <div key={row.feature} className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr]">
                      <div className="px-6 py-3.5 text-sm font-medium">{row.feature}</div>
                      <div className={`px-6 pb-2 sm:py-3.5 text-sm flex items-start gap-1.5 ${c('text-gray-500', 'text-gray-400')}`}>
                        <span className="sm:hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-16">Before</span>
                        {row.before}
                      </div>
                      <div className={`px-6 pb-3.5 sm:py-3.5 text-sm font-medium flex items-start gap-1.5 ${c('bg-orange-50/60 text-gray-800', 'bg-orange-500/5 text-gray-100')}`}>
                        <span className={`sm:hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide w-16 ${c('text-orange-600', 'text-orange-400')}`}>With CRM</span>
                        <CheckCircle2 className={`hidden sm:block w-4 h-4 shrink-0 mt-0.5 ${c('text-orange-600', 'text-orange-400')}`} />
                        {row.after}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className={`text-center mt-10 text-sm ${c('text-gray-500', 'text-gray-400')}`}>
            Less paperwork. Less confusion. More Puja.
          </p>
        </div>
      </section>

      {/* Multi-festival */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold mb-3">One CRM for Every Puja &amp; Community Festival</h2>
        <p className={`mb-8 max-w-2xl mx-auto ${c('text-gray-600', 'text-gray-400')}`}>
          Whether you're organizing a traditional Puja, a large public festival or a
          community celebration, manage the entire operation from one place.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {FESTIVALS.map(name => (
            <span
              key={name}
              className={`px-3.5 py-1.5 rounded-full text-sm ${c('bg-gray-100 text-gray-700', 'bg-gray-800 text-gray-300')}`}
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Emotional closing */}
      <section className={`border-y ${c('border-gray-200 bg-gray-50', 'border-gray-800 bg-gray-900/40')}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-3">Every Puja Has a Story. Every Rupee Has a Record.</h2>
          <p className={`mb-8 ${c('text-gray-600', 'text-gray-400')}`}>
            From the first estimate to the final expense, keep your committee's entire
            journey organized, transparent and easy to manage.
          </p>
          <a href="#lead-form" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition">
            Manage Your Puja <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Lead form */}
      <section id="lead-form" className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Bring your Puja committee online</h2>
        <p className={`text-center mb-10 ${c('text-gray-600', 'text-gray-400')}`}>
          Tell us about your Puja committee — we'll get you set up.
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
                <label className="block text-sm font-medium mb-1.5">Committee name <span className="text-orange-600">*</span></label>
                <input
                  value={form.committeeName}
                  onChange={e => setForm(f => ({ ...f, committeeName: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500 ${c('border-gray-300 bg-white', 'border-gray-700 bg-gray-900')}`}
                  placeholder="e.g. Paschim Pansila Sarbojanin Saradatsav"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Contact name <span className="text-orange-600">*</span></label>
                <input
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500 ${c('border-gray-300 bg-white', 'border-gray-700 bg-gray-900')}`}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone <span className="text-orange-600">*</span></label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: onlyDigits(e.target.value) }))}
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
            {turnstileSiteKey && <div id="cf-turnstile" />}
            {error && <p className={`text-sm ${c('text-red-600', 'text-red-400')}`}>{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-medium transition"
            >
              {submitting ? 'Submitting…' : 'Request Access and Demo'}
            </button>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className={`border-t py-8 text-center text-sm ${c('border-gray-200 text-gray-500', 'border-gray-800 text-gray-400')}`}>
        <p className={`font-medium mb-4 ${c('text-gray-700', 'text-gray-300')}`}>
          Durga CRM — One Platform. Every Puja. Everything Organized.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
          <AndroidBadge dark={dark} />
          <IOSBadge />
        </div>
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
