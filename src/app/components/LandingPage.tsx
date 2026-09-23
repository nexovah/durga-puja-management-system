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
import { supabase } from '../lib/supabaseClient';
import { getPlatformSettingsRequest } from '../lib/superAdminDb';
import { listSubscriptionPlansRequest, SubscriptionPlan } from '../lib/billingDb';

interface LandingPageProps {
  onGoToLogin: () => void;
  onGoToLegal: (slug: 'terms' | 'privacy' | 'refund') => void;
}

const FEATURES = [
  { icon: Users, title: 'Committee & Members', desc: 'Manage members, roles, designations, contact details, membership fees and subscriptions from one centralized system.' },
  { icon: HandCoins, title: 'Chanda Collection', desc: 'Record chanda collections, contributors, amounts, payment methods, payment status and collection history.' },
  { icon: Megaphone, title: 'Donations & Sponsorship', desc: 'Manage donations, advertisers and sponsors — commitments, amounts, payment status and outstanding collections.' },
  { icon: Receipt, title: 'Expense Management', desc: 'Record expenses, categories, vendors, bills, payment methods, partial payments and outstanding amounts.' },
  { icon: Wallet, title: 'Loan Management', desc: 'Track initial funds and committee loans — lender, amount, repayment status and outstanding balance.' },
  { icon: ClipboardList, title: 'Estimation & Budget', desc: 'Estimate expected costs, plan your budget and compare estimated spending with actual expenses.' },
  { icon: CalendarClock, title: 'Task Management', desc: 'Assign responsibilities, set priorities and track deadlines — nothing forgotten, right up to immersion day.' },
  { icon: Activity, title: 'Activity Log', desc: 'Full audit trail of who changed what, from which device, for complete transparency.' },
];

const BEFORE_ITEMS = [
  'Chanda in notebooks',
  'Member details scattered across contacts',
  'Sponsor information in WhatsApp',
  'Vendor payments difficult to track',
  'Estimates and actual expenses don’t match',
  'Partial payments get forgotten',
  'Loan records are unclear',
  'Tasks get lost in group chats',
];

const AFTER_ITEMS = [
  'Centralized committee & organized members',
  'Chanda collection & donation tracking',
  'Advertisement & sponsorship management',
  'Subscription & member fees',
  'Estimation & budgeting',
  'Expense management & partial payments',
  'Loan management & vendor records',
  'Priority-based tasks & financial dashboard',
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
          <div className="flex items-center justify-center gap-3">
            <a href="#lead-form" className="px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition inline-flex items-center gap-2">
              Create Your Committee <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#features" className={`px-6 py-3 rounded-lg border font-medium transition ${c('border-gray-300 hover:bg-gray-50', 'border-gray-700 hover:bg-gray-900')}`}>
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

      {/* Before vs After */}
      <section className={`border-y ${c('border-gray-200 bg-gray-50', 'border-gray-800 bg-gray-900/40')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-12">
            Still Managing Your Puja With Notebooks, Excel &amp; WhatsApp?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className={`p-6 rounded-xl border ${c('border-gray-200 bg-white', 'border-gray-800 bg-gray-900')}`}>
              <h3 className={`font-medium mb-4 ${c('text-gray-500', 'text-gray-400')}`}>Before</h3>
              <ul className="space-y-2.5">
                {BEFORE_ITEMS.map(item => (
                  <li key={item} className={`text-sm ${c('text-gray-600', 'text-gray-400')}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={`p-6 rounded-xl border ${c('border-orange-200 bg-orange-50', 'border-orange-900/40 bg-orange-900/10')}`}>
              <h3 className="font-medium mb-4 text-orange-600">With Durga CRM</h3>
              <ul className="space-y-2.5">
                {AFTER_ITEMS.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${c('text-orange-600', 'text-orange-400')}`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
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
