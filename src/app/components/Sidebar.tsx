import {
  LayoutDashboard, Users, HandCoins, Gift, TrendingDown, Wallet,
  Store, Landmark, CheckSquare, Settings as SettingsIcon, ScrollText,
  PanelLeftClose, PanelLeftOpen, X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

type PageKey = 'dashboard' | 'members' | 'chanda' | 'donationAds' | 'expenses' | 'vendors' | 'loans' | 'treasury' | 'settings' | 'activityLog' | 'tasks';

interface SidebarProps {
  logo?: string;
  association: string;
  regdLine?: string;
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
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

// Left-hand navigation replacing the old top nav bar — same page set, same
// orange branding, just laid out vertically so every menu item (including
// what used to live behind the "More" dropdown) is visible at once.
// Foldable to an icon-only rail on desktop (`collapsed`); becomes a
// slide-in overlay drawer on mobile (`mobileOpen`), closed by default.
export function Sidebar({
  logo, association, regdLine, currentPage, onNavigate, permissions, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile,
}: SidebarProps) {
  const { t } = useLanguage();

  const items: { key: PageKey; icon: React.ComponentType<{ size?: number; className?: string }>; label: string; show: boolean }[] = [
    { key: 'dashboard', icon: LayoutDashboard, label: t('nav.dashboard'), show: true },
    { key: 'members', icon: Users, label: t('nav.members'), show: !!permissions?.members },
    { key: 'chanda', icon: HandCoins, label: t('nav.chanda'), show: !!permissions?.chanda },
    { key: 'donationAds', icon: Gift, label: t('nav.donationAds'), show: !!permissions?.donationAds },
    { key: 'expenses', icon: TrendingDown, label: t('nav.expenses'), show: !!permissions?.expenses },
    { key: 'treasury', icon: Wallet, label: t('nav.treasury'), show: !!permissions?.treasury },
    { key: 'vendors', icon: Store, label: t('nav.vendors'), show: !!permissions?.vendors },
    { key: 'loans', icon: Landmark, label: t('nav.loans'), show: !!permissions?.loans },
    { key: 'tasks', icon: CheckSquare, label: t('nav.tasks'), show: !!permissions?.tasks },
    { key: 'activityLog', icon: ScrollText, label: t('nav.activityLog'), show: !!permissions?.settings },
    { key: 'settings', icon: SettingsIcon, label: t('nav.settings'), show: !!permissions?.settings },
  ];

  const handleSelect = (page: PageKey) => {
    onNavigate(page);
    onCloseMobile();
  };

  const content = (
    <div className="h-full flex flex-col bg-white">
      <div className={`flex items-start gap-2.5 border-b border-gray-100 shrink-0 ${collapsed ? 'justify-center px-2 py-4' : 'px-4 py-4'}`}>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-lg overflow-hidden shrink-0">
          {logo && (logo.startsWith('data:') || logo.startsWith('http')) ? (
            <img src={logo} alt="Logo" className="w-7 h-7 object-cover rounded" />
          ) : (
            <span className="text-lg leading-none">{logo || '🕉️'}</span>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sm text-gray-800 leading-snug line-clamp-2">{association}</p>
            {regdLine && <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{regdLine}</p>}
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

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.filter(i => i.show).map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleSelect(item.key)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              } ${
                active
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
              }`}
            >
              <Icon size={19} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="hidden lg:flex items-center justify-center border-t border-gray-100 py-2 shrink-0">
        <button
          onClick={onToggleCollapsed}
          className="text-gray-400 hover:text-orange-600 p-2 rounded-lg hover:bg-orange-50 transition-colors"
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className={`hidden lg:block shrink-0 sticky top-0 h-screen border-r border-gray-200 transition-all duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        {content}
      </aside>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={onCloseMobile} />
          <aside className="relative w-64 h-full border-r border-gray-200 shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
