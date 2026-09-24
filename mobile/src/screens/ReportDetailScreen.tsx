// Generic per-module report engine — one screen parametrized by
// route.params.module, mirroring web's ReportModulePage.tsx behavior:
// date-range filter, search, summary widgets, a bar chart, a read-only row
// list, and CSV/PDF export via a 3-dot menu. View + export only — no
// add/edit/delete anywhere here, per the report module's spec.
import { useCallback, useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  MoreVertical, Download, FileDown, Receipt, CheckCircle2, Clock, Users, HeartHandshake, Megaphone,
  Store, TrendingUp, HandCoins, FileText,
} from 'lucide-react-native';
import {
  listChanda, listMembers, listDonationAds, listExpenses, vendorGroupsFromExpenses,
  getChandaCreditAmount, getMemberCreditAmount, getExpenseCreditAmount, getCommitteeInfo,
  Chanda, Member, DonationAd, Expense, VendorGroup,
} from '../lib/db';
import { listLoans, getLoanNetAmount, Loan } from '../lib/loans';
import { listEstimations, getEstimationTotal, Estimation } from '../lib/estimations';
import { colors, radius } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets, Widget } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { ListRow } from '../components/ListRow';
import { BottomSheet } from '../components/BottomSheet';
import { ReportBarChart, BarChartPoint } from '../components/ReportBarChart';
import { formatAmount, formatDate, PAYMENT_STATUS_LABEL, STATUS_COLORS } from '../lib/labels';
import { exportCSV, exportPDF, ReportColumn } from '../lib/reportExport';

type Range = 'all' | 'month' | 'lastMonth';
const RANGES: { key: Range; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'month', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
];

const MODULE_LABELS: Record<string, string> = {
  chanda: 'Chanda', donation: 'Donation', ads: 'Advertisement', expenses: 'Expenses',
  vendor: 'Vendor', member: 'Members', loan: 'Loans', estimation: 'Estimation',
};

function inRange(dateStr: string | undefined, range: Range): boolean {
  if (range === 'all') return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  let refMonth = now.getMonth();
  let refYear = now.getFullYear();
  if (range === 'lastMonth') {
    refMonth -= 1;
    if (refMonth < 0) { refMonth = 11; refYear -= 1; }
  }
  return d.getMonth() === refMonth && d.getFullYear() === refYear;
}

// Buckets a list of dated amounts into the last N weeks — same technique as
// Home's Activity widget bars, reused here for the report chart.
function buildWeeklyBars<T>(items: T[], getDate: (t: T) => string | undefined, getAmount: (t: T) => number, weeks = 6): BarChartPoint[] {
  const now = new Date();
  const starts: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() - i * 7);
    start.setHours(0, 0, 0, 0);
    starts.push(start.getTime());
  }
  const points: BarChartPoint[] = starts.map(t => {
    const d = new Date(t);
    return { label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: 0 };
  });
  items.forEach(item => {
    const dateStr = getDate(item);
    if (!dateStr) return;
    const t = new Date(dateStr).getTime();
    if (Number.isNaN(t)) return;
    for (let i = starts.length - 1; i >= 0; i--) {
      if (t >= starts[i]) { points[i].value += getAmount(item); break; }
    }
  });
  return points;
}

