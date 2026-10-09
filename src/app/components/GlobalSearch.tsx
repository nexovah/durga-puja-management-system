import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Users, HandCoins, Gift, Megaphone, TrendingDown, Plus } from 'lucide-react';
import { Member, Chanda, DonationAd, Expense, User } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

type SearchablePage = 'members' | 'chanda' | 'donation' | 'ads' | 'expenses';

interface GlobalSearchProps {
  members: Member[];
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  currentUser: User | null;
  onNavigate: (page: SearchablePage) => void;
  // Quick-add rows (and their global Cmd/Ctrl+<letter> shortcuts) open the
  // target page's Add form directly, instead of just navigating there —
  // App.tsx wires this to each page's existing initialAddRequestId
  // convention (ChandaCollection etc.).
  onQuickAdd: (page: SearchablePage) => void;
}

const RESULTS_PER_SECTION = 8;

// Quick cross-menu jump only: type a name/amount/phone/etc, see which menus
// have a match, click one to go there. Real searching-and-editing of a
// table's own data happens on that page itself via TableSearchBar — this
// stays a fast "which menu is this in" lookup, not a filter.
export function GlobalSearch({ members, chandaList, donationAdsList, expenses, currentUser, onNavigate, onQuickAdd }: GlobalSearchProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Mac uses the Cmd glyph in the shortcut badge; every other platform
  // shows "Ctrl J" instead — both trigger the same handler below.
  const isMac = useMemo(() => /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent), []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleShortcut);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleShortcut);
    };
  }, []);

  const label = (key: string, fallback: string) => {
    const value = t(key as TranslationKey);
    return value === key ? fallback : value;
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return { members: [] as Member[], chanda: [] as Chanda[], donation: [] as DonationAd[], ads: [] as DonationAd[], expenses: [] as Expense[] };
    }

    const matches = (parts: (string | number | undefined | null)[]) =>
      parts.some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));

    const memberResults = currentUser?.permissions.members
      ? members.filter(m => matches([
          m.name, m.phone, m.address,
          label(`members.role.${m.role}`, m.role),
        ])).slice(0, RESULTS_PER_SECTION)
      : [];

    const chandaResults = currentUser?.permissions.chanda
      ? chandaList.filter(c => matches([
          c.donorName, c.phone, c.phone2, c.remarks, c.amount, c.date, c.billNumber,
          label(`chanda.status.${c.paymentStatus}`, c.paymentStatus),
          label(`common.paidMethod.${c.paidMethod}`, c.paidMethod),
        ])).slice(0, RESULTS_PER_SECTION)
      : [];

    const donationAdsMatchOn = (d: DonationAd) => matches([
      d.donorName, d.companyName, d.phone, d.phone2, d.remarks, d.amount, d.inKind, d.date, d.voucherNumber,
      label(`donationAds.category.${d.category}`, d.category),
      label(`common.paidMethod.${d.paidMethod}`, d.paidMethod),
    ]);
    const hasDonationPerm = currentUser?.permissions.donation ?? currentUser?.permissions.donationAds;
    const hasAdsPerm = currentUser?.permissions.ads ?? currentUser?.permissions.donationAds;
    const donationResults = hasDonationPerm
      ? donationAdsList.filter(d => d.category === 'donation' && donationAdsMatchOn(d)).slice(0, RESULTS_PER_SECTION)
      : [];
    const adsResults = hasAdsPerm
      ? donationAdsList.filter(d => d.category === 'ads' && donationAdsMatchOn(d)).slice(0, RESULTS_PER_SECTION)
      : [];

    const expenseResults = currentUser?.permissions.expenses
      ? expenses.filter(exp => matches([
          exp.title, exp.remarks, exp.amount, exp.date, exp.voucherNumber,
          label(`expenses.category.${exp.category}`, exp.category),
          label(`expenses.status.${exp.paymentStatus}`, exp.paymentStatus),
          label(`expenses.paidThrough.${exp.paidThrough}`, exp.paidThrough),
        ])).slice(0, RESULTS_PER_SECTION)
      : [];

    return { members: memberResults, chanda: chandaResults, donation: donationResults, ads: adsResults, expenses: expenseResults };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, members, chandaList, donationAdsList, expenses, currentUser]);

  const totalResults = results.members.length + results.chanda.length + results.donation.length + results.ads.length + results.expenses.length;

  const handleSelect = (page: SearchablePage) => {
    onNavigate(page);
    setOpen(false);
    setQuery('');
  };

  const handleQuickAdd = (page: SearchablePage) => {
    onQuickAdd(page);
    setOpen(false);
    setQuery('');
  };

  // Shown only when the modal is empty (no query yet) — quick jump links
  // plus quick-add shortcuts, Supabase-command-palette style. Both just
  // navigate to the target page (the user adds the record there
  // themselves); same permission gating as the live search results above.
  type Shortcut = { page: SearchablePage; icon: React.ReactNode; labelKey: TranslationKey; show: boolean };
  const shortcutsAll: Shortcut[] = [
    { page: 'members', icon: <Users size={16} />, labelKey: 'nav.members', show: !!currentUser?.permissions.members },
    { page: 'chanda', icon: <HandCoins size={16} />, labelKey: 'nav.chanda', show: !!currentUser?.permissions.chanda },
    { page: 'donation', icon: <Gift size={16} />, labelKey: 'nav.donation', show: !!(currentUser?.permissions.donation ?? currentUser?.permissions.donationAds) },
    { page: 'ads', icon: <Megaphone size={16} />, labelKey: 'nav.ads', show: !!(currentUser?.permissions.ads ?? currentUser?.permissions.donationAds) },
    { page: 'expenses', icon: <TrendingDown size={16} />, labelKey: 'nav.expenses', show: !!currentUser?.permissions.expenses },
  ];
  const shortcuts = shortcutsAll.filter(s => s.show);

  type QuickAction = { page: SearchablePage; labelKey: TranslationKey; show: boolean; key: string };
  const quickActionsAll: QuickAction[] = [
    { page: 'members', labelKey: 'search.action.addMember', show: !!currentUser?.permissions.members, key: 'M' },
    { page: 'chanda', labelKey: 'search.action.addCollection', show: !!currentUser?.permissions.chanda, key: 'B' },
    { page: 'donation', labelKey: 'search.action.addDonation', show: !!(currentUser?.permissions.donation ?? currentUser?.permissions.donationAds), key: 'D' },
    { page: 'ads', labelKey: 'search.action.addSponsorship', show: !!(currentUser?.permissions.ads ?? currentUser?.permissions.donationAds), key: 'S' },
    { page: 'expenses', labelKey: 'search.action.addExpense', show: !!currentUser?.permissions.expenses, key: 'E' },
  ];
  const quickActions = quickActionsAll.filter(a => a.show);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full max-w-[11rem] flex items-center gap-2 pl-3 pr-2 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <Search size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
        <span className="flex-1 text-left truncate text-gray-400 dark:text-gray-500">{t('search.placeholder')}</span>
        <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] font-medium text-gray-500 dark:text-gray-400 pointer-events-none select-none shrink-0">
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 h-dvh bg-black/40 z-[200] flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative border-b border-gray-100 dark:border-gray-800">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full pl-11 pr-10 py-3.5 text-sm bg-transparent outline-none dark:text-gray-100"
              />
              <button
                onClick={() => setOpen(false)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4">
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('search.jumpHint')}</p>

          {query.trim() === '' ? (
            <div className="mt-3 space-y-4">
              {shortcuts.length > 0 && (
                <div>
                  <p className="px-3 mb-1 text-xs font-bold text-orange-700 uppercase tracking-wide">{t('search.shortcuts')}</p>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {shortcuts.map(s => (
                      <button
                        key={s.page}
                        onClick={() => handleSelect(s.page)}
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                      >
                        <span className="text-gray-400 dark:text-gray-500 shrink-0">{s.icon}</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t(s.labelKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {quickActions.length > 0 && (
                <div>
                  <p className="px-3 mb-1 text-xs font-bold text-orange-700 uppercase tracking-wide">{t('search.actions')}</p>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {quickActions.map(a => (
                      <button
                        key={a.page}
                        onClick={() => handleQuickAdd(a.page)}
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                      >
                        <span className="w-6 h-6 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                          <Plus size={14} />
                        </span>
                        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{t(a.labelKey)}</span>
                        <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] font-medium text-gray-500 dark:text-gray-400 pointer-events-none select-none shrink-0">
                          {isMac ? '⌘' : 'Ctrl'} {a.key}
                        </kbd>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {shortcuts.length === 0 && quickActions.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('search.typeToSearch')}</p>
              )}
            </div>
          ) : totalResults === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{t('search.noResults')}</p>
          ) : (
            <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-4">
                {results.members.length > 0 && (
                  <ResultSection icon={<Users size={16} />} title={t('nav.members')} onSeeAll={() => handleSelect('members')}>
                    {results.members.map((m) => (
                      <button key={m.id} onClick={() => handleSelect('members')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{label(`members.role.${m.role}`, m.role)}{m.phone ? ` · ${m.phone}` : ''}</p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.chanda.length > 0 && (
                  <ResultSection icon={<HandCoins size={16} />} title={t('nav.chanda')} onSeeAll={() => handleSelect('chanda')}>
                    {results.chanda.map((c) => (
                      <button key={c.id} onClick={() => handleSelect('chanda')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {c.donorName} <span className="text-green-600 font-bold">₹{c.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {label(`chanda.status.${c.paymentStatus}`, c.paymentStatus)}{c.phone ? ` · ${c.phone}` : ''}{c.billNumber ? ` · #${c.billNumber}` : ''}
                        </p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.donation.length > 0 && (
                  <ResultSection icon={<Gift size={16} />} title={t('nav.donation')} onSeeAll={() => handleSelect('donation')}>
                    {results.donation.map((d) => (
                      <button key={d.id} onClick={() => handleSelect('donation')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {d.donorName || d.companyName || '-'} <span className="text-green-600 font-bold">₹{d.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{d.phone || ''}</p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.ads.length > 0 && (
                  <ResultSection icon={<Megaphone size={16} />} title={t('nav.ads')} onSeeAll={() => handleSelect('ads')}>
                    {results.ads.map((d) => (
                      <button key={d.id} onClick={() => handleSelect('ads')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {d.donorName || d.companyName || '-'} <span className="text-green-600 font-bold">₹{d.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{d.phone || ''}</p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.expenses.length > 0 && (
                  <ResultSection icon={<TrendingDown size={16} />} title={t('nav.expenses')} onSeeAll={() => handleSelect('expenses')}>
                    {results.expenses.map((exp) => (
                      <button key={exp.id} onClick={() => handleSelect('expenses')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {exp.title} <span className="text-red-600 font-bold">₹{exp.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {label(`expenses.status.${exp.paymentStatus}`, exp.paymentStatus)} · {label(`expenses.category.${exp.category}`, exp.category)}{exp.voucherNumber ? ` · #${exp.voucherNumber}` : ''}
                        </p>
                      </button>
                    ))}
                  </ResultSection>
                )}
              </div>
            )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ResultSection({
  icon,
  title,
  onSeeAll,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onSeeAll: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="flex items-center justify-between px-3 mb-1">
        <div className="flex items-center gap-2 text-xs font-bold text-orange-700 uppercase tracking-wide">
          {icon}
          {title}
        </div>
        <button onClick={onSeeAll} className="text-xs text-orange-600 hover:underline font-medium">
          {t('search.seeAll')}
        </button>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
    </div>
  );
}
