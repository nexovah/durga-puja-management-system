import { useEffect, useMemo, useState } from 'react';
import { HandCoins, Gift, Megaphone, Receipt, Wallet, Users, Landmark, ClipboardList, Scale } from 'lucide-react';
import {
  Chanda, DonationAd, Expense, Member, Loan, Estimation,
  getChandaCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount,
} from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { ReportModulePage, ReportColumn, ReportWidget } from './ReportModulePage';
import { ReportEstimationPage } from './ReportEstimationPage';
import { ReportBalanceSheetPage } from './ReportBalanceSheetPage';
import { ADS_CATEGORIES } from './DonationAdsCollection';

interface ReportProps {
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  members: Member[];
  loansList: Loan[];
  estimationsList: Estimation[];
  committeeAssociation: string;
  committeeLogo: string;
  activeEventLabel: string;
  onRefreshData: () => Promise<void>;
}

type ModuleKey = 'chanda' | 'donation' | 'ads' | 'expenses' | 'vendor' | 'member' | 'loan' | 'estimation' | 'balanceSheet';
const VALID_MODULES: ModuleKey[] = ['chanda', 'donation', 'ads', 'expenses', 'vendor', 'member', 'loan', 'estimation', 'balanceSheet'];

// /report/<module> — see docs/URL_STATE_CONVENTION.md; same pattern as
// SuperAdminCms.tsx's left-nav (URL-backed, not the tenant Settings
// page's own non-URL-backed left-nav).
function getModuleFromPath(): ModuleKey {
  const segment = window.location.pathname.replace(/^\/report\/?/, '').split('/')[0];
  return (VALID_MODULES as string[]).includes(segment) ? (segment as ModuleKey) : 'chanda';
}

interface VendorRow {
  id: string;
  name: string;
  contact: string;
  totalContractAmount: number;
  totalPaid: number;
  lastDate: string;
  categories: string;
  voucherNumbers: string;
}