export function ReportDetailScreen({ navigation, route }: any) {
  const moduleKey: string = route.params?.module || 'chanda';
  const label = MODULE_LABELS[moduleKey] || moduleKey;

  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('all');
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [chandaList, setChandaList] = useState<Chanda[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [donations, setDonations] = useState<DonationAd[]>([]);
  const [ads, setAds] = useState<DonationAd[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [estimations, setEstimations] = useState<Estimation[]>([]);
  const [committee, setCommittee] = useState({ name: '', association: '', logo: '', email: '', phone: '', mobile1: '', address: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [ch, mem, don, ad, exp, ln, est, com] = await Promise.all([
      listChanda(), listMembers(), listDonationAds('donation'), listDonationAds('ads'),
      listExpenses(), listLoans(), listEstimations(), getCommitteeInfo(),
    ]);
    setChandaList(ch); setMembers(mem); setDonations(don); setAds(ad);
    setExpenses(exp); setLoans(ln); setEstimations(est); setCommittee(com);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (moduleKey === 'chanda') {
      const rows = chandaList.filter(r => inRange(r.date, range) && (!q || `${r.donorName} ${r.phone}`.toLowerCase().includes(q)));
      const collected = rows.reduce((s, r) => s + getChandaCreditAmount(r), 0);
      const pending = rows.reduce((s, r) => s + (r.paymentStatus === 'pending' ? r.amount : r.paymentStatus === 'partial' ? Math.max(0, r.amount - (r.partialAmount || 0)) : 0), 0);
      const widgets: Widget[] = [
        { label: 'Total Chanda', value: formatAmount(collected + pending), icon: Receipt, tint: 'neutral' },
        { label: 'Collected', value: formatAmount(collected), icon: CheckCircle2, tint: 'green' },
        { label: 'Pending', value: formatAmount(pending), icon: Clock, tint: 'amber' },
      ];
      const chart = buildWeeklyBars(rows, r => r.date, getChandaCreditAmount);
      const columns: ReportColumn<Chanda>[] = [
        { key: 'donorName', label: 'Donor', render: r => r.donorName },
        { key: 'phone', label: 'Phone', render: r => r.phone },
        { key: 'amount', label: 'Amount', render: r => String(getChandaCreditAmount(r)) },
        { key: 'status', label: 'Status', render: r => PAYMENT_STATUS_LABEL[r.paymentStatus] },
        { key: 'date', label: 'Date', render: r => formatDate(r.date) },
      ];
      return { rows, widgets, chart, columns, hasChart: true };
    }

    if (moduleKey === 'donation' || moduleKey === 'ads') {
      const source = moduleKey === 'donation' ? donations : ads;
      const rows = source.filter(r => inRange(r.date, range) && (!q || `${r.donorName} ${r.companyName || ''} ${r.phone}`.toLowerCase().includes(q)));
      const total = rows.reduce((s, r) => s + r.amount, 0);
      const thisMonth = rows.filter(r => inRange(r.date, 'month')).reduce((s, r) => s + r.amount, 0);
      const widgets: Widget[] = [
        { label: 'Total', value: formatAmount(total), icon: moduleKey === 'donation' ? HeartHandshake : Megaphone, tint: 'green' },
        { label: 'Transactions', value: String(rows.length), icon: Receipt, tint: 'neutral' },
        { label: 'This Month', value: formatAmount(thisMonth), icon: TrendingUp, tint: 'amber' },
      ];
      const chart = buildWeeklyBars(rows, r => r.date, r => r.amount);
      const columns: ReportColumn<DonationAd>[] = [
        { key: 'donorName', label: 'Donor', render: r => r.donorName },
        { key: 'companyName', label: 'Company', render: r => r.companyName || '' },
        { key: 'phone', label: 'Phone', render: r => r.phone },
        { key: 'amount', label: 'Amount', render: r => String(r.amount) },
        { key: 'date', label: 'Date', render: r => formatDate(r.date) },
      ];
      return { rows, widgets, chart, columns, hasChart: true };
    }

    if (moduleKey === 'expenses') {
      const rows = expenses.filter(r => inRange(r.date, range) && (!q || `${r.title} ${r.vendorName || ''} ${r.category}`.toLowerCase().includes(q)));
      const spent = rows.reduce((s, r) => s + getExpenseCreditAmount(r), 0);
      const paid = rows.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + r.amount, 0);
      const pending = rows.reduce((s, r) => s + (r.paymentStatus !== 'cancelled' ? Math.max(0, r.amount - getExpenseCreditAmount(r)) : 0), 0);
      const widgets: Widget[] = [
        { label: 'Total Spent', value: formatAmount(spent), icon: Receipt, tint: 'neutral' },
        { label: 'Paid', value: formatAmount(paid), icon: CheckCircle2, tint: 'green' },
        { label: 'Pending', value: formatAmount(pending), icon: Clock, tint: 'amber' },
      ];
      const chart = buildWeeklyBars(rows, r => r.date, getExpenseCreditAmount);
      const columns: ReportColumn<Expense>[] = [
        { key: 'title', label: 'Title', render: r => r.title },
        { key: 'category', label: 'Category', render: r => r.category },
        { key: 'vendorName', label: 'Vendor', render: r => r.vendorName || '' },
        { key: 'amount', label: 'Amount', render: r => String(r.amount) },
        { key: 'status', label: 'Status', render: r => r.paymentStatus },
        { key: 'date', label: 'Date', render: r => formatDate(r.date) },
      ];
      return { rows, widgets, chart, columns, hasChart: true };
    }

    if (moduleKey === 'vendor') {
      const filteredExpenses = expenses.filter(e => inRange(e.date, range));
      let groups = vendorGroupsFromExpenses(filteredExpenses);
      if (q) groups = groups.filter(g => `${g.name} ${g.contact}`.toLowerCase().includes(q));
      const totalPaid = groups.reduce((s, g) => s + g.totalAmount, 0);
      const totalPending = groups.reduce((s, g) => s + Math.max(0, g.totalContractAmount - g.totalAmount), 0);
      const widgets: Widget[] = [
        { label: 'Vendors', value: String(groups.length), icon: Store, tint: 'neutral' },
        { label: 'Paid', value: formatAmount(totalPaid), icon: CheckCircle2, tint: 'green' },
        { label: 'Pending', value: formatAmount(totalPending), icon: Clock, tint: 'amber' },
      ];
      const chart: BarChartPoint[] = groups.slice(0, 6).map(g => ({ label: g.name.split(' ')[0], value: g.totalAmount }));
      const columns: ReportColumn<VendorGroup>[] = [
        { key: 'name', label: 'Vendor', render: r => r.name },
        { key: 'contact', label: 'Contact', render: r => r.contact },
        { key: 'transactions', label: 'Transactions', render: r => String(r.entries.length) },
        { key: 'paid', label: 'Paid', render: r => String(r.totalAmount) },
        { key: 'pending', label: 'Pending', render: r => String(Math.max(0, r.totalContractAmount - r.totalAmount)) },
      ];
      return { rows: groups, widgets, chart, columns, hasChart: true };
    }

    if (moduleKey === 'member') {
      const rows = members.filter(r => inRange(r.joinDate, range) && (!q || `${r.name} ${r.phone}`.toLowerCase().includes(q)));
      const total = rows.length;
      const paid = rows.reduce((s, r) => s + getMemberCreditAmount(r), 0);
      const widgets: Widget[] = [
        { label: 'Total', value: String(total), icon: Users, tint: 'neutral' },
        { label: 'Paid', value: formatAmount(paid), icon: CheckCircle2, tint: 'green' },
      ];
      const chart = buildWeeklyBars(rows, r => r.membershipDate || r.joinDate, getMemberCreditAmount);
      const columns: ReportColumn<Member>[] = [
        { key: 'name', label: 'Name', render: r => r.name },
        { key: 'phone', label: 'Phone', render: r => r.phone },
        { key: 'role', label: 'Role', render: r => r.role },
        { key: 'amount', label: 'Membership Amount', render: r => String(getMemberCreditAmount(r)) },
        { key: 'joinDate', label: 'Join Date', render: r => formatDate(r.joinDate) },
      ];
      return { rows, widgets, chart, columns, hasChart: true };
    }

    if (moduleKey === 'loan') {
      const rows = loans.filter(r => inRange(r.date, range) && (!q || `${r.donorName} ${r.phone}`.toLowerCase().includes(q)));
      const received = rows.reduce((s, r) => s + r.amountReceived, 0);
      const repaid = rows.reduce((s, r) => s + (r.amountPaid || 0), 0);
      const outstanding = rows.reduce((s, r) => s + getLoanNetAmount(r), 0);
      const widgets: Widget[] = [
        { label: 'Received', value: formatAmount(received), icon: HandCoins, tint: 'neutral' },
        { label: 'Repaid', value: formatAmount(repaid), icon: CheckCircle2, tint: 'green' },
        { label: 'Outstanding', value: formatAmount(outstanding), icon: Clock, tint: 'amber' },
      ];
      const chart = buildWeeklyBars(rows, r => r.date, r => r.amountReceived);
      const columns: ReportColumn<Loan>[] = [
        { key: 'donorName', label: 'Lender', render: r => r.donorName },
        { key: 'phone', label: 'Phone', render: r => r.phone },
        { key: 'received', label: 'Received', render: r => String(r.amountReceived) },
        { key: 'paid', label: 'Repaid', render: r => String(r.amountPaid || 0) },
        { key: 'outstanding', label: 'Outstanding', render: r => String(getLoanNetAmount(r)) },
        { key: 'date', label: 'Date', render: r => formatDate(r.date) },
      ];
      return { rows, widgets, chart, columns, hasChart: true };
    }

    // estimation — no chart, matching web's ReportEstimationPage.tsx
    const rows = estimations.filter(r => inRange(r.createdAt, range) && (!q || r.title.toLowerCase().includes(q)));
    const totalValue = rows.reduce((s, r) => s + getEstimationTotal(r), 0);
    const widgets: Widget[] = [
      { label: 'Estimations', value: String(rows.length), icon: FileText, tint: 'neutral' },
      { label: 'Total Value', value: formatAmount(totalValue), icon: TrendingUp, tint: 'green' },
    ];
    const columns: ReportColumn<Estimation>[] = [
      { key: 'title', label: 'Title', render: r => r.title },
      { key: 'items', label: 'Line Items', render: r => String(r.lineItems.length) },
      { key: 'total', label: 'Total', render: r => String(getEstimationTotal(r)) },
      { key: 'createdAt', label: 'Created', render: r => formatDate(r.createdAt) },
      { key: 'createdByName', label: 'By', render: r => r.createdByName },
    ];
    return { rows, widgets, chart: [] as BarChartPoint[], columns, hasChart: false };
  }, [moduleKey, range, search, chandaList, members, donations, ads, expenses, loans, estimations]);

  const handleExport = async (kind: 'csv' | 'pdf') => {
    setMenuOpen(false);
    setExporting(true);
    try {
      if (kind === 'csv') await exportCSV(data.columns as any, data.rows as any, label);
      else await exportPDF(data.columns as any, data.rows as any, label, committee);
    } catch {
      // Export failures (no share target, disk error) are silently ignored —
      // the native share sheet itself communicates cancellation to the user.
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ListHeader title={`${label} Report`} onBack={() => navigation.goBack()} />
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.menuBtn} hitSlop={10}>
          <MoreVertical size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <View style={styles.chipsRow}>
        {RANGES.map(r => (
          <TouchableOpacity
            key={r.key}
            onPress={() => setRange(r.key)}
            style={[styles.chip, range === r.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, range === r.key && styles.chipTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SummaryWidgets widgets={data.widgets} />
      {data.hasChart && <ReportBarChart points={data.chart} />}
      <SearchBar value={search} onChangeText={setSearch} placeholder={`Search ${label.toLowerCase()}…`} />

      <FlatList
        data={data.rows as any[]}
        keyExtractor={(item: any, i) => item.id || item.key || String(i)}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 40 }}
        renderItem={({ item }) => <ReportRow moduleKey={moduleKey} item={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No records for this range.</Text>}
      />

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Text style={styles.sheetTitle}>Export {label} Report</Text>
        <TouchableOpacity style={styles.sheetOption} onPress={() => handleExport('csv')} disabled={exporting}>
          <Download size={18} color={colors.inkSoft} strokeWidth={2} />
          <Text style={styles.sheetOptionText}>Download CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetOption} onPress={() => handleExport('pdf')} disabled={exporting}>
          <FileDown size={18} color={colors.inkSoft} strokeWidth={2} />
          <Text style={styles.sheetOptionText}>Download PDF</Text>
        </TouchableOpacity>
        {exporting && <ActivityIndicator color={colors.orange} style={{ marginTop: 8 }} />}
      </BottomSheet>
    </View>
  );
}

function ReportRow({ moduleKey, item }: { moduleKey: string; item: any }) {
  switch (moduleKey) {
    case 'chanda': {
      const colorSet = STATUS_COLORS[item.paymentStatus as string];
      return (
        <ListRow
          initial={item.donorName.charAt(0).toUpperCase()}
          avatarBg={colorSet.bg} avatarColor={colorSet.text}
          title={item.donorName} subtitle={formatDate(item.date)}
          amount={formatAmount(getChandaCreditAmount(item))}
          badgeLabel={PAYMENT_STATUS_LABEL[item.paymentStatus as keyof typeof PAYMENT_STATUS_LABEL]} badgeBg={colorSet.bg} badgeColor={colorSet.text}
          onPress={() => {}}
        />
      );
    }
    case 'donation':
    case 'ads':
      return (
        <ListRow
          initial={item.donorName.charAt(0).toUpperCase()}
          avatarBg={colors.greenBg} avatarColor={colors.greenText}
          title={item.donorName} subtitle={item.companyName || formatDate(item.date)}
          amount={formatAmount(item.amount)}
          onPress={() => {}}
        />
      );
    case 'expenses':
      return (
        <ListRow
          initial={item.title.charAt(0).toUpperCase()}
          avatarBg={colors.redBg} avatarColor={colors.red}
          title={item.title} subtitle={`${item.category} · ${formatDate(item.date)}`}
          amount={formatAmount(getExpenseCreditAmount(item))}
          onPress={() => {}}
        />
      );
    case 'vendor':
      return (
        <ListRow
          initial={item.name.charAt(0).toUpperCase()}
          avatarBg={colors.indigoBg} avatarColor={colors.indigoText}
          title={item.name} subtitle={`${item.entries.length} transaction${item.entries.length === 1 ? '' : 's'}`}
          metaText={item.contact || undefined}
          amount={formatAmount(item.totalAmount)} amountColor={colors.green}
          onPress={() => {}}
        />
      );
    case 'member':
      return (
        <ListRow
          initial={item.name.charAt(0).toUpperCase()}
          avatarBg={colors.indigoBg} avatarColor={colors.indigoText}
          title={item.name} subtitle={item.role || formatDate(item.joinDate)}
          amount={formatAmount(getMemberCreditAmount(item))}
          onPress={() => {}}
        />
      );
    case 'loan':
      return (
        <ListRow
          initial={item.donorName.charAt(0).toUpperCase()}
          avatarBg={colors.amberBg} avatarColor={colors.amberText}
          title={item.donorName} subtitle={formatDate(item.date)}
          amount={formatAmount(getLoanNetAmount(item))}
          onPress={() => {}}
        />
      );
    default:
      return (
        <ListRow
          initial={item.title.charAt(0).toUpperCase()}
          avatarBg={colors.orangeSoft} avatarColor={colors.orange}
          title={item.title} subtitle={`${item.lineItems.length} items · ${formatDate(item.createdAt)}`}
          amount={formatAmount(getEstimationTotal(item))}
          onPress={() => {}}
        />
      );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  headerRow: { position: 'relative' },
  menuBtn: { position: 'absolute', right: 20, bottom: 14 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  chipTextActive: { color: '#ffffff' },
  empty: { fontSize: 13, color: colors.mutedLight, textAlign: 'center', paddingVertical: 24 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  sheetOptionText: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
