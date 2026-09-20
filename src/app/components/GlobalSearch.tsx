import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Users, DollarSign, Gift, TrendingDown, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
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

const QUICK_RESULTS_PER_SECTION = 8;
const ADVANCED_RESULTS_PER_SECTION = 50;

// Unified status vocabulary across modules — a record only participates in
// this filter if its own module actually has that concept (DonationAds has
// no payment status, so it's excluded from results whenever this filter is
// set, rather than silently matching everything).
const STATUS_OPTIONS = ['paid', 'pending', 'partial', 'rejected', 'cancelled'] as const;
const PAID_METHOD_OPTIONS = ['cash', 'qrScan', 'onlineBanking', 'check'] as const;

interface AdvancedFilters {
  amountMin: string;
  amountMax: string;
  billVoucher: string;
  status: string; // '' = any
  dateFrom: string;
  dateTo: string;
  paidMethod: string; // '' = any
  phone: string;
}

const emptyFilters: AdvancedFilters = {
  amountMin: '', amountMax: '', billVoucher: '', status: '', dateFrom: '', dateTo: '', paidMethod: '', phone: '',
};

const hasActiveFilters = (f: AdvancedFilters) => Object.values(f).some(v => v.trim() !== '');

export function GlobalSearch({ members, chandaList, donationAdsList, expenses, currentUser, onNavigate }: GlobalSearchProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(emptyFilters);
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

  // Translate a canonical key (e.g. "paid", "president"); falls back to the
  // raw value itself if there's no matching translation.
  const label = (key: string, fallback: string) => {
    const value = t(key as TranslationKey);
    return value === key ? fallback : value;
  };

  const filtersActive = hasActiveFilters(appliedFilters);
  const resultsPerSection = filtersActive ? ADVANCED_RESULTS_PER_SECTION : QUICK_RESULTS_PER_SECTION;

  const inDateRange = (dateStr: string | undefined) => {
    if (!appliedFilters.dateFrom && !appliedFilters.dateTo) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr).getTime();
    if (appliedFilters.dateFrom && d < new Date(appliedFilters.dateFrom).getTime()) return false;
    if (appliedFilters.dateTo && d > new Date(appliedFilters.dateTo).getTime()) return false;
    return true;
  };

  const inAmountRange = (amount: number | undefined) => {
    if (!appliedFilters.amountMin && !appliedFilters.amountMax) return true;
    if (amount === undefined) return false;
    const min = appliedFilters.amountMin ? parseFloat(appliedFilters.amountMin) : -Infinity;
    const max = appliedFilters.amountMax ? parseFloat(appliedFilters.amountMax) : Infinity;
    return amount >= min && amount <= max;
  };

  const matchesPhone = (...phones: (string | undefined)[]) =>
    !appliedFilters.phone || phones.some(p => (p || '').includes(appliedFilters.phone.trim()));

  const matchesBillVoucher = (...values: (string | undefined)[]) =>
    !appliedFilters.billVoucher || values.some(v => (v || '').toLowerCase().includes(appliedFilters.billVoucher.trim().toLowerCase()));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasQuery = q !== '';
    if (!hasQuery && !filtersActive) {
      return { members: [] as Member[], chanda: [] as Chanda[], donationAds: [] as DonationAd[], expenses: [] as Expense[] };
    }

    const matchesQuery = (parts: (string | number | undefined | null)[]) =>
      !hasQuery || parts.some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));

    const memberResults = currentUser?.permissions.members
      ? members.filter(m =>
          matchesQuery([m.name, m.phone, m.address, label(`members.role.${m.role}`, m.role)]) &&
          inAmountRange(m.membershipAmount) &&
          matchesPhone(m.phone) &&
          matchesBillVoucher(m.membershipBillNumber) &&
          inDateRange(m.membershipDate) &&
          (!appliedFilters.status || m.membershipPaymentStatus === appliedFilters.status) &&
          (!appliedFilters.paidMethod || m.membershipPaidMethod === appliedFilters.paidMethod)
        ).slice(0, resultsPerSection)
      : [];

    const chandaResults = currentUser?.permissions.chanda
      ? chandaList.filter(c =>
          matchesQuery([
            c.donorName, c.phone, c.phone2, c.remarks, c.amount, c.date,
            label(`chanda.status.${c.paymentStatus}`, c.paymentStatus),
            label(`common.paidMethod.${c.paidMethod}`, c.paidMethod),
          ]) &&
          inAmountRange(c.amount) &&
          matchesBillVoucher(c.billNumber) &&
          matchesPhone(c.phone, c.phone2) &&
          inDateRange(c.date) &&
          (!appliedFilters.status || c.paymentStatus === appliedFilters.status) &&
          (!appliedFilters.paidMethod || c.paidMethod === appliedFilters.paidMethod)
        ).slice(0, resultsPerSection)
      : [];

    const donationAdsResults = currentUser?.permissions.donationAds
      ? donationAdsList.filter(d =>
          matchesQuery([
            d.donorName, d.companyName, d.phone, d.phone2, d.remarks, d.amount, d.inKind, d.date,
            label(`donationAds.category.${d.category}`, d.category),
            label(`common.paidMethod.${d.paidMethod}`, d.paidMethod),
          ]) &&
          inAmountRange(d.amount) &&
          matchesBillVoucher(d.voucherNumber) &&
          matchesPhone(d.phone, d.phone2) &&
          inDateRange(d.date) &&
          !appliedFilters.status && // Donation/Ads has no payment status concept
          (!appliedFilters.paidMethod || d.paidMethod === appliedFilters.paidMethod)
        ).slice(0, resultsPerSection)
      : [];

    const expenseResults = currentUser?.permissions.expenses
      ? expenses.filter(exp =>
          matchesQuery([
            exp.title, exp.remarks, exp.amount, exp.date,
            label(`expenses.category.${exp.category}`, exp.category),
            label(`expenses.status.${exp.paymentStatus}`, exp.paymentStatus),
            label(`expenses.paidThrough.${exp.paidThrough}`, exp.paidThrough),
          ]) &&
          inAmountRange(exp.amount) &&
          matchesBillVoucher(exp.voucherNumber) &&
          inDateRange(exp.date) &&
          (!appliedFilters.status || exp.paymentStatus === appliedFilters.status) &&
          !appliedFilters.paidMethod // Expenses uses Paid Through (cash/check), not the same vocabulary
        ).slice(0, resultsPerSection)
      : [];

    return { members: memberResults, chanda: chandaResults, donationAds: donationAdsResults, expenses: expenseResults };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, appliedFilters, members, chandaList, donationAdsList, expenses, currentUser, resultsPerSection]);

  const totalResults = results.members.length + results.chanda.length + results.donationAds.length + results.expenses.length;
  const showingResults = query.trim() !== '' || filtersActive;

  const handleSelect = (page: SearchablePage) => {
    onNavigate(page);
    setOpen(false);
  };

  const handleSearch = () => setAppliedFilters(draftFilters);
  const handleClear = () => {
    setQuery('');
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  return (
    <div ref={wrapperRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={t('search.placeholder')}
        className={`p-3 rounded-lg transition-colors shrink-0 relative ${
          open ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
        }`}
      >
        <Search size={20} />
        {filtersActive && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-600" />}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full bg-white border-t border-b border-gray-200 shadow-lg z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full pl-10 pr-10 py-3 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
              />
              <button
                onClick={() => setOpen(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <button
              onClick={() => setShowAdvanced(o => !o)}
              className="flex items-center gap-1.5 mt-2.5 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              <SlidersHorizontal size={14} />
              {t('search.advancedFilters')}
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {filtersActive && !showAdvanced && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                  {t('search.filtersOn')}
                </span>
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.amountMin')}</label>
                    <input
                      type="number"
                      value={draftFilters.amountMin}
                      onChange={(e) => setDraftFilters({ ...draftFilters, amountMin: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.amountMax')}</label>
                    <input
                      type="number"
                      value={draftFilters.amountMax}
                      onChange={(e) => setDraftFilters({ ...draftFilters, amountMax: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder={t('search.anyAmount')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.billVoucher')}</label>
                    <input
                      type="text"
                      value={draftFilters.billVoucher}
                      onChange={(e) => setDraftFilters({ ...draftFilters, billVoucher: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.phone')}</label>
                    <input
                      type="text"
                      value={draftFilters.phone}
                      onChange={(e) => setDraftFilters({ ...draftFilters, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.paymentStatus')}</label>
                    <select
                      value={draftFilters.status}
                      onChange={(e) => setDraftFilters({ ...draftFilters, status: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    >
                      <option value="">{t('search.any')}</option>
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{label(`chanda.status.${s}`, label(`expenses.status.${s}`, s))}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.paymentMethod')}</label>
                    <select
                      value={draftFilters.paidMethod}
                      onChange={(e) => setDraftFilters({ ...draftFilters, paidMethod: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    >
                      <option value="">{t('search.any')}</option>
                      {PAID_METHOD_OPTIONS.map(m => (
                        <option key={m} value={m}>{label(`common.paidMethod.${m}`, m)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.dateFrom')}</label>
                    <input
                      type="date"
                      value={draftFilters.dateFrom}
                      onChange={(e) => setDraftFilters({ ...draftFilters, dateFrom: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.dateTo')}</label>
                    <input
                      type="date"
                      value={draftFilters.dateTo}
                      onChange={(e) => setDraftFilters({ ...draftFilters, dateTo: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSearch}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm"
                  >
                    <Search size={15} />
                    {t('search.searchButton')}
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
                  >
                    {t('search.clearButton')}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">{t('search.advancedHint')}</p>
              </div>
            )}

            {!showingResults ? (
              <p className="text-sm text-gray-500 mt-3">{t('search.typeToSearch')}</p>
            ) : totalResults === 0 ? (
              <p className="text-sm text-gray-500 mt-3">{t('search.noResults')}</p>
            ) : (
              <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-4">
                {results.members.length > 0 && (
                  <ResultSection
                    icon={<Users size={16} />}
                    title={t('nav.members')}
                    onSeeAll={() => handleSelect('members')}
                  >
                    {results.members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleSelect('members')}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">{m.name}</p>
                        <p className="text-xs text-gray-500">
                          {label(`members.role.${m.role}`, m.role)}{m.phone ? ` · ${m.phone}` : ''}
                        </p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.chanda.length > 0 && (
                  <ResultSection
                    icon={<DollarSign size={16} />}
                    title={t('nav.chanda')}
                    onSeeAll={() => handleSelect('chanda')}
                  >
                    {results.chanda.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelect('chanda')}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                      >
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
                  <ResultSection
                    icon={<Gift size={16} />}
                    title={t('nav.donationAds')}
                    onSeeAll={() => handleSelect('donationAds')}
                  >
                    {results.donationAds.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleSelect('donationAds')}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {d.donorName || d.companyName || '-'} <span className="text-green-600 font-bold">₹{d.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {label(`donationAds.category.${d.category}`, d.category)}{d.phone ? ` · ${d.phone}` : ''}
                        </p>
                      </button>
                    ))}
                  </ResultSection>
                )}

                {results.expenses.length > 0 && (
                  <ResultSection
                    icon={<TrendingDown size={16} />}
                    title={t('nav.expenses')}
                    onSeeAll={() => handleSelect('expenses')}
                  >
                    {results.expenses.map((exp) => (
                      <button
                        key={exp.id}
                        onClick={() => handleSelect('expenses')}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                      >
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
