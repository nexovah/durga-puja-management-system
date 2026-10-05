import { useEffect, useState, type ReactNode } from 'react';
import { Users, IndianRupee, Gift, Landmark, Clock, Award as AwardIcon, TrendingDown } from 'lucide-react';
import loginBackground from '../../assets/login/login-background.svg';

// Shared visual shell for every public-facing auth screen (tenant login/
// signup/forgot-password, Super Admin login/forgot-password) — the
// full-viewport background, the black showcase card with its auto-rotating
// decorative slides, and the responsive desktop-row/mobile-stack layout.
// Single source of truth so every screen that uses it stays pixel-identical
// instead of drifting via copy-paste.

// Static showcase numbers for the login card's mock stat grid — purely
// decorative marketing content (not live data), mirrors the Figma example.
const SHOWCASE_TILES = [
  { icon: Users, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', label: 'Total Members', value: '25', subLabel: 'Paid', subValue: '₹0', tick: 'bg-blue-500' },
  { icon: IndianRupee, iconBg: 'bg-green-50', iconColor: 'text-green-600', label: 'Total Collection', value: '₹108,338', subLabel: 'Collections', subValue: '149', tick: 'bg-green-600' },
  { icon: Gift, iconBg: 'bg-green-50', iconColor: 'text-green-600', label: 'Sponsorship Collection', value: '₹49,800', subLabel: 'Sponsorships', subValue: '32', tick: 'bg-green-600' },
  { icon: Landmark, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', label: 'Loans Outstanding', value: '₹40,000', subLabel: 'Loans', subValue: '1', tick: 'bg-blue-500' },
  { icon: Clock, iconBg: 'bg-orange-50', iconColor: 'text-orange-500', label: 'Outstanding Collection', value: '₹337,904', subLabel: 'Outstanding', subValue: '556', tick: 'bg-orange-500' },
  { icon: Gift, iconBg: 'bg-green-50', iconColor: 'text-green-600', label: 'Donation Collection', value: '₹20,000', subLabel: 'Donations', subValue: '1', tick: 'bg-green-600' },
  { icon: AwardIcon, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', label: 'Awards', value: '₹0', subLabel: 'Awards', subValue: '0', tick: 'bg-blue-500' },
  { icon: TrendingDown, iconBg: 'bg-red-50', iconColor: 'text-red-500', label: 'Total Expenses', value: '₹156,435', subLabel: 'Expenses', subValue: '26', tick: 'bg-red-500' },
] as const;

// Static decorative category-bar data for showcase slide 2 — mirrors the
// app's own DONUT_COLORS category order (Membership, Collection, Donation,
// Sponsorship, Expenses, Loan).
const SHOWCASE_BARS = [
  { label: 'Membership', value: '₹25,000', pct: 62, color: '#f97316' },
  { label: 'Collection', value: '₹108,338', pct: 95, color: '#3b82f6' },
  { label: 'Donation', value: '₹20,000', pct: 48, color: '#8b5cf6' },
  { label: 'Sponsorship', value: '₹49,800', pct: 70, color: '#22c55e' },
  { label: 'Expenses', value: '₹156,435', pct: 88, color: '#eab308' },
  { label: 'Loan', value: '₹40,000', pct: 35, color: '#ef4444' },
] as const;

// Static decorative Cash vs Bank split segments for showcase slide 4.
const SHOWCASE_SPLIT = [
  { label: 'Cash', pct: 38, value: '₹62,000', color: '#f97316' },
  { label: 'Bank', pct: 62, value: '₹101,000', color: '#3b82f6' },
] as const;

function ShowcaseSlideStats() {
  return (
    <div className="w-full h-full flex flex-col justify-center">
      <div className="w-full grid grid-cols-2 gap-3">
        {SHOWCASE_TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="bg-white rounded-2xl p-3 flex items-center gap-2.5 text-left">
              <span className={`w-9 h-9 rounded-full ${tile.iconBg} flex items-center justify-center shrink-0`}>
                <Icon size={16} className={tile.iconColor} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
                <p className="text-base font-bold text-gray-900 leading-tight">{tile.value}</p>
                <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                  <span className={`w-1 h-3 rounded-full ${tile.tick}`} />
                  {tile.subLabel} <span className="font-semibold text-gray-700">{tile.subValue}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShowcaseSlideDonut() {
  // Static conic-gradient ring — purely decorative, fixed angles.
  const gradient = 'conic-gradient(#f97316 0% 22%, #3b82f6 22% 58%, #8b5cf6 58% 72%, #22c55e 72% 100%)';
  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="w-full bg-white rounded-2xl p-6 text-left flex-1 flex flex-col justify-center">
        <p className="text-sm font-bold text-gray-800 mb-5">Collection Breakdown</p>
        <div className="flex items-center gap-6">
          <div className="relative w-36 h-36 shrink-0 rounded-full" style={{ background: gradient }}>
            <div className="absolute inset-[16px] bg-white rounded-full flex flex-col items-center justify-center">
              <span className="text-[11px] text-gray-400">Total</span>
              <span className="text-lg font-bold text-gray-900">₹203,138</span>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            {[
              { label: 'Collection', value: '₹108,338', color: '#3b82f6' },
              { label: 'Sponsorship', value: '₹49,800', color: '#8b5cf6' },
              { label: 'Membership', value: '₹25,000', color: '#f97316' },
              { label: 'Donation', value: '₹20,000', color: '#22c55e' },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="w-1 h-4 rounded shrink-0" style={{ background: row.color }} />
                <span className="text-[13px] text-gray-500 flex-1 truncate">{row.label}</span>
                <span className="text-[13px] font-semibold text-gray-800">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-full bg-white rounded-2xl p-4 flex items-center justify-around text-center">
        {[
          { label: 'Members', value: '25' },
          { label: 'Awards', value: '0' },
          { label: 'Expenses', value: '26' },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-base font-bold text-gray-900">{stat.value}</p>
            <p className="text-[11px] text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcaseSlideBars() {
  return (
    <div className="w-full h-full bg-white rounded-2xl p-6 text-left flex flex-col">
      <p className="text-sm font-bold text-gray-800">Category-wise Summary</p>
      <div className="flex-1 flex flex-col justify-center gap-5 py-2">
        {SHOWCASE_BARS.map((bar) => (
          <div key={bar.label}>
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="text-gray-500">{bar.label}</span>
              <span className="font-semibold text-gray-800">{bar.value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, background: bar.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-[12px] text-gray-500">Total Income</span>
        <span className="text-sm font-bold text-gray-900">₹203,138</span>
      </div>
    </div>
  );
}

function ShowcaseSlideProgress() {
  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="bg-white rounded-2xl p-6 text-left flex-1 flex flex-col justify-center">
        <p className="text-sm font-bold text-gray-800 mb-5">Task Completion Rate</p>
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 shrink-0 rounded-full" style={{ background: 'conic-gradient(#16a34a 0% 72%, #e5e7eb 72% 100%)' }}>
            <div className="absolute inset-[9px] bg-white rounded-full flex items-center justify-center">
              <span className="text-base font-bold text-gray-900">72%</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[13px] text-gray-500">18 of 25 tasks completed</p>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mt-3">
              <div className="h-full rounded-full bg-green-600" style={{ width: '72%' }} />
            </div>
            <div className="flex items-center justify-between mt-4 text-[12px]">
              <span className="text-gray-500">Pending</span>
              <span className="font-semibold text-gray-800">7 tasks</span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 text-left flex-1 flex flex-col justify-center">
        <p className="text-sm font-bold text-gray-800 mb-5">Cash vs Bank Split</p>
        <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
          {SHOWCASE_SPLIT.map((seg) => (
            <div key={seg.label} style={{ width: `${seg.pct}%`, background: seg.color }} />
          ))}
        </div>
        <div className="flex items-center justify-between mt-4">
          {SHOWCASE_SPLIT.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5">
              <span className="w-1 h-4 rounded-full shrink-0" style={{ background: seg.color }} />
              <span className="text-[13px] text-gray-500">{seg.label}</span>
              <span className="text-[13px] font-semibold text-gray-800">{seg.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SHOWCASE_SLIDES = [ShowcaseSlideStats, ShowcaseSlideDonut, ShowcaseSlideBars, ShowcaseSlideProgress];

interface AuthShowcaseLayoutProps {
  heading1: string;
  heading2: string;
  helpTitle: string;
  helpDesc: string;
  formColumn: ReactNode;
}

export function AuthShowcaseLayout({ heading1, heading2, helpTitle, helpDesc, formColumn }: AuthShowcaseLayoutProps) {
  const [showcaseSlide, setShowcaseSlide] = useState(0);
  const [showcaseFaded, setShowcaseFaded] = useState(false);

  const goToShowcaseSlide = (next: number) => {
    setShowcaseFaded(true);
    setTimeout(() => {
      setShowcaseSlide(next);
      setShowcaseFaded(false);
    }, 250);
  };

  useEffect(() => {
    const id = setInterval(() => {
      goToShowcaseSlide((showcaseSlide + 1) % SHOWCASE_SLIDES.length);
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcaseSlide]);

  const cardBody = (
    <>
      <h2 className="text-2xl font-semibold text-white leading-snug mt-[2%] lg:mt-[2%]">
        {heading1}<br />{heading2}
      </h2>

      <div className="w-full mt-6 lg:mt-[7%] h-[400px] overflow-hidden flex flex-col">
        <div className={`flex-1 min-h-0 transition-opacity duration-[250ms] ease-in-out ${showcaseFaded ? 'opacity-0' : 'opacity-100'}`}>
          {(() => {
            const Slide = SHOWCASE_SLIDES[showcaseSlide];
            return <Slide />;
          })()}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-6 lg:mt-[6%]">
        {SHOWCASE_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToShowcaseSlide(i)}
            aria-label={`Showcase slide ${i + 1}`}
            className={`h-1 rounded-full transition-all ${i === showcaseSlide ? 'w-5 bg-orange-600' : 'w-5 bg-white/30'}`}
          />
        ))}
      </div>

      <h3 className="text-white font-semibold mt-4 lg:mt-[4%] text-left w-full">{helpTitle}</h3>
      <p className="text-sm text-gray-400 mt-2 leading-relaxed text-left w-full">
        {helpDesc}
      </p>
    </>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 relative overflow-x-hidden flex items-center justify-center px-4 pt-[5vh] pb-4 lg:p-10">
      {/* Decorative background rings — object-cover so it always fills the
          full viewport (like the Figma source's 1920x1080 frame), at any
          window size, instead of a fixed-width chunk. */}
      <img
        src={loginBackground}
        alt=""
        aria-hidden="true"
        className="hidden lg:block fixed inset-0 w-full h-full object-cover opacity-90 pointer-events-none select-none"
      />

      <div className="relative w-full flex flex-col items-center">
        {/*
          Desktop/tablet row (≥1024px) — card sits to the left of the form
          at its full Figma-matched size on large screens (≥1536px, "2xl"),
          and shrinks as one unit on narrower desktop/tablet widths
          (1024–1536px) so nothing gets cropped or overlaps the form.
        */}
        <div className="hidden lg:flex w-full items-center justify-center px-[6vw] gap-[6vw]">
          <div className="relative w-[414px] h-[640px] min-[1400px]:w-[440px] min-[1400px]:h-[700px] 2xl:w-[520px] 2xl:h-[740px] shrink-0 self-start">
            <div className="relative z-10 flex h-full w-full flex-col items-center text-center rounded-[4px] bg-[#111b2b] p-10 overflow-y-auto">
              {cardBody}
            </div>
          </div>

          {formColumn}
        </div>

        {/* Mobile/narrow layout (<1024px) — background graphics vanish
            entirely; just the form, with the black showcase card stacked
            below it (not beside it). */}
        <div className="lg:hidden w-full flex flex-col items-center gap-10">
          {formColumn}
          <div className="w-full max-w-md flex flex-col items-center text-center rounded-[4px] bg-[#111b2b] p-8">
            {cardBody}
          </div>
        </div>
      </div>
    </div>
  );
}