export function Report({ chandaList, donationAdsList, expenses, members, loansList, estimationsList, committeeAssociation, committeeLogo, activeEventLabel, onRefreshData }: ReportProps) {
  const { t, locale } = useLanguage();
  const [activeModule, setActiveModuleState] = useState<ModuleKey>(() => getModuleFromPath());

  const setActiveModule = (m: ModuleKey) => {
    setActiveModuleState(m);
    window.history.pushState(null, '', `/report/${m}`);
  };

  useEffect(() => {
    const onPopState = () => setActiveModuleState(getModuleFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const path = `/report/${activeModule}`;
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryLabel = (value: string) => {
    const key = `expenses.category.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };
  const chandaStatusLabel = (value: string) => {
    const key = `chanda.status.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };
  const expenseStatusLabel = (value: string) => {
    const key = `expenses.status.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };
  const paidMethodLabel = (value: string) => {
    const key = `common.paidMethod.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };
  const paidThroughLabel = (value: string) => {
    const key = `common.paidMethod.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };
  const roleLabel = (value: string) => {
    const key = `members.role.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString(locale) : '');
  const fmtAmount = (n: number) => `₹${n.toLocaleString()}`;

  // Advanced-filter option lists — same values ChandaCollection/
  // DonationAdsCollection/Expenses/Members already offer in their own
  // TableSearchBar, just re-labeled here for the Report module pages.
  const CHANDA_STATUS_OPTIONS = ['paid', 'pending', 'partial', 'rejected'].map(v => ({ value: v, label: chandaStatusLabel(v) }));
  const EXPENSE_STATUS_OPTIONS = ['paid', 'partial', 'cancelled'].map(v => ({ value: v, label: expenseStatusLabel(v) }));
  const PAID_METHOD_OPTIONS = ['cash', 'qrScan', 'onlineBanking', 'check'].map(v => ({ value: v, label: paidMethodLabel(v) }));
  const PAID_THROUGH_OPTIONS = ['cash', 'check', 'qrPayment', 'onlineBanking'].map(v => ({ value: v, label: paidThroughLabel(v) }));
  const ROLE_OPTIONS = [
    'president', 'vicePresident', 'secretary', 'assistantSecretary', 'treasurer', 'accountant',
    'executiveMember', 'advisoryPatron', 'volunteer', 'chiefAdviser', 'adviser',
  ].map(v => ({ value: v, label: roleLabel(v) }));
  const adsCategoryLabel = (value: string) => {
    const key = `donationAds.adsCategory.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };
  const ADS_CATEGORY_OPTIONS = ADS_CATEGORIES.map(c => ({ value: c.value, label: adsCategoryLabel(c.value) }));

  const NAV_ITEMS: { key: ModuleKey; label: string; icon: typeof HandCoins }[] = [
    { key: 'chanda', label: t('report.nav.chanda'), icon: HandCoins },
    { key: 'donation', label: t('report.nav.donation'), icon: Gift },
    { key: 'ads', label: t('report.nav.ads'), icon: Megaphone },
    { key: 'expenses', label: t('report.nav.expenses'), icon: Receipt },
    { key: 'vendor', label: t('report.nav.vendor'), icon: Wallet },
    { key: 'member', label: t('report.nav.member'), icon: Users },
    { key: 'loan', label: t('report.nav.loan'), icon: Landmark },
    { key: 'estimation', label: t('report.nav.estimation'), icon: ClipboardList },
    { key: 'balanceSheet', label: t('report.nav.balanceSheet'), icon: Scale },
  ];

  // Vendor rows derived from Expenses — same grouping Vendors.tsx uses,
  // simplified for reporting purposes (no per-payment breakdown here,
  // just the vendor-level totals + latest activity date).
  const vendorRows = useMemo((): VendorRow[] => {
    const groups = new Map<string, VendorRow & { categorySet: Set<string>; voucherSet: Set<string> }>();
    expenses.forEach(e => {
      if (!e.vendorName?.trim()) return;
      const key = `${e.vendorName.trim()}__${(e.vendorContact || '').trim()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          name: e.vendorName.trim(),
          contact: e.vendorContact || '',
          totalContractAmount: 0,
          totalPaid: 0,
          lastDate: e.date,
          categories: '',
          voucherNumbers: '',
          categorySet: new Set(),
          voucherSet: new Set(),
        });
      }
      const g = groups.get(key)!;
      g.totalContractAmount += e.amount;
      g.totalPaid += getExpenseCreditAmount(e);
      if (e.date > g.lastDate) g.lastDate = e.date;
      g.categorySet.add(categoryLabel(e.category));
      if (e.voucherNumber?.trim()) g.voucherSet.add(e.voucherNumber.trim());
      (e.partialPayments || []).forEach(p => { if (p.voucherNumber?.trim()) g.voucherSet.add(p.voucherNumber.trim()); });
    });
    return Array.from(groups.values()).map(g => ({
      ...g,
      categories: Array.from(g.categorySet).join(', '),
      voucherNumbers: Array.from(g.voucherSet).join(', '),
    }));
  }, [expenses, categoryLabel]);

  if (activeModule === 'estimation') {
    return (
      <div className="flex flex-col sm:flex-row gap-6">
        <ReportNav items={NAV_ITEMS} active={activeModule} onSelect={setActiveModule} />
        <div className="flex-1 min-w-0">
          <ReportEstimationPage estimationsList={estimationsList} companyName={committeeAssociation} companyLogo={committeeLogo} />
        </div>
      </div>
    );
  }

  if (activeModule === 'balanceSheet') {
    return (
      <div className="flex flex-col sm:flex-row gap-6">
        <ReportNav items={NAV_ITEMS} active={activeModule} onSelect={setActiveModule} />
        <div className="flex-1 min-w-0">
          <ReportBalanceSheetPage
            members={members}
            chandaList={chandaList}
            donationAdsList={donationAdsList}
            expenses={expenses}
            loansList={loansList}
            companyName={committeeAssociation}
            companyLogo={committeeLogo}
            eventLabel={activeEventLabel}
            onRefresh={onRefreshData}
          />
        </div>
      </div>
    );
  }

  let moduleProps: {
    pageTitle: string;
    data: { id: string }[];
    dateOf: (row: any) => string | undefined;
    searchOf: (row: any) => string;
    columns: ReportColumn<any>[];
    chartType: 'bar' | 'area' | 'donut';
    metricOf?: (row: any) => number;
    breakdownOf?: (rows: any[]) => { name: string; value: number }[];
    computeWidgets: (rows: any[]) => ReportWidget[];
    amountOf?: (row: any) => number;
    statusOf?: (row: any) => string;
    statusOptions?: { value: string; label: string }[];
    paidMethodOf?: (row: any) => string;
    paidMethodOptions?: { value: string; label: string }[];
    billVoucherOf?: (row: any) => string;
    billVoucherLabel?: string;
    phoneOf?: (row: any) => string;
    inKindOf?: (row: any) => string;
    inKindOptions?: { value: string; label: string }[];
    inKindLabel?: string;
    designationOf?: (row: any) => string;
    designationOptions?: { value: string; label: string }[];
    designationLabel?: string;
  };

  if (activeModule === 'chanda') {
    const pendingOf = (r: Chanda) => {
      if (r.paymentStatus === 'pending') return r.amount;
      if (r.paymentStatus === 'partial') return Math.max(0, r.amount - (r.partialAmount || 0));
      return 0;
    };
    moduleProps = {
      pageTitle: t('report.nav.chanda'),
      data: chandaList,
      dateOf: (r: Chanda) => r.date,
      searchOf: (r: Chanda) => `${r.donorName} ${r.phone} ${r.billNumber || ''}`,
      columns: [
        { key: 'donor', label: t('report.col.donor'), render: (r: Chanda) => r.donorName },
        { key: 'amount1', label: t('report.col.amount1'), align: 'right', render: (r: Chanda) => (r.amount1 !== undefined ? fmtAmount(r.amount1) : '') },
        { key: 'amount2', label: t('report.col.amount2'), align: 'right', render: (r: Chanda) => (r.amount2 !== undefined ? fmtAmount(r.amount2) : '') },
        { key: 'amount', label: t('report.col.amount'), align: 'right', render: (r: Chanda) => fmtAmount(getChandaCreditAmount(r)) },
        { key: 'pending', label: t('report.col.pending'), align: 'right', render: (r: Chanda) => fmtAmount(pendingOf(r)) },
        { key: 'status', label: t('report.col.status'), render: (r: Chanda) => chandaStatusLabel(r.paymentStatus) },
        { key: 'method', label: t('report.col.method'), render: (r: Chanda) => paidMethodLabel(r.paidMethod) },
        { key: 'billNumber', label: t('report.col.billNumber'), render: (r: Chanda) => r.billNumber || '' },
        { key: 'phone', label: t('report.col.phone'), render: (r: Chanda) => r.phone },
        { key: 'phone2', label: t('report.col.phone2'), render: (r: Chanda) => r.phone2 || '' },
        { key: 'remarks', label: t('report.col.remarks'), render: (r: Chanda) => r.remarks || '' },
        { key: 'date', label: t('report.col.date'), render: (r: Chanda) => fmtDate(r.date) },
      ],
      chartType: 'bar',
      metricOf: (r: Chanda) => getChandaCreditAmount(r),
      computeWidgets: (rows: Chanda[]) => {
        const collected = rows.reduce((s, r) => s + getChandaCreditAmount(r), 0);
        const pending = rows.reduce((s, r) => s + pendingOf(r), 0);
        return [
          { label: t('report.widget.totalCollected'), value: fmtAmount(collected) },
          { label: t('report.widget.pendingDue'), value: fmtAmount(pending) },
        ];
      },
      amountOf: (r: Chanda) => r.amount,
      statusOf: (r: Chanda) => r.paymentStatus,
      statusOptions: CHANDA_STATUS_OPTIONS,
      paidMethodOf: (r: Chanda) => r.paidMethod,
      paidMethodOptions: PAID_METHOD_OPTIONS,
      billVoucherOf: (r: Chanda) => r.billNumber || '',
      billVoucherLabel: t('report.col.billNumber'),
      phoneOf: (r: Chanda) => `${r.phone || ''} ${r.phone2 || ''}`,
    };
  } else if (activeModule === 'donation' || activeModule === 'ads') {
    const category = activeModule === 'ads' ? 'ads' : 'donation';
    const filtered = donationAdsList.filter(d => d.category === category);
    moduleProps = {
      pageTitle: t(activeModule === 'ads' ? 'report.nav.ads' : 'report.nav.donation'),
      data: filtered,
      dateOf: (r: DonationAd) => r.date,
      searchOf: (r: DonationAd) => `${r.donorName} ${r.companyName || ''} ${r.phone}`,
      columns: [
        { key: 'name', label: t('report.col.company'), render: (r: DonationAd) => r.donorName || r.companyName || '-' },
        { key: 'amount', label: t('report.col.amount'), align: 'right', render: (r: DonationAd) => fmtAmount(r.amount) },
        { key: 'method', label: t('report.col.method'), render: (r: DonationAd) => paidMethodLabel(r.paidMethod) },
        { key: 'inKind', label: t('report.col.inKind'), render: (r: DonationAd) => r.inKind || '' },
        ...(category === 'donation' ? [{ key: 'voucherNumber', label: t('report.col.voucherNumber'), render: (r: DonationAd) => r.voucherNumber || '' }] : []),
        { key: 'phone', label: t('report.col.phone'), render: (r: DonationAd) => r.phone },
        { key: 'phone2', label: t('report.col.phone2'), render: (r: DonationAd) => r.phone2 || '' },
        { key: 'remarks', label: t('report.col.remarks'), render: (r: DonationAd) => r.remarks || '' },
        { key: 'date', label: t('report.col.date'), render: (r: DonationAd) => fmtDate(r.date) },
      ],
      chartType: 'bar',
      metricOf: (r: DonationAd) => r.amount,
      computeWidgets: (rows: DonationAd[]) => [
        { label: t(activeModule === 'ads' ? 'report.widget.totalAds' : 'report.widget.totalDonations'), value: fmtAmount(rows.reduce((s, r) => s + r.amount, 0)) },
        { label: t('report.widget.transactions'), value: String(rows.length) },
      ],
      amountOf: (r: DonationAd) => r.amount,
      paidMethodOf: (r: DonationAd) => r.paidMethod,
      paidMethodOptions: PAID_METHOD_OPTIONS,
      phoneOf: (r: DonationAd) => `${r.phone || ''} ${r.phone2 || ''}`,
      ...(category === 'donation'
        ? { billVoucherOf: (r: DonationAd) => r.voucherNumber || '', billVoucherLabel: t('report.col.voucherNumber') }
        : { inKindOf: (r: DonationAd) => r.inKind || '', inKindOptions: ADS_CATEGORY_OPTIONS, inKindLabel: t('report.col.inKind') }),
    };
  } else if (activeModule === 'expenses') {
    // Partial payments are a variable-length list per expense — instead of
    // squashing them into one "amt (date) [voucher]; amt (date) [voucher]"
    // cell, generate 3 columns (Amount/Voucher/Date) per installment slot,
    // up to however many installments the fullest row actually has, so
    // CSV/PDF exports put each installment's fields in their own column.
    // Based on the full expenses list, not the filtered view, so columns
    // don't shift around as filters/search change.
    const maxPartialPayments = expenses.reduce((max, e) => Math.max(max, (e.partialPayments || []).length), 0);
    const partialPaymentColumns: ReportColumn<Expense>[] = [];
    for (let i = 0; i < maxPartialPayments; i++) {
      const n = i + 1;
      partialPaymentColumns.push(
        { key: `partial${n}Amount`, label: `${t('report.col.partialPayment')} ${n}`, align: 'right', exportOnly: true, render: (r: Expense) => (r.partialPayments?.[i] ? fmtAmount(r.partialPayments[i].amount) : '') },
        { key: `partial${n}Voucher`, label: `${t('report.col.partialPayment')} ${n} ${t('report.col.voucherNumber')}`, exportOnly: true, render: (r: Expense) => r.partialPayments?.[i]?.voucherNumber || '' },
        { key: `partial${n}Date`, label: `${t('report.col.partialPayment')} ${n} ${t('report.col.date')}`, exportOnly: true, render: (r: Expense) => fmtDate(r.partialPayments?.[i]?.date) },
      );
    }
    moduleProps = {
      pageTitle: t('report.nav.expenses'),
      data: expenses,
      dateOf: (r: Expense) => r.date,
      searchOf: (r: Expense) => `${r.title} ${r.vendorName || ''} ${r.category}`,
      columns: [
        { key: 'title', label: t('report.col.title'), render: (r: Expense) => r.title },
        { key: 'category', label: t('report.col.category'), render: (r: Expense) => categoryLabel(r.category) },
        { key: 'amount', label: t('report.col.amount'), align: 'right', render: (r: Expense) => fmtAmount(r.amount) },
        { key: 'paid', label: t('report.col.paid'), align: 'right', render: (r: Expense) => fmtAmount(getExpenseCreditAmount(r)) },
        { key: 'status', label: t('report.col.status'), render: (r: Expense) => expenseStatusLabel(r.paymentStatus) },
        ...partialPaymentColumns,
        { key: 'paidThrough', label: t('report.col.paidThrough'), render: (r: Expense) => paidThroughLabel(r.paidThrough) },
        { key: 'voucherNumber', label: t('report.col.voucherNumber'), render: (r: Expense) => r.voucherNumber || '' },
        { key: 'vendor', label: t('report.col.vendor'), render: (r: Expense) => r.vendorName || '' },
        { key: 'contact', label: t('report.col.contact'), render: (r: Expense) => r.vendorContact || '' },
        { key: 'remarks', label: t('report.col.remarks'), render: (r: Expense) => r.remarks || '' },
        { key: 'date', label: t('report.col.date'), render: (r: Expense) => fmtDate(r.date) },
      ],
      chartType: 'donut',
      breakdownOf: (rows: Expense[]) => {
        const totals = new Map<string, number>();
        rows.forEach(r => totals.set(categoryLabel(r.category), (totals.get(categoryLabel(r.category)) || 0) + getExpenseCreditAmount(r)));
        return Array.from(totals.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
      },
      computeWidgets: (rows: Expense[]) => [
        { label: t('report.widget.totalSpent'), value: fmtAmount(rows.reduce((s, r) => s + getExpenseCreditAmount(r), 0)) },
        { label: t('report.widget.pendingPartial'), value: String(rows.filter(r => r.paymentStatus === 'partial').length) },
      ],
      amountOf: (r: Expense) => r.amount,
      statusOf: (r: Expense) => r.paymentStatus,
      statusOptions: EXPENSE_STATUS_OPTIONS,
      paidMethodOf: (r: Expense) => r.paidThrough,
      paidMethodOptions: PAID_THROUGH_OPTIONS,
      billVoucherOf: (r: Expense) => r.voucherNumber || '',
      billVoucherLabel: t('report.col.voucherNumber'),
    };
  } else if (activeModule === 'vendor') {
    moduleProps = {
      pageTitle: t('report.nav.vendor'),
      data: vendorRows,
      dateOf: (r: VendorRow) => r.lastDate,
      searchOf: (r: VendorRow) => `${r.name} ${r.contact}`,
      columns: [
        { key: 'vendor', label: t('report.col.vendor'), render: (r: VendorRow) => r.name },
        { key: 'contact', label: t('report.col.contact'), render: (r: VendorRow) => r.contact },
        { key: 'categories', label: t('report.col.categories'), render: (r: VendorRow) => r.categories },
        { key: 'contract', label: t('report.col.contractAmount'), align: 'right', render: (r: VendorRow) => fmtAmount(r.totalContractAmount) },
        { key: 'paid', label: t('report.col.paid'), align: 'right', render: (r: VendorRow) => fmtAmount(r.totalPaid) },
        { key: 'pending', label: t('report.col.pending'), align: 'right', render: (r: VendorRow) => fmtAmount(Math.max(0, r.totalContractAmount - r.totalPaid)) },
        { key: 'voucherNumbers', label: t('report.col.voucherNumber'), render: (r: VendorRow) => r.voucherNumbers },
        { key: 'date', label: t('report.col.date'), render: (r: VendorRow) => fmtDate(r.lastDate) },
      ],
      chartType: 'donut',
      breakdownOf: (rows: VendorRow[]) => {
        const paid = rows.reduce((s, r) => s + r.totalPaid, 0);
        const pending = rows.reduce((s, r) => s + Math.max(0, r.totalContractAmount - r.totalPaid), 0);
        return [
          { name: t('report.col.paid'), value: paid },
          { name: t('report.col.pending'), value: pending },
        ];
      },
      computeWidgets: (rows: VendorRow[]) => [
        { label: t('report.widget.totalVendors'), value: String(rows.length) },
        { label: t('report.widget.totalPaid'), value: fmtAmount(rows.reduce((s, r) => s + r.totalPaid, 0)) },
      ],
      amountOf: (r: VendorRow) => r.totalContractAmount,
      billVoucherOf: (r: VendorRow) => r.voucherNumbers,
      billVoucherLabel: t('report.col.voucherNumber'),
      phoneOf: (r: VendorRow) => r.contact,
    };
  } else if (activeModule === 'member') {
    moduleProps = {
      pageTitle: t('report.nav.member'),
      data: members,
      dateOf: (r: Member) => r.membershipDate,
      searchOf: (r: Member) => `${r.name} ${r.phone} ${r.role}`,
      columns: [
        { key: 'name', label: t('report.col.name'), render: (r: Member) => r.name },
        { key: 'role', label: t('report.col.role'), render: (r: Member) => roleLabel(r.role) },
        { key: 'phone', label: t('report.col.phone'), render: (r: Member) => r.phone },
        { key: 'address', label: t('report.col.address'), render: (r: Member) => r.address || '' },
        { key: 'amount', label: t('report.col.amount'), align: 'right', render: (r: Member) => fmtAmount(getMemberCreditAmount(r)) },
        { key: 'status', label: t('report.col.status'), render: (r: Member) => (r.membershipPaymentStatus ? chandaStatusLabel(r.membershipPaymentStatus) : '') },
        { key: 'billNumber', label: t('report.col.billNumber'), render: (r: Member) => r.membershipBillNumber || '' },
        { key: 'remarks', label: t('report.col.remarks'), render: (r: Member) => r.membershipRemarks || '' },
        { key: 'joinDate', label: t('report.col.joinDate'), render: (r: Member) => fmtDate(r.joinDate) },
        { key: 'date', label: t('report.col.date'), render: (r: Member) => fmtDate(r.membershipDate) },
      ],
      chartType: 'area',
      metricOf: (r: Member) => getMemberCreditAmount(r),
      computeWidgets: (rows: Member[]) => [
        { label: t('report.widget.totalMembership'), value: fmtAmount(rows.reduce((s, r) => s + getMemberCreditAmount(r), 0)) },
        { label: t('report.widget.membersPaid'), value: String(rows.filter(r => getMemberCreditAmount(r) > 0).length) },
      ],
      amountOf: (r: Member) => getMemberCreditAmount(r),
      statusOf: (r: Member) => r.membershipPaymentStatus || '',
      statusOptions: CHANDA_STATUS_OPTIONS,
      billVoucherOf: (r: Member) => r.membershipBillNumber || '',
      billVoucherLabel: t('report.col.billNumber'),
      phoneOf: (r: Member) => r.phone,
      designationOf: (r: Member) => r.role,
      designationOptions: ROLE_OPTIONS,
      designationLabel: t('report.col.role'),
    };
  } else {
    // loan
    moduleProps = {
      pageTitle: t('report.nav.loan'),
      data: loansList,
      dateOf: (r: Loan) => r.date,
      searchOf: (r: Loan) => `${r.donorName} ${r.phone}`,
      columns: [
        { key: 'lender', label: t('report.col.lender'), render: (r: Loan) => r.donorName },
        { key: 'phone', label: t('report.col.phone'), render: (r: Loan) => r.phone },
        { key: 'received', label: t('report.col.received'), align: 'right', render: (r: Loan) => fmtAmount(r.amountReceived) },
        { key: 'repaid', label: t('report.col.repaid'), align: 'right', render: (r: Loan) => fmtAmount(r.amountPaid) },
        { key: 'net', label: t('report.col.net'), align: 'right', render: (r: Loan) => fmtAmount(getLoanNetAmount(r)) },
        { key: 'method', label: t('report.col.method'), render: (r: Loan) => paidMethodLabel(r.paymentMethod) },
        { key: 'returnDate', label: t('report.col.returnDate'), render: (r: Loan) => fmtDate(r.returnDate) },
        { key: 'remarks', label: t('report.col.remarks'), render: (r: Loan) => r.remarks || '' },
        { key: 'date', label: t('report.col.date'), render: (r: Loan) => fmtDate(r.date) },
      ],
      chartType: 'bar',
      metricOf: (r: Loan) => getLoanNetAmount(r),
      computeWidgets: (rows: Loan[]) => [
        { label: t('report.widget.totalOutstanding'), value: fmtAmount(rows.reduce((s, r) => s + getLoanNetAmount(r), 0)) },
        { label: t('report.widget.loanCount'), value: String(rows.length) },
      ],
      amountOf: (r: Loan) => r.amountReceived,
      paidMethodOf: (r: Loan) => r.paymentMethod,
      paidMethodOptions: PAID_METHOD_OPTIONS,
      phoneOf: (r: Loan) => r.phone,
    };
  }

  return (
    <div className="flex flex-col sm:flex-row gap-6">
      <ReportNav items={NAV_ITEMS} active={activeModule} onSelect={setActiveModule} />
      <div className="flex-1 min-w-0">
        <ReportModulePage
          key={activeModule}
          {...moduleProps}
          companyName={committeeAssociation}
          companyLogo={committeeLogo}
        />
      </div>
    </div>
  );
}

function ReportNav({ items, active, onSelect }: { items: { key: ModuleKey; label: string; icon: typeof HandCoins }[]; active: ModuleKey; onSelect: (k: ModuleKey) => void }) {
  return (
    <nav className="sm:w-52 shrink-0 sm:sticky sm:top-20 sm:self-start">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-2 flex sm:flex-col gap-1 overflow-x-auto">
        {items.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              active === key
                ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
