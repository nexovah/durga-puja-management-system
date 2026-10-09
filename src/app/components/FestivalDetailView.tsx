import { ArrowLeft, TrendingUp, TrendingDown, Scale, Users, HandCoins, Gift, Megaphone, Landmark, Trophy } from 'lucide-react';
import {
  Chanda, DonationAd, Expense, Loan, Member,
  getChandaCreditAmount, getDonationAdCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount, getAwardCreditAmount,
} from '../App';
import { EventInfo, Award } from '../lib/db';
import { computeCashBankTotals } from '../lib/cashBank';
import { formatFinancialYear } from './EventSwitcher';
import { useLanguage } from '../i18n/LanguageContext';

interface FestivalDetailViewProps {
  event: EventInfo;
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  awardsList: Award[];
  loansList: Loan[];
  members: Member[];
  onBack: () => void;
}

// Admin-only, fully read-only consolidated detail screen for ANY festival
// (active or not) — built entirely on data already fetched by
// ManageFestivalsPage's useFestivalData hook via the cross-event RPCs.
// Never calls setCurrentEventRequest/setEventActiveRequest/any write — it
// cannot change which festival anyone is working in, it only displays.
export function FestivalDetailView({
  event, chandaList, donationAdsList, expenses, awardsList, loansList, members, onBack,
}: FestivalDetailViewProps) {
  const { t, locale } = useLanguage();
  const fmt = (n: number) => `₹${n.toLocaleString()}`;

  const totals = computeCashBankTotals({ event, chandaList, donationAdsList, members, loansList, expenses, awardsList });
  const totalRaised = totals.sources.filter(s => ['collection', 'donation', 'sponsorship', 'awardPrizeMoney'].includes(s.key)).reduce((s, r) => s + r.cash + r.bank, 0);
  const totalSpent = totals.sources.find(s => s.key === 'expenses');
  const spent = totalSpent ? totalSpent.cash + totalSpent.bank : 0;

  const donations = donationAdsList.filter(d => d.category === 'donation');
  const sponsorships = donationAdsList.filter(d => d.category === 'ads');

  const sections: {
    key: string;
    icon: React.ReactNode;
    title: string;
    rows: { id: string; date: string; name: string; amount: number; status: string }[];
  }[] = [
    {
      key: 'chanda', icon: <HandCoins size={16} />, title: t('nav.chanda'),
      rows: chandaList.map(c => ({ id: c.id, date: c.date, name: c.donorName, amount: getChandaCreditAmount(c), status: c.paymentStatus })),
    },
    {
      key: 'donation', icon: <Gift size={16} />, title: t('nav.donation'),
      rows: donations.map(d => ({ id: d.id, date: d.date, name: d.donorName || d.companyName || '-', amount: getDonationAdCreditAmount(d), status: d.paymentStatus })),
    },
    {
      key: 'ads', icon: <Megaphone size={16} />, title: t('nav.ads'),
      rows: sponsorships.map(d => ({ id: d.id, date: d.date, name: d.donorName || d.companyName || '-', amount: getDonationAdCreditAmount(d), status: d.paymentStatus })),
    },
    {
      key: 'expenses', icon: <TrendingDown size={16} />, title: t('nav.expenses'),
      rows: expenses.map(e => ({ id: e.id, date: e.date, name: e.title, amount: getExpenseCreditAmount(e), status: e.paymentStatus })),
    },
    {
      key: 'loans', icon: <Landmark size={16} />, title: t('nav.loans'),
      rows: loansList.map(l => ({ id: l.id, date: l.date, name: l.donorName, amount: getLoanNetAmount(l), status: '' })),
    },
    {
      key: 'members', icon: <Users size={16} />, title: t('nav.committee'),
      rows: members.map(m => ({ id: m.id, date: m.membershipDate || '', name: m.name, amount: getMemberCreditAmount(m), status: m.membershipPaymentStatus || '' })),
    },
    {
      key: 'awards', icon: <Trophy size={16} />, title: t('nav.awards'),
      rows: awardsList.map(a => ({ id: a.id, date: a.awardedDate, name: a.receivedBy || a.title, amount: getAwardCreditAmount(a), status: a.paidMethod || '' })),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 font-medium">
          <ArrowLeft size={16} /> {t('festivals.backToManage')}
        </button>
        <span className="text-[10.5px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-[7px] py-[3px] rounded-full">
          {t('festivals.viewingReadOnly')}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-xl shrink-0">{event.emoji || '🪔'}</span>
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{event.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatFinancialYear(event.year)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium"><TrendingUp size={16} /> {t('festivals.raised')}</div>
          <p className="text-xl font-bold text-green-700 dark:text-green-400 mt-1">{fmt(totalRaised)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium"><TrendingDown size={16} /> {t('festivals.spent')}</div>
          <p className="text-xl font-bold text-red-700 dark:text-red-400 mt-1">{fmt(spent)}</p>
        </div>
        <div className={`rounded-xl p-4 border ${totals.totalBalance >= 0 ? 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-700' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'}`}>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm font-medium"><Scale size={16} /> {t('festivals.balance')}</div>
          <p className={`text-xl font-bold mt-1 ${totals.totalBalance >= 0 ? 'text-gray-800 dark:text-gray-200' : 'text-red-600'}`}>{fmt(totals.totalBalance)}</p>
        </div>
      </div>

      {sections.filter(s => s.rows.length > 0).map(section => (
        <div key={section.key} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <span className="text-orange-600">{section.icon}</span>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">{section.title}</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">({section.rows.length})</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
            {section.rows.map(row => (
              <div key={row.id} className="flex items-center justify-between px-5 py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{row.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {row.date ? new Date(row.date).toLocaleDateString(locale) : '-'}{row.status ? ` · ${row.status}` : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">{fmt(row.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {sections.every(s => s.rows.length === 0) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-sm">{t('festivals.report.noData')}</p>
        </div>
      )}
    </div>
  );
}
