import { useEffect, useRef, useState } from 'react';
import { Search, X, Users, DollarSign, Gift, TrendingDown, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { Member, Chanda, DonationAd, Expense, User } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { stashSearchResultIds, SearchTargetModule } from '../lib/searchHandoff';

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

const STATUS_OPTIONS = ['paid', 'pending', 'partial', 'rejected', 'cancelled'] as const;
const PAID_METHOD_OPTIONS = ['cash', 'qrScan', 'onlineBanking', 'check'] as const;

interface AdvancedFilters {
  amountMin: string;
  amountMax: string;
  billVoucher: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  paidMethod: string;
  phone: string;
}

const emptyFilters: AdvancedFilters = {
  amountMin: '', amountMax: '', billVoucher: '', status: '', dateFrom: '', dateTo: '', paidMethod: '', phone: '',
};

const hasActiveFilters = (f: AdvancedFilters) => Object.values(f).some(v => v.trim() !== '');

// Priority order for which page to land on when an advanced search matches
// more than one module — the others still get their IDs stashed, so
// switching menus afterward shows the filtered table there too.
const MODULE_PRIORITY: SearchTargetModule[] = ['chanda', 'expenses', 'donationAds', 'members'];

export function GlobalSearch({ members, chandaList, donationAdsList, expenses, currentUser, onNavigate }: GlobalSearchProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(emptyFilters);
  const [noMatchMessage, setNoMatchMessage] = useState(false);
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

  const filtersActive = hasActiveFilters(draftFilters);

  // Live quick-text preview only — the Advanced Filters panel never feeds
  // this dropdown; clicking Search there jumps straight to the filtered
  // table instead (see runAdvancedSearch), since a result you can't click
  // through to edit isn't useful on a live CRM.
  const q = query.trim().toLowerCase();
  const matchesQuery = (parts: (string | number | undefined | null)[]) =>
    q === '' || parts.some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));

  const previewMembers = q && currentUser?.permissions.members
    ? members.filter(m => matchesQuery([m.name, m.phone, m.address, label(`members.role.${m.role}`, m.role)])).slice(0, QUICK_RESULTS_PER_SECTION)
    : [];
  const previewChanda = q && currentUser?.permissions.chanda
    ? chandaList.filter(c => matchesQuery([
        c.donorName, c.phone, c.phone2, c.remarks, c.amount, c.date,
        label(`chanda.status.${c.paymentStatus}`, c.paymentStatus),
        label(`common.paidMethod.${c.paidMethod}`, c.paidMethod),
      ])).slice(0, QUICK_RESULTS_PER_SECTION)
    : [];
  const previewDonationAds = q && currentUser?.permissions.donationAds
    ? donationAdsList.filter(d => matchesQuery([
        d.donorName, d.companyName, d.phone, d.phone2, d.remarks, d.amount, d.inKind, d.date,
        label(`donationAds.category.${d.category}`, d.category),
        label(`common.paidMethod.${d.paidMethod}`, d.paidMethod),
      ])).slice(0, QUICK_RESULTS_PER_SECTION)
    : [];
  const previewExpenses = q && currentUser?.permissions.expenses
    ? expenses.filter(exp => matchesQuery([
        exp.title, exp.remarks, exp.amount, exp.date,
        label(`expenses.category.${exp.category}`, exp.category),
        label(`expenses.status.${exp.paymentStatus}`, exp.paymentStatus),
        label(`expenses.paidThrough.${exp.paidThrough}`, exp.paidThrough),
      ])).slice(0, QUICK_RESULTS_PER_SECTION)
    : [];

  const totalPreview = previewMembers.length + previewChanda.length + previewDonationAds.length + previewExpenses.length;

  const handleSelect = (page: SearchablePage) => {
    onNavigate(page);
    setOpen(false);
  };

  // Full (uncapped) advanced match, run only when Search is clicked —
  // combines the quick text box (if anything is typed) with every set
  // Advanced Filter, per module, using only the fields that module has.
  const runAdvancedSearch = () => {
    const f = draftFilters;
    const inAmountRange = (amount: number | undefined) => {
      if (!f.amountMin && !f.amountMax) return true;
      if (amount === undefined) return false;
      const min = f.amountMin ? parseFloat(f.amountMin) : -Infinity;
      const max = f.amountMax ? parseFloat(f.amountMax) : Infinity;
      return amount >= min && amount <= max;
    };
    const inDateRange = (dateStr: string | undefined) => {
      if (!f.dateFrom && !f.dateTo) return true;
      if (!dateStr) return false;
      const d = new Date(dateStr).getTime();
      if (f.dateFrom && d < new Date(f.dateFrom).getTime()) return false;
      if (f.dateTo && d > new Date(f.dateTo).getTime()) return false;
      return true;
    };
    const matchesPhone = (...phones: (string | undefined)[]) =>
      !f.phone || phones.some(p => (p || '').includes(f.phone.trim()));
    const matchesBillVoucher = (...values: (string | undefined)[]) =>
      !f.billVoucher || values.some(v => (v || '').toLowerCase().includes(f.billVoucher.trim().toLowerCase()));

    const memberIds = currentUser?.permissions.members
      ? members.filter(m =>
          matchesQuery([m.name, m.phone, m.address, label(`members.role.${m.role}`, m.role)]) &&
          inAmountRange(m.membershipAmount) &&
          matchesPhone(m.phone) &&
          matchesBillVoucher(m.membershipBillNumber) &&
          inDateRange(m.membershipDate) &&
          (!f.status || m.membershipPaymentStatus === f.status) &&
          (!f.paidMethod || m.membershipPaidMethod === f.paidMethod)
        ).map(m => m.id)
      : [];

    const chandaIds = currentUser?.permissions.chanda
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
          (!f.status || c.paymentStatus === f.status) &&
          (!f.paidMethod || c.paidMethod === f.paidMethod)
        ).map(c => c.id)
      : [];

    const donationAdsIds = currentUser?.permissions.donationAds
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
          !f.status &&
          (!f.paidMethod || d.paidMethod === f.paidMethod)
        ).map(d => d.id)
      : [];

    const expenseIds = currentUser?.permissions.expenses
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
          (!f.status || exp.paymentStatus === f.status) &&
          !f.paidMethod
        ).map(exp => exp.id)
      : [];

    const byModule: Record<SearchTargetModule, string[]> = {
      members: memberIds, chanda: chandaIds, donationAds: donationAdsIds, expenses: expenseIds,
    };

    const matchedModules = MODULE_PRIORITY.filter(m => byModule[m].length > 0);

    if (matchedModules.length === 0) {
      setNoMatchMessage(true);
      return;
    }

    // Stash every matched module's IDs so switching pages afterward keeps
    // each table filtered too, then land on the highest-priority match.
    matchedModules.forEach(m => stashSearchResultIds(m, byModule[m]));
    setNoMatchMessage(false);
    setOpen(false);
    onNavigate(matchedModules[0]);
  };

  const handleClear = () => {
    setQuery('');
    setDraftFilters(emptyFilters);
    setNoMatchMessage(false);
  };

  return (
    <div ref={wrapperRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={t('search.placeholder')}
        className={`p-3 rounded-lg transition-colors shrink-0 ${
          open ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
        }`}
      >
        <Search size={20} />
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
                onChange={(e) => { setQuery(e.target.value); setNoMatchMessage(false); }}
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
              {filtersActive && (
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
                    onClick={runAdvancedSearch}
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
                {noMatchMessage && (
                  <p className="text-sm text-red-600 mt-2 font-medium">{t('search.noResults')}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">{t('search.advancedHint')}</p>
              </div>
            )}

            {q === '' ? (
              !showAdvanced && <p className="text-sm text-gray-500 mt-3">{t('search.typeToSearch')}</p>
            ) : totalPreview === 0 ? (
              <p className="text-sm text-gray-500 mt-3">{t('search.noResults')}</p>
            ) : (
              <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-4">
                {previewMembers.length > 0 && (
                  <ResultSection icon={<Users size={16} />} title={t('nav.members')} onSeeAll={() => handleSelect('members')}>
                    {previewMembers.map((m) => (
                      <button key={m.id} onClick={() => handleSelect('members')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors">
                        <p className="text-sm font-medium text-gray-800">{m.name}</p>
                        <p className="text-xs text-gray-500">{label(`members.role.${m.role}`, m.role)}{m.phone ? ` · ${m.phone}` : ''}</p>
                      </button>
                    ))}
                  </ResultSection>
                )}
                {previewChanda.length > 0 && (
                  <ResultSection icon={<DollarSign size={16} />} title={t('nav.chanda')} onSeeAll={() => handleSelect('chanda')}>
                    {previewChanda.map((c) => (
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
                {previewDonationAds.length > 0 && (
                  <ResultSection icon={<Gift size={16} />} title={t('nav.donationAds')} onSeeAll={() => handleSelect('donationAds')}>
                    {previewDonationAds.map((d) => (
                      <button key={d.id} onClick={() => handleSelect('donationAds')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors">
                        <p className="text-sm font-medium text-gray-800">
                          {d.donorName || d.companyName || '-'} <span className="text-green-600 font-bold">₹{d.amount.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-500">{label(`donationAds.category.${d.category}`, d.category)}{d.phone ? ` · ${d.phone}` : ''}</p>
                      </button>
                    ))}
                  </ResultSection>
                )}
                {previewExpenses.length > 0 && (
                  <ResultSection icon={<TrendingDown size={16} />} title={t('nav.expenses')} onSeeAll={() => handleSelect('expenses')}>
                    {previewExpenses.map((exp) => (
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
