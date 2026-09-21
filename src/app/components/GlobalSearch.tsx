import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Users, DollarSign, Gift, TrendingDown } from 'lucide-react';
import { Member, Chanda, DonationAd, Expense, User } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

type SearchablePage = 'members' | 'chanda' | 'donationAds' | 'expenses';

interface GlobalSearchProps {
  members: Member[];
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  currentUser: User | null;
  onNavigate: (page: SearchablePage) => void;
}

const RESULTS_PER_SECTION = 8;

// Quick cross-menu jump only: type a name/amount/phone/etc, see which menus
// have a match, click one to go there. Real searching-and-editing of a
// table's own data happens on that page itself via TableSearchBar — this
// stays a fast "which menu is this in" lookup, not a filter.
export function GlobalSearch({ members, chandaList, donationAdsList, expenses, currentUser, onNavigate }: GlobalSearchProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const label = (key: string, fallback: string) => {
    const value = t(key as TranslationKey);
    return value === key ? fallback : value;
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return { members: [] as Member[], chanda: [] as Chanda[], donationAds: [] as DonationAd[], expenses: [] as Expense[] };
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

    const donationAdsResults = currentUser?.permissions.donationAds
      ? donationAdsList.filter(d => matches([
          d.donorName, d.companyName, d.phone, d.phone2, d.remarks, d.amount, d.inKind, d.date, d.voucherNumber,
          label(`donationAds.category.${d.category}`, d.category),
          label(`common.paidMethod.${d.paidMethod}`, d.paidMethod),
        ])).slice(0, RESULTS_PER_SECTION)
      : [];

    const expenseResults = currentUser?.permissions.expenses
      ? expenses.filter(exp => matches([
          exp.title, exp.remarks, exp.amount, exp.date, exp.voucherNumber,
          label(`expenses.category.${exp.category}`, exp.category),
          label(`expenses.status.${exp.paymentStatus}`, exp.paymentStatus),
          label(`expenses.paidThrough.${exp.paidThrough}`, exp.paidThrough),
        ])).slice(0, RESULTS_PER_SECTION)
      : [];

    return { members: memberResults, chanda: chandaResults, donationAds: donationAdsResults, expenses: expenseResults };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, members, chandaList, donationAdsList, expenses, currentUser]);

  const totalResults = results.members.length + results.chanda.length + results.donationAds.length + results.expenses.length;

  const handleSelect = (page: SearchablePage) => {
    onNavigate(page);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder={t('search.placeholder')}
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-[28rem] top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-40 p-4">
          <p className="text-xs text-gray-400">{t('search.jumpHint')}</p>

          {query.trim() === '' ? (
            <p className="text-sm text-gray-500 mt-3">{t('search.typeToSearch')}</p>
          ) : totalResults === 0 ? (
            <p className="text-sm text-gray-500 mt-3">{t('search.noResults')}</p>
          ) : (
            <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-4">
                {results.members.length > 0 && (
                  <ResultSection icon={<Users size={16} />} title={t('nav.members')} onSeeAll={() => handleSelect('members')}>
                    {results.members.map((m) => (
                      <button key={m.id} onClick={() => handleSelect('members')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors">
                        <p className="text-sm font-medium text-gray-800">{m.name}</p>
                        <p className="text-xs text-gray-500">{label(`members.role.${m.role}`, m.role)}{m.phone ? ` · ${m.phone}` : ''}</p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.chanda.length > 0 && (
                  <ResultSection icon={<DollarSign size={16} />} title={t('nav.chanda')} onSeeAll={() => handleSelect('chanda')}>
                    {results.chanda.map((c) => (
                      <button key={c.id} onClick={() => handleSelect('chanda')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors">
                        <p className="text-sm font-medium text-gray-800">
                          {c.donorName} <span className="text-green-600 font-bold">₹{c.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {label(`chanda.status.${c.paymentStatus}`, c.paymentStatus)}{c.phone ? ` · ${c.phone}` : ''}{c.billNumber ? ` · #${c.billNumber}` : ''}
                        </p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.donationAds.length > 0 && (
                  <ResultSection icon={<Gift size={16} />} title={t('nav.donationAds')} onSeeAll={() => handleSelect('donationAds')}>
                    {results.donationAds.map((d) => (
                      <button key={d.id} onClick={() => handleSelect('donationAds')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors">
                        <p className="text-sm font-medium text-gray-800">
                          {d.donorName || d.companyName || '-'} <span className="text-green-600 font-bold">₹{d.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500">{label(`donationAds.category.${d.category}`, d.category)}{d.phone ? ` · ${d.phone}` : ''}</p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.expenses.length > 0 && (
                  <ResultSection icon={<TrendingDown size={16} />} title={t('nav.expenses')} onSeeAll={() => handleSelect('expenses')}>
                    {results.expenses.map((exp) => (
                      <button key={exp.id} onClick={() => handleSelect('expenses')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors">
                        <p className="text-sm font-medium text-gray-800">
                          {exp.title} <span className="text-red-600 font-bold">₹{exp.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {label(`expenses.status.${exp.paymentStatus}`, exp.paymentStatus)} · {label(`expenses.category.${exp.category}`, exp.category)}{exp.voucherNumber ? ` · #${exp.voucherNumber}` : ''}
                        </p>
                      </button>
                    ))}
                  </ResultSection>
                )}
              </div>
            )}
        </div>
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
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}
