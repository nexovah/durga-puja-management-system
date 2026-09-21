import { useState } from 'react';
import {
  Users, Wallet, Megaphone, Receipt, HandCoins, ClipboardList,
  CalendarClock, Activity, Moon, Sun, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface LandingPageProps {
  onGoToLogin: () => void;
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

type BillingCycle = 'monthly' | 'yearly';

const PRICING = {
  monthly: { amount: '₹499', period: '/month' },
  yearly: { amount: '₹4,999', period: '/year' },
};

export function LandingPage({ onGoToLogin }: LandingPageProps) {
  const [dark, setDark] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [form, setForm] = useState({ committeeName: '', contactName: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-lg">🕉️</div>
              <span className="font-semibold text-lg">Durga CRM</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDark(d => !d)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
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
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
            <div className="inline-block px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium mb-5">
              Built for Any Puja committees
            </div>
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-5">
              Run your puja committee<br className="hidden sm:block" /> like a well-oiled machine
            </h1>
            <p className="max-w-2xl mx-auto text-gray-600 dark:text-gray-400 text-base sm:text-lg mb-8">
              Members, chanda collection, donation ads, expenses, vendors, budgeting
              and tasks — everything your committee needs, in one simple dashboard.
            </p>
            <div className="flex items-center justify-center gap-3">
              <a href="#pricing" className="px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition inline-flex items-center gap-2">
                See pricing <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#lead-form" className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 font-medium transition">
                Get started
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Everything your committee already does — organized</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-xl mx-auto">
            No new workflow to learn. Just the same committee work, without the WhatsApp
            groups, notebooks and spreadsheets.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md hover:-translate-y-0.5 transition bg-white dark:bg-gray-900">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="font-medium mb-1.5">{title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Simple pricing, one plan</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Everything included. No hidden tiers.
          </p>
          <div className="flex items-center justify-center mb-10">
            <div className="inline-flex p-1 rounded-full bg-gray-100 dark:bg-gray-800">
              {(['monthly', 'yearly'] as BillingCycle[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                    cycle === c
                      ? 'bg-white dark:bg-gray-950 shadow text-gray-900 dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {c === 'monthly' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>
          </div>
          <div className="max-w-sm mx-auto p-8 rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-900 text-center">
            <div className="text-4xl font-semibold mb-1">
              {PRICING[cycle].amount}
              <span className="text-base font-normal text-gray-500 dark:text-gray-400">{PRICING[cycle].period}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Billed {cycle}, cancel anytime</p>
            <ul className="text-left space-y-2.5 mb-8">
              {['Unlimited members & users', 'All collection modules', 'Budgeting & estimation', 'Task management', 'Full activity log', 'Priority support'].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <a href="#lead-form" className="block w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition">
              Get started
            </a>
          </div>
        </section>

        {/* Lead form */}
        <section id="lead-form" className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Bring your committee online</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-10">
            Tell us about your committee — we'll get you set up.
          </p>
          {submitted ? (
            <div className="p-6 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <p className="font-medium">Thanks! We've received your details.</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Our team will reach out shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Committee name *</label>
                  <input
                    value={form.committeeName}
                    onChange={e => setForm(f => ({ ...f, committeeName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. Paschim Pansila Sarbojanin Saradatsav"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Contact name *</label>
                  <input
                    value={form.contactName}
                    onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone *</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="optional"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
        <footer className="border-t border-gray-200 dark:border-gray-800 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} Durga CRM. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
