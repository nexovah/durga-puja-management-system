import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, Users, HandCoins, Gift, TrendingDown, Wallet,
  Truck, Landmark, CheckSquare, Settings as SettingsIcon, ScrollText,
  FileBarChart, X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

type PageKey = 'dashboard' | 'members' | 'chanda' | 'donationAds' | 'expenses' | 'vendors' | 'loans' | 'treasury' | 'report' | 'settings' | 'activityLog' | 'tasks';

interface SidebarProps {
  logo?: string;
  association: string;
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  permissions?: {
    members?: boolean;
    chanda?: boolean;
    donationAds?: boolean;
    expenses?: boolean;
    treasury?: boolean;
    vendors?: boolean;
    loans?: boolean;
    tasks?: boolean;
    settings?: boolean;
  };
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

type NavItem = { key: PageKey; icon: React.ComponentType<{ size?: number; className?: string }>; label: string; show: boolean };

// Left-hand navigation replacing the old top nav bar — same page set, same
// orange branding, just laid out vertically so every menu item (including
// what used to live behind the "More" dropdown) is visible at once.
// Foldable to an icon-only rail on desktop (`collapsed`); becomes a
// slide-in overlay drawer on mobile (`mobileOpen`), closed by default.
export function Sidebar({
  logo, association, currentPage, onNavigate, permissions, collapsed, mobileOpen, onCloseMobile,
}: SidebarProps) {
  const { t } = useLanguage();
  const [hoveredTooltip, setHoveredTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: t('sidebar.groupMain'),
      items: [
        { key: 'dashboard', icon: LayoutDashboard, label: t('nav.dashboard'), show: true },
        { key: 'chanda', icon: HandCoins, label: t('nav.chanda'), show: !!permissions?.chanda },
        { key: 'donationAds', icon: Gift, label: t('nav.donationAds'), show: !!permissions?.donationAds },
        { key: 'expenses', icon: TrendingDown, label: t('nav.expenses'), show: !!permissions?.expenses },
        { key: 'vendors', icon: Truck, label: t('nav.vendors'), show: !!permissions?.vendors },
        { key: 'members', icon: Users, label: t('nav.members'), show: !!permissions?.members },
      ],
    },
    {
      label: t('sidebar.groupAccounts'),
      items: [
        { key: 'treasury', icon: Wallet, label: t('nav.treasury'), show: !!permissions?.treasury },
        { key: 'report', icon: FileBarChart, label: t('nav.report'), show: !!permissions?.treasury },
        { key: 'loans', icon: Landmark, label: t('nav.loans'), show: !!permissions?.loans },
      ],
    },
    {
      label: t('sidebar.groupEssential'),
      items: [
        { key: 'tasks', icon: CheckSquare, label: t('nav.tasks'), show: !!permissions?.tasks },
        { key: 'activityLog', icon: ScrollText, label: t('nav.activityLog'), show: !!permissions?.settings },
        { key: 'settings', icon: SettingsIcon, label: t('nav.settings'), show: !!permissions?.settings },
      ],
    },
  ];

  const handleSelect = (page: PageKey) => {
    onNavigate(page);
    onCloseMobile();
  };

  const content = (
    <div className="h-full flex flex-col">
      <div className={`flex items-start gap-2.5 shrink-0 ${collapsed ? 'justify-center px-2 py-5' : 'px-4 py-5'}`}>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-lg overflow-hidden shrink-0">
          {logo && (logo.startsWith('data:') || logo.startsWith('http')) ? (
            <img src={logo} alt="Logo" className="w-7 h-7 object-cover rounded" />
          ) : (
            <span className="text-lg leading-none">{logo || '🕉️'}</span>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sm text-gray-900 leading-snug line-clamp-2">{association}</p>
          </div>
        )}
        <button
          onClick={onCloseMobile}
          className="ml-auto lg:hidden text-gray-400 hover:text-gray-600 p-1 shrink-0"
          aria-label={t('common.close')}
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pt-9 pb-2 px-3 space-y-5">
        {groups.map((group) => {
          const visibleItems = group.items.filter(i => i.show);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{group.label}</p>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.key;
                  return (
                    <SidebarNavButton
                      key={item.key}
                      Icon={Icon}
                      label={item.label}
                      active={active}
                      collapsed={collapsed}
                      onClick={() => handleSelect(item.key)}
                      onHoverChange={(rect) => {
                        if (!collapsed) return;
                        setHoveredTooltip(rect ? { label: item.label, top: rect.top + rect.height / 2, left: rect.right } : null);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop rail — flat gray (slightly darker than the page background),
          blending into the browser edge (no border/shadow) per the reference design */}
      <aside className={`hidden lg:block shrink-0 sticky top-0 h-screen bg-[#eceef1] z-30 transition-all duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        {content}
      </aside>

      {/* Mobile overlay drawer — solid white so it reads clearly over the dimmed backdrop */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={onCloseMobile} />
          <aside className="relative w-64 h-full bg-white shadow-xl">
            {content}
          </aside>
        </div>
      )}

      {/* Collapsed-icon tooltip — portaled to <body> so it's never clipped by
          the nav list's own overflow-y:auto (which forces overflow-x to
          clip too, per the CSS overflow spec), fixed-positioned from the
          hovered button's live bounding rect. */}
      {hoveredTooltip && createPortal(
        <div
          className="pointer-events-none fixed z-[100] -translate-y-1/2"
          style={{ top: hoveredTooltip.top, left: hoveredTooltip.left + 12 }}
        >
          <div className="relative bg-white text-gray-800 text-sm font-semibold rounded-lg shadow-lg border border-gray-100 px-3.5 py-2 whitespace-nowrap">
            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[7px] border-r-white" />
            {hoveredTooltip.label}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function SidebarNavButton({
  Icon,
  label,
  active,
  collapsed,
  onClick,
  onHoverChange,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  onHoverChange: (rect: DOMRect | null) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseEnter={() => onHoverChange(buttonRef.current?.getBoundingClientRect() || null)}
      onMouseLeave={() => onHoverChange(null)}
      className={`w-full flex items-center gap-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
        collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
      } ${
        active
          ? 'bg-orange-50 text-orange-600'
          : 'text-gray-700 hover:text-orange-600 hover:bg-orange-50'
      }`}
    >
      <Icon size={19} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
