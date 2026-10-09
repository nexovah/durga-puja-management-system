import { useEffect, useRef, useState } from 'react';
import { Rocket, BookOpen, Headphones, HelpCircle, ChevronRight, FileText, HandCoins, Archive, Sparkles, Gift } from 'lucide-react';
import { listAppVersionsRequest, AppVersionEntry } from '../lib/db';
import { useLanguage } from '../i18n/LanguageContext';

// Icon rotates per "What's new" entry purely for visual variety — the data
// itself (app_versions) carries no icon field, see
// supabase/151_tenant_readable_versions.sql.
const WHATS_NEW_ICONS = [FileText, HandCoins, Archive, Sparkles, Gift];

function splitNotes(notes: string, fallbackTitle: string): { title: string; description: string } {
  const lines = notes.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { title: fallbackTitle, description: '' };
  if (lines.length === 1) return { title: fallbackTitle, description: lines[0] };
  return { title: lines[0], description: lines.slice(1).join(' ') };
}

function formatReleaseDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

interface HelpSupportMenuProps {
  hasUnreadSupportReply: boolean;
  onOpenSupportTicket: () => void;
}

// Topbar Help icon — now a dropdown instead of a direct link, matching the
// reference design: three quick-link rows (Getting started guide / Help
// center / Log a ticket), a separator, then a "What's new" release-notes
// feed sourced from the Super Admin-published app_versions table. Only
// "Log a ticket" navigates anywhere this session — the other two pages
// don't exist yet (next session).
export function HelpSupportMenu({ hasUnreadSupportReply, onOpenSupportTicket }: HelpSupportMenuProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<AppVersionEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || versions.length > 0) return;
    listAppVersionsRequest(5).then(setVersions).catch(() => {});
  }, [open, versions.length]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg p-1.5 shrink-0 transition-colors"
        aria-label={t('nav.helpSupport')}
        title={t('nav.helpSupport')}
      >
        <HelpCircle size={20} />
        {hasUnreadSupportReply && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-gray-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[32rem] overflow-y-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-30">
          <div className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <p className="font-bold text-base text-gray-800 dark:text-gray-200">{t('helpMenu.title')}</p>
          </div>

          <div className="py-1">
            <MenuRow
              icon={Rocket}
              title={t('helpMenu.gettingStarted')}
              subtitle={t('helpMenu.gettingStartedSub')}
            />
            <MenuRow
              icon={BookOpen}
              title={t('helpMenu.helpCenter')}
              subtitle={t('helpMenu.helpCenterSub')}
            />
            <MenuRow
              icon={Headphones}
              title={t('helpMenu.logTicket')}
              subtitle={t('helpMenu.logTicketSub')}
              onClick={() => { setOpen(false); onOpenSupportTicket(); }}
            />
          </div>

          {versions.length > 0 && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-800" />
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('helpMenu.whatsNew')}
              </p>
              <div className="py-1 pb-2">
                {versions.map((v, i) => {
                  const { title, description } = splitNotes(v.notes, `v${v.version}`);
                  const Icon = WHATS_NEW_ICONS[i % WHATS_NEW_ICONS.length];
                  return (
                    <div key={v.id} className="w-full flex items-start gap-3 text-left px-4 py-2.5">
                      <Icon size={17} className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{title}</p>
                        {description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
                        )}
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{formatReleaseDate(v.releasedAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuRow({
  icon: Icon, title, subtitle, onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 text-left px-4 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors group"
    >
      <Icon size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm text-gray-800 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-400">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0 mt-1.5" />
    </button>
  );
}
