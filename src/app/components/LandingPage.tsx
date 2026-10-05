import { useEffect, useRef, useState } from 'react';
import {
  Moon, Sun, CheckCircle2, ArrowRight,
  Menu, X, ReceiptText, WalletCards, Landmark, ShieldCheck, Sparkles, Check,
} from 'lucide-react';
import androidDownloadIcon from '../assets/android-download-icon.svg';
import iosAppIcon from '../assets/ios-app-icon.svg';
import '../../styles/landingV2.css';

// Static APK hosted by this app itself (public/downloads/) — a permanent
// same-origin URL, unlike EAS's signed build-artifact links which expire.
const ANDROID_APK_URL = '/downloads/durga-crm.apk';

// A Play-Store-style download badge — same two-line "GET IT ON" layout as
// the familiar Play Store badge, but with its own icon/wording since this
// is a direct APK download, not a real Play Store listing (using Google's
// actual mark here would misrepresent the distribution channel).
function AndroidBadge({ className = '' }: { className?: string }) {
  return (
    <a
      href={ANDROID_APK_URL}
      download
      aria-label="Download the Android app (APK)"
      className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white transition ${className}`}
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
      className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 ${className}`}
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

// Screenshots brought in from the Lovable-designed landing page (fetched
// from its CDN export, see public/landing/ — plain static files, no build
// step needed).
const IMG = {
  dashboard: '/landing/dashboard.png',
  collection: '/landing/collection.png',
  expenses: '/landing/expenses.png',
  treasury: '/landing/treasury.png',
  expenseDetail: '/landing/expense-detail.png',
  receipt: '/landing/receipt.png',
  committee: '/landing/committee.png',
  navigation: '/landing/navigation.png',
  darkDashboard: '/landing/dark-dashboard.png',
};

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

// Scattered around the hero's dashboard image (see the floating-pills
// block in the hero section) — each positioned + independently tilted so
// they read as loosely floating rather than lined up in a row.
const FLOATING_FESTIVALS = [
  { name: 'Durga Puja', className: '-top-6 left-8 -rotate-6' },
  { name: 'Kali Puja', className: '-top-9 left-1/3 rotate-3' },
  { name: 'Jagaddhatri Puja', className: '-top-5 right-16 rotate-6' },
  { name: 'Lakshmi Puja', className: 'top-1/4 -left-6 -rotate-3 xl:-left-16' },
  { name: 'Saraswati Puja', className: 'top-10 -right-6 rotate-3 xl:-right-16' },
  { name: 'Ganesh Chaturthi', className: 'bottom-1/3 -left-8 rotate-6 xl:-left-20' },
  { name: 'Navratri', className: 'bottom-1/4 -right-8 -rotate-6 xl:-right-20' },
  { name: 'Diwali', className: '-bottom-6 left-10 rotate-3' },
  { name: 'Dussehra', className: '-bottom-9 left-1/2 -rotate-3' },
  { name: 'Rath Yatra', className: '-bottom-6 right-12 rotate-6' },
  // Further outside the banner's left/right edges, past the inner ring
  // above — spread top-to-bottom on each side so the image reads as
  // surrounded on every side.
  { name: 'Basanti Puja', className: 'top-6 -left-24 -rotate-6 xl:-left-32' },
  { name: 'Vishwakarma Puja', className: 'top-1/2 -left-28 -translate-y-1/2 rotate-3 xl:-left-36' },
  { name: 'Kojagari Lakshmi Puja', className: 'bottom-6 -left-24 -rotate-3 xl:-left-32' },
  { name: 'Poila Boishakh', className: 'bottom-24 -left-20 rotate-6 xl:-left-28' },
  { name: 'Kartik Puja', className: 'top-6 -right-24 rotate-6 xl:-right-32' },
  { name: 'Christmas Festival', className: 'top-1/2 -right-28 -translate-y-1/2 -rotate-3 xl:-right-36' },
  { name: 'Gangasagar Mela', className: 'bottom-6 -right-24 rotate-3 xl:-right-32' },
  { name: 'Basanta Utsav', className: 'bottom-24 -right-20 -rotate-6 xl:-right-28' },
];

const featureGroups = [
  { label: 'Finance', items: 'Collection, Donation, Sponsorship, Expenses, Treasury, Loans, Estimation, Reports' },
  { label: 'People', items: 'Members, Sponsors, Vendors' },
  { label: 'Operations', items: 'Tasks, Documents, Assets, Awards' },
  { label: 'Control', items: 'Activity Log, Settings, Navigation, User Management' },
];

function BrandMark({ platformLogo }: { platformLogo: string }) {
  return (
    <span className="flex items-center gap-2.5 font-extrabold text-foreground">
      <span className="grid size-8 place-items-center rounded-full bg-primary text-sm text-primary-foreground overflow-hidden">
        {platformLogo ? <img src={platformLogo} alt="" className="w-full h-full object-cover" /> : 'ॐ'}
      </span>
      DURGA CRM
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{children}</p>;
}

// This page uses its own scoped design tokens (.puja-landing-v2 in
// landingV2.css) instead of the rest of the app's semantic color tokens —
// see that file's header comment for why. Dark mode here is driven purely
// by this page's own `dark` state (a `dark` class toggled on the wrapper),
// independent of the app-wide ThemeContext (same reasoning as before: a
// public marketing page shouldn't inherit a returning visitor's in-app
// theme preference).
export function LandingPage({ onGoToLogin, onGoToSignup, onGoToLegal }: LandingPageProps) {
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  // Direction-aware swap between the sticky top header and the sticky
  // bottom CTA bar: scrolling DOWN past the hero hides the header and
  // shows the bottom bar (keeps the two primary actions reachable without
  // competing with the header for the same strip of screen); scrolling UP
  // at any point brings the header straight back and hides the bottom bar
  // — a quick upward flick is read as "I want to get back to the top nav."
  // Near the very top (<=80px) the header always shows, bar always hidden,
  // regardless of direction.
  const [scrolledPast, setScrolledPast] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const y = window.scrollY;
      if (y <= 80) {
        setScrolledPast(false);
      } else if (y > lastY) {
        setScrolledPast(true); // scrolling down
      } else if (y < lastY) {
        setScrolledPast(false); // scrolling up
      }
      lastY = y;
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Floating festival chips: a slow continuous drift (sine-wave bob, each
  // chip its own phase so they never sync up) plus a gentle push-away from
  // the mouse cursor when it passes near one — driven by one requestAnimationFrame
  // loop instead of per-frame React state. Each chip's own base tilt (its
  // rotate-N/-rotate-N Tailwind class) is parsed once up front and
  // re-applied every frame alongside the drift offset, since setting an
  // inline transform on the chip itself overrides that class — this way
  // the whole pill moves as one piece instead of just its text.
  const heroImageRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const chipTilts = FLOATING_FESTIVALS.map(({ className }) => {
    const match = className.match(/(-?)rotate-(\d+)/);
    if (!match) return 0;
    return (match[1] === '-' ? -1 : 1) * Number(match[2]);
  });
  useEffect(() => {
    const mouse = { x: -9999, y: -9999, active: false };
    const current = FLOATING_FESTIVALS.map(() => ({ x: 0, y: 0 }));
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const handleMouseLeave = () => { mouse.active = false; };
    const el = heroImageRef.current;
    el?.addEventListener('mousemove', handleMouseMove);
    el?.addEventListener('mouseleave', handleMouseLeave);

    let raf = 0;
    const tick = (time: number) => {
      chipRefs.current.forEach((chip, i) => {
        if (!chip) return;
        const bobY = Math.sin(time / 1400 + i * 1.3) * 5;

        let repelX = 0;
        let repelY = 0;
        if (mouse.active) {
          const rect = chip.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = cx - mouse.x;
          const dy = cy - mouse.y;
          const dist = Math.hypot(dx, dy);
          const radius = 110;
          if (dist < radius && dist > 0.01) {
            const strength = ((radius - dist) / radius) * 22;
            repelX = (dx / dist) * strength;
            repelY = (dy / dist) * strength;
          }
        }

        // Ease current position toward the target each frame — a soft
        // spring-like feel instead of snapping, so it reads as "playing"
        // with the cursor rather than just jumping away from it.
        const target = current[i];
        target.x += (repelX - target.x) * 0.12;
        target.y += (bobY + repelY - target.y) * 0.12;
        chip.style.transform = `rotate(${chipTilts[i]}deg) translate(${target.x.toFixed(2)}px, ${target.y.toFixed(2)}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el?.removeEventListener('mousemove', handleMouseMove);
      el?.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];

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
    <div className={`puja-landing-v2 min-h-screen ${dark ? 'dark' : ''}`}>
      {/* Top header — hidden past ~80px scroll depth, replaced by the
          sticky bottom CTA bar below. */}
      <header className={`sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur transition-transform duration-300 ${scrolledPast ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="section-shell flex items-center justify-between py-3">
          <a href="#top" aria-label="Durga CRM home"><BrandMark platformLogo={platformLogo} /></a>
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex" aria-label="Main navigation">
            <a className="text-muted-foreground transition-colors hover:text-foreground" href="#features">Features</a>
            <a className="text-muted-foreground transition-colors hover:text-foreground" href="#how-it-works">How It Works</a>
            <a className="text-muted-foreground transition-colors hover:text-foreground" href="#pricing">Pricing</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => setDark(d => !d)}
              className="p-2 rounded-full text-muted-foreground hover:bg-muted transition"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className="px-3 py-2 text-sm font-semibold text-foreground" onClick={onGoToLogin}>Login</button>
            <button
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-md"
              onClick={onGoToSignup}
            >
              Create Your Committee
            </button>
          </div>
          <button className="grid size-11 place-items-center text-foreground md:hidden" onClick={() => setMobileNavOpen(o => !o)} aria-expanded={mobileNavOpen} aria-label="Toggle menu">
            {mobileNavOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileNavOpen && (
          <nav className="section-shell grid gap-1 border-t border-border py-4 md:hidden" aria-label="Mobile navigation">
            {[['Features', '#features'], ['How It Works', '#how-it-works'], ['Pricing', '#pricing']].map(([label, href]) => (
              <a key={href} className="py-3 font-semibold" href={href} onClick={() => setMobileNavOpen(false)}>{label}</a>
            ))}
            <button
              className="mt-2 p-2 self-start text-sm font-semibold text-muted-foreground flex items-center gap-2"
              onClick={() => setDark(d => !d)}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} Toggle theme
            </button>
            <button className="py-3 text-left font-semibold" onClick={() => { setMobileNavOpen(false); onGoToLogin(); }}>Login</button>
            <button
              className="mt-2 rounded-md bg-primary px-4 py-3 text-center font-bold text-primary-foreground"
              onClick={() => { setMobileNavOpen(false); onGoToSignup(); }}
            >
              Create Your Committee
            </button>
          </nav>
        )}
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-16 sm:pb-24 sm:pt-20">
          <div className="section-shell text-center">
            <div className="reveal mx-auto max-w-4xl">
              <Eyebrow>Built for Puja &amp; festival committees</Eyebrow>
              <h1 className="text-4xl font-extrabold leading-[1.05] text-foreground sm:text-6xl lg:text-7xl">
                One Platform. Every Puja.<br /><span className="text-primary">Everything Organized.</span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Everything your Puja committee needs, all in one place — manage collections, donations, sponsors, expenses, loans, budgets, tasks and reports with complete clarity.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button type="button" onClick={onGoToSignup} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg">
                  Create Your Committee <ArrowRight size={17} />
                </button>
                <a className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 font-bold text-foreground transition hover:border-primary" href="#features">Explore Features</a>
              </div>
              <p className="mt-6 text-sm font-semibold text-muted-foreground">Plan. Collect. Manage. Celebrate.</p>
            </div>

            <div ref={heroImageRef} className="reveal reveal-delay relative mx-auto mt-16 max-w-6xl lg:mt-20">
              <div className="image-frame relative z-10 p-1.5 sm:p-2">
                <img src={IMG.dashboard} alt="Durga CRM dashboard showing collections, expenses and balances" className="block aspect-[1.46] w-full object-cover" />
              </div>

              {/* Floating festival-name pills — scattered around/over the
                  hero image group, desktop only, each independently tilted
                  so they read as "floating" rather than lined up. Purely
                  decorative (z-20, above the images) — conveys that every
                  kind of Puja/festival can be managed in the same CRM.
                  Position/size/colors unchanged — the base tilt (parsed out
                  of its own rotate-N/-rotate-N class below) is re-applied
                  every frame alongside the drift/mouse-repel offset, so the
                  whole pill (not just its text) moves as one piece. */}
              {FLOATING_FESTIVALS.map(({ name, className }, i) => (
                <span
                  key={name}
                  ref={el => { chipRefs.current[i] = el; }}
                  className={`absolute z-20 hidden lg:block cursor-pointer whitespace-nowrap rounded-full border border-border bg-card px-[15.4px] py-[6.3px] text-xs font-semibold text-foreground shadow-md will-change-transform ${className}`}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Old way */}
        <section className="border-y border-border bg-card py-20 sm:py-28" id="how-it-works">
          <div className="section-shell grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Eyebrow>The old way</Eyebrow>
              <h2 className="text-3xl font-extrabold leading-tight sm:text-5xl">Still managing your Puja with notebooks, Excel &amp; WhatsApp?</h2>
              <p className="mt-6 max-w-xl leading-7 text-muted-foreground">Paper receipts get lost. Sponsor commitments stay in chats. Balances depend on manual calculation. The committee never sees one complete picture.</p>
              <p className="mt-8 border-l-2 border-primary pl-5 text-xl font-bold">Everything moves into one system.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Paper receipts', 'Scattered contacts', 'WhatsApp follow-ups', 'Manual balances'].map((item, index) => (
                <div key={item} className="flex min-h-28 items-end border border-border bg-background p-5">
                  <span className="mr-auto text-sm font-bold text-muted-foreground">0{index + 1}</span>
                  <span className="max-w-32 text-right font-bold">{item}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-md bg-foreground p-6 text-background sm:col-span-2">
                <span className="text-lg font-extrabold">Before</span><ArrowRight className="text-primary" /><span className="text-lg font-extrabold">Durga CRM</span>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison table — dynamic (Super Admin can edit via CMS) */}
        <section className="py-20 sm:py-28">
          <div className="section-shell">
            <div className="max-w-2xl">
              <Eyebrow>One source of truth</Eyebrow>
              <h2 className="text-3xl font-extrabold sm:text-5xl">From scattered records to complete control.</h2>
            </div>
            <div className="mt-12 overflow-hidden border border-border bg-card">
              <div className="hidden grid-cols-[0.7fr_1fr_1fr] border-b border-border bg-muted px-6 py-4 text-xs font-extrabold uppercase tracking-widest text-muted-foreground md:grid">
                <span>Feature</span><span>Before</span><span>With Durga CRM</span>
              </div>
              {comparisonGroups.map(group => (
                <div key={group.category}>
                  <div className="px-6 pt-5 pb-2 text-xs font-extrabold uppercase tracking-widest text-primary">{group.category}</div>
                  {group.rows.map(row => (
                    <div key={row.feature} className="grid gap-2 border-b border-border px-5 py-5 last:border-0 md:grid-cols-[0.7fr_1fr_1fr] md:items-center md:px-6">
                      <strong>{row.feature}</strong>
                      <span className="text-sm text-muted-foreground line-through decoration-destructive/50">{row.before}</span>
                      <span className="flex items-center gap-2 text-sm font-semibold"><Check size={16} className="text-chart-2" />{row.after}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product showcase */}
        <section id="features" className="bg-foreground py-20 text-background sm:py-28">
          <div className="section-shell">
            <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
              <div className="lg:sticky lg:top-32 lg:self-start">
                <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">The product, in practice</p>
                <h2 className="text-4xl font-extrabold sm:text-5xl">See your Puja, clearly.</h2>
                <p className="mt-6 leading-7 text-background/65">Move from collection to expenses to treasury without losing context. Every screen belongs to the same committee.</p>
                <div className="mt-8 hidden space-y-2 text-sm font-bold lg:block">
                  {['01 Dashboard', '02 Collection', '03 Expenses', '04 Treasury'].map(x => <p key={x} className="border-b border-background/15 py-3">{x}</p>)}
                </div>
              </div>
              <div className="space-y-12 sm:space-y-20">
                {[
                  [IMG.dashboard, 'Dashboard', 'The full financial picture, at a glance.'],
                  [IMG.collection, 'Collection', 'Every contribution and pending amount recorded.'],
                  [IMG.expenses, 'Expenses', 'Paid, partial and pending payments stay visible.'],
                  [IMG.treasury, 'Treasury', 'Cash, bank and monthly performance in one place.'],
                ].map(([src, title, copy]) => (
                  <figure key={title}>
                    <div className="overflow-hidden rounded-md border border-background/15 bg-background/5 p-1.5"><img src={src} alt={`Durga CRM ${title} screen`} loading="lazy" className="aspect-[1.45] w-full object-cover" /></div>
                    <figcaption className="mt-5 flex items-start justify-between gap-4 border-t border-background/15 pt-4"><span className="font-extrabold">{title}</span><span className="max-w-sm text-right text-sm text-background/60">{copy}</span></figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Financial confidence */}
        <section className="py-20 sm:py-28">
          <div className="section-shell">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Eyebrow>Financial confidence</Eyebrow>
                <h2 className="text-4xl font-extrabold sm:text-5xl">Know where every rupee goes.</h2>
                <p className="mt-6 max-w-lg leading-7 text-muted-foreground">Collections, donations and sponsorships flow in. Expenses and commitments flow out. Durga CRM makes the current position clear.</p>
                <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
                  {[['Collection', '+'], ['Donation', '+'], ['Sponsorship', '+'], ['Expenses', '−'], ['Commitments', '−'], ['Position', '=']].map(([label, sign]) => (
                    <div key={label} className="bg-card p-5"><span className="text-2xl font-extrabold text-primary">{sign}</span><p className="mt-4 text-sm font-bold">{label}</p></div>
                  ))}
                </div>
              </div>
              <div className="image-frame p-1.5"><img src={IMG.darkDashboard} alt="Durga CRM financial dashboard in dark mode" loading="lazy" className="aspect-[1.45] w-full object-cover" /></div>
            </div>
          </div>
        </section>

        {/* Treasury */}
        <section className="border-y border-border bg-card py-20 sm:py-28">
          <div className="section-shell text-center">
            <Eyebrow>Treasury</Eyebrow>
            <h2 className="text-4xl font-extrabold sm:text-5xl">Your Puja's financial control center.</h2>
            <p className="mx-auto mt-6 max-w-2xl leading-7 text-muted-foreground">See collection, donation, sponsorship, expenses, current balance, cash in hand and money in bank — without manual reconciliation.</p>
            <div className="image-frame mt-12 p-1.5"><img src={IMG.treasury} alt="Durga CRM Treasury financial summary" loading="lazy" className="aspect-[1.45] w-full object-cover" /></div>
          </div>
        </section>

        {/* Three connected flows */}
        <section className="py-20 sm:py-28">
          <div className="section-shell">
            <div className="mb-12 max-w-3xl"><Eyebrow>Three connected flows</Eyebrow><h2 className="text-4xl font-extrabold sm:text-5xl">Every contribution. Properly accounted for.</h2></div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                [ReceiptText, 'Collection', 'Every collection, properly recorded.'],
                [WalletCards, 'Donation', 'Every contribution, accounted for.'],
                [Landmark, 'Sponsorship', 'Every sponsor, organized.'],
              ].map(([Icon, title, copy]) => {
                const FeatureIcon = Icon as typeof ReceiptText;
                return <article key={String(title)} className="border-t-2 border-primary bg-card p-7 shadow-sm"><FeatureIcon className="text-primary" /><h3 className="mt-10 text-xl font-extrabold">{String(title)}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{String(copy)}</p></article>;
              })}
            </div>
            <div className="image-frame mt-8 p-1.5"><img src={IMG.collection} alt="Durga CRM collection management interface" loading="lazy" className="aspect-[1.45] w-full object-cover" /></div>
          </div>
        </section>

        {/* Expense management */}
        <section className="bg-secondary py-20 sm:py-28">
          <div className="section-shell grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="order-2 lg:order-1 image-frame p-1.5"><img src={IMG.expenseDetail} alt="Durga CRM detailed expense and partial payment tracking" loading="lazy" className="aspect-[1.45] w-full object-cover" /></div>
            <div className="order-1 lg:order-2">
              <Eyebrow>Expense management</Eyebrow>
              <h2 className="text-4xl font-extrabold sm:text-5xl">Expenses without the guesswork.</h2>
              <p className="mt-6 leading-7 text-muted-foreground">Track vendor, amount, category, paid amount, payment method, voucher and remarks. Partial payments remain visible until they are settled.</p>
              <div className="mt-8 inline-flex items-center gap-3 border-l-2 border-primary pl-4 font-bold"><ShieldCheck className="text-primary" />Partial-payment tracking built in</div>
            </div>
          </div>
        </section>

        {/* Beyond accounting */}
        <section className="py-20 sm:py-28">
          <div className="section-shell">
            <div className="grid items-end gap-8 lg:grid-cols-2"><div><Eyebrow>Beyond accounting</Eyebrow><h2 className="text-4xl font-extrabold sm:text-5xl">Run the committee. Not just the accounts.</h2></div><p className="max-w-lg leading-7 text-muted-foreground lg:justify-self-end">Manage members, tasks, documents, assets, awards, settings and every change made by the committee.</p></div>
            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              <figure className="image-frame p-1.5"><img src={IMG.receipt} alt="Durga CRM digital receipt configuration" loading="lazy" className="aspect-[1.45] w-full object-cover" /><figcaption className="p-5 font-bold">Digital receipts, designed for your committee</figcaption></figure>
              <figure className="image-frame p-1.5"><img src={IMG.navigation} alt="Durga CRM navigation and feature settings" loading="lazy" className="aspect-[1.45] w-full object-cover" /><figcaption className="p-5 font-bold">Committee-level navigation and control</figcaption></figure>
            </div>
          </div>
        </section>

        {/* Product architecture */}
        <section className="border-y border-border bg-card py-20 sm:py-28">
          <div className="section-shell">
            <div className="max-w-2xl"><Eyebrow>Product architecture</Eyebrow><h2 className="text-4xl font-extrabold sm:text-5xl">One connected system for the whole committee.</h2></div>
            <div className="mt-12 grid border-l border-t border-border sm:grid-cols-2 lg:grid-cols-4">
              {featureGroups.map((group, index) => (
                <article key={group.label} className="min-h-64 border-b border-r border-border p-6 sm:p-8"><span className="text-xs font-bold text-primary">0{index + 1}</span><h3 className="mt-16 text-xl font-extrabold uppercase">{group.label}</h3><p className="mt-4 text-sm leading-7 text-muted-foreground">{group.items}</p></article>
              ))}
            </div>
            <div className="image-frame mt-8 p-1.5"><img src={IMG.committee} alt="Durga CRM committee information settings" loading="lazy" className="aspect-[1.45] w-full object-cover" /></div>
          </div>
        </section>

        {/* Reliability */}
        <section className="py-20 sm:py-28">
          <div className="section-shell grid gap-12 lg:grid-cols-2">
            <div><Eyebrow>Reliability</Eyebrow><h2 className="text-4xl font-extrabold sm:text-6xl">Everything organized.<br />Nothing forgotten.</h2></div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {['Centralized records', 'Clear financial visibility', 'Transparent activity', 'Digital receipts', 'Organized documents', 'Structured tasks'].map(item => <div key={item} className="flex min-h-24 items-center gap-3 bg-background p-5 text-sm font-bold"><Check size={17} className="text-chart-2" />{item}</div>)}
            </div>
          </div>
        </section>

        {/* Pricing — dynamic (fetched from Super Admin's subscription plans) */}
        <section id="pricing" className="bg-foreground py-20 text-background sm:py-28">
          <div className="section-shell text-center">
            <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Simple pricing</p>
            <h2 className="text-4xl font-extrabold sm:text-5xl">Choose the rhythm that works for your committee.</h2>
            {plans.length === 0 ? (
              <p className="mt-12 text-background/60">Pricing coming soon.</p>
            ) : (
              <>
                <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
                  {plans.map(p => (
                    <article
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`cursor-pointer text-left border p-7 sm:p-9 transition ${
                        selectedPlanId === p.id
                          ? 'relative border-2 border-primary bg-background text-foreground'
                          : 'border-background/20'
                      }`}
                    >
                      {selectedPlanId === p.id && (
                        <span className="absolute right-4 top-4 bg-primary px-3 py-1 text-xs font-extrabold uppercase text-primary-foreground">Selected</span>
                      )}
                      <p className={`text-sm font-bold ${selectedPlanId === p.id ? 'text-muted-foreground' : 'text-background/60'}`}>{p.name}</p>
                      <p className="mt-7 text-5xl font-extrabold">
                        {(p.amountPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 })}
                      </p>
                      <p className={`mt-2 text-sm ${selectedPlanId === p.id ? 'text-muted-foreground' : 'text-background/60'}`}>
                        per {p.durationMonths === 1 ? 'month' : `${p.durationMonths} months`}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <a className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-6 font-bold text-primary-foreground" href="#lead-form">
                    Start Managing Your Puja <ArrowRight size={17} />
                  </a>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Closing + lead form, merged into one section */}
        <section id="lead-form" className="relative overflow-hidden py-24 sm:py-36 max-sm:[scroll-margin-top:-35px]">
          <div aria-hidden="true" className="absolute -right-24 top-1/2 size-72 -translate-y-1/2 rounded-full border-[48px] border-primary/10" />
          <div className="section-shell relative">
            <div className="text-center">
              <Sparkles className="mx-auto mb-6 text-primary" />
              <h2 className="mx-auto max-w-4xl text-4xl font-extrabold sm:text-6xl">Your Puja deserves better than a spreadsheet.</h2>
              <p className="mx-auto mt-6 max-w-2xl leading-7 text-muted-foreground">
                Tell us about your Puja committee — we'll get you set up. Bring your committee, collections, expenses, sponsors and financial records into one organized system.
              </p>
            </div>
            <div className="mt-12 max-w-2xl mx-auto">
          {submitted ? (
            <div className="p-6 rounded-md border border-chart-2/30 bg-chart-2/10 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-chart-2" />
              <p className="font-bold">Thanks! We've received your details.</p>
              <p className="text-sm mt-1 text-muted-foreground">Our team will reach out shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Committee name <span className="text-primary">*</span></label>
                  <input
                    value={form.committeeName}
                    onChange={e => setForm(f => ({ ...f, committeeName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-md border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Paschim Pansila Sarbojanin Saradatsav"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Contact name <span className="text-primary">*</span></label>
                  <input
                    value={form.contactName}
                    onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-md border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Phone <span className="text-primary">*</span></label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: onlyDigits(e.target.value) }))}
                    className="w-full px-3.5 py-2.5 rounded-md border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-md border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="optional"
                  />
                </div>
              </div>
              {turnstileSiteKey && <div id="cf-turnstile" />}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-12 rounded-md bg-primary hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 text-primary-foreground font-bold transition"
              >
                {submitting ? 'Submitting…' : 'Request Access and Demo'}
              </button>
            </form>
          )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-card py-10 pb-[110px]">
          <div className="section-shell grid grid-cols-1 gap-7 sm:grid-cols-3 sm:items-center">
            <div>
              <BrandMark platformLogo={platformLogo} />
              <p className="text-sm leading-6 text-muted-foreground mt-3">One platform for every Puja committee — collections, expenses, people and operations, organized.</p>
            </div>
            <div>
              <p className="text-sm font-bold">Download our mobile apps</p>
              <div className="flex flex-wrap items-center gap-[5px] mt-3">
                <AndroidBadge className="scale-[0.82] origin-left" />
                <IOSBadge className="scale-[0.82] origin-left" />
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <button onClick={() => onGoToLegal('terms')} className="whitespace-nowrap text-muted-foreground hover:text-primary hover:underline">Terms &amp; Conditions</button>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <button onClick={() => onGoToLegal('privacy')} className="whitespace-nowrap text-muted-foreground hover:text-primary hover:underline">Privacy Policy</button>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <button onClick={() => onGoToLegal('refund')} className="whitespace-nowrap text-muted-foreground hover:text-primary hover:underline">Refund Policy</button>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">© {new Date().getFullYear()} Durga CRM. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>

      {/* Sticky bottom CTA bar — takes over from the top header past ~80px
          scroll depth, keeping both primary actions reachable. */}
      <div
        className={`fixed bottom-0 inset-x-0 z-40 border-t border-border backdrop-blur bg-background/95 transition-transform duration-300 ${scrolledPast ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="section-shell py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onGoToSignup}
            className="flex-1 min-w-0 h-[50px] px-5 rounded-md bg-primary transition flex flex-col items-center justify-center"
          >
            <span className="text-primary-foreground font-bold truncate leading-tight">
              <span className="sm:hidden">Create Committee</span>
              <span className="hidden sm:inline">Create Your Committee</span>
            </span>
            <span className="text-[11px] text-primary-foreground/80 mt-px leading-tight">Avail 1 Month FREE</span>
          </button>
          <a
            href="#lead-form"
            className="flex-1 min-w-0 h-[50px] px-5 rounded-md transition bg-[#feeda9] hover:bg-[#fde48a] flex flex-col items-center justify-center"
          >
            <span className="text-gray-900 font-bold truncate leading-tight">
              <span className="sm:hidden">Request Demo</span>
              <span className="hidden sm:inline">Request Access and Demo</span>
            </span>
            <span className="text-[11px] text-gray-500 mt-px leading-tight">Claim 1 Month FREE</span>
          </a>
        </div>
      </div>
    </div>
  );
}
