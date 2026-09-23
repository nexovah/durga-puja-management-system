import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2, Settings as SettingsIcon, LogOut, Moon, Sun, ShieldCheck,
  ChevronDown, PanelLeftClose, PanelLeftOpen, Menu, X, CreditCard, ShoppingCart, FileText, Inbox,
} from 'lucide-react';
import { useTheme } from '../i18n/ThemeContext';
import { getPlatformSettingsRequest } from '../lib/superAdminDb';

export type SuperAdminPage = 'tenants' | 'plans' | 'orders' | 'leads' | 'cms' | 'settings';

interface SuperAdminLayoutProps {
  adminName: string;
  page: SuperAdminPage;
  onNavigate: (page: SuperAdminPage) => void;
  onLogout: () => void;
  children: ReactNode;
}

const NAV_ITEMS: { key: SuperAdminPage; label: string; icon: typeof Building2 }[] = [
  { key: 'tenants', label: 'Tenants', icon: Building2 },
  { key: 'plans', label: 'Subscription Plans', icon: CreditCard },
  { key: 'orders', label: 'Orders', icon: ShoppingCart },
  { key: 'leads', label: 'Leads', icon: Inbox },
  { key: 'cms', label: 'CMS', icon: FileText },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

const COLLAPSE_STORAGE_KEY = 'puja-super-admin-sidebar-collapsed';

export function SuperAdminLayout({ adminName, page, onNavigate, onLogout, children }: SuperAdminLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ label: string; top: number; left: number } | null>(null);
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    getPlatformSettingsRequest().then(p => setLogoUrl(p.logoUrl)).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore — collapse preference is a nice-to-have, not critical
      }
      return next;
    });
  };

  const navContent = (
    <div className="h-full flex flex-col">
      <div className={`flex items-center gap-2.5 shrink-0 ${collapsed ? 'justify-center px-2 py-5' : 'px-4 py-5'}`}>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 border-4 border-orange-600 rounded-lg overflow-hidden shrink-0 w-9 h-9 flex items-center justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <ShieldCheck size={18} className="text-white" />
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100 leading-snug">Super Admin</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">Durga CRM Platform</p>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 shrink-0"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pt-9 pb-2 px-3">
        {!collapsed && (
          <p className="px-3 mb-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Platform</p>
        )}
        <div className="space-y-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <SuperAdminNavButton
              key={key}
              Icon={Icon}
              label={label}
              active={page === key}
              collapsed={collapsed}
              onClick={() => { onNavigate(key); setMobileOpen(false); }}
              onHoverChange={rect => {
                if (!collapsed) return;
                setHoveredTooltip(rect ? { label, top: rect.top + rect.height / 2, left: rect.right } : null);
              }}
            />
          ))}
        </div>
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eceef1] dark:bg-gray-950 flex">
      <aside className={`hidden lg:block shrink-0 sticky top-0 h-screen bg-[#eceef1] dark:bg-gray-950 z-30 transition-all duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-white dark:bg-gray-900 shadow-xl">
            {navContent}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-20 bg-[#eceef1] dark:bg-gray-950">
          <div className="px-3 sm:px-4 lg:px-6 py-3 flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 shrink-0"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <button
              onClick={toggleCollapsed}
              className="hidden lg:flex text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg p-1.5 shrink-0 transition-colors"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <div className="flex-1 min-w-0" />

            <button
              onClick={toggleTheme}
              className="text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg p-1.5 shrink-0 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div ref={menuRef} className="relative shrink-0">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {adminName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="font-bold text-sm leading-tight text-gray-800 dark:text-gray-200">{adminName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Super Admin</p>
                </div>
                <ChevronDown size={16} className="text-gray-400 dark:text-gray-500 hidden sm:block" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-base shrink-0">
                      {adminName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{adminName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Super Admin</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-800" />
                  <div className="py-1">
                    <button
                      onClick={onLogout}
                      className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <main className="flex-1 px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 sm:p-6 min-h-[calc(100vh-5.5rem)]">
            <div className="container mx-auto">{children}</div>
          </div>
        </main>
      </div>

      {hoveredTooltip && createPortal(
        <div
          className="pointer-events-none fixed z-[100] -translate-y-1/2"
          style={{ top: hoveredTooltip.top, left: hoveredTooltip.left + 12 }}
        >
          <div className="relative bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-lg shadow-lg border border-gray-100 dark:border-gray-800 px-3.5 py-2 whitespace-nowrap">
            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[7px] border-r-white" />
            {hoveredTooltip.label}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function SuperAdminNavButton({
  Icon,
  label,
  active,
  collapsed,
  onClick,
  onHoverChange,
}: {
  Icon: typeof Building2;
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
          ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
          : 'text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10'
      }`}
    >
      <Icon size={19} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
