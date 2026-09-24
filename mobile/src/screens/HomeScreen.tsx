import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Image } from 'react-native';
import {
  CheckSquare, LayoutGrid, Home as HomeIcon, CreditCard, TrendingUp, BarChart3, User, Plus,
  Wallet, Users, HeartHandshake, Megaphone, Receipt, Store, HandCoins, FileText,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import {
  listChanda, listMembers, listDonationAds, listExpenses, getCommitteeInfo,
  getChandaCreditAmount, getMemberCreditAmount, getExpenseCreditAmount,
  Chanda, Expense, DonationAd,
} from '../lib/db';
import { colors, radius } from '../theme';
import { formatAmount, formatDate } from '../lib/labels';

type WeekBucket = { label: string; income: number; expense: number };

type Totals = {
  totalChanda: number;
  totalMembers: number;
  totalDonation: number;
  totalCollected: number;
  totalSpent: number;
  recent: { id: string; kind: 'in' | 'out'; label: string; when: string; amount: string }[];
  weeks: WeekBucket[];
};

function buildWeeklyActivity(chandaList: Chanda[], donationAds: DonationAd[], expenses: Expense[]): WeekBucket[] {
  const WEEKS = 5;
  const now = new Date();
  const buckets: WeekBucket[] = [];
  const weekStarts: number[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() - i * 7);
    start.setHours(0, 0, 0, 0);
    weekStarts.push(start.getTime());
  }

  const bucketIndexFor = (dateStr?: string): number => {
    if (!dateStr) return -1;
    const t = new Date(dateStr).getTime();
    if (Number.isNaN(t)) return -1;
    for (let i = weekStarts.length - 1; i >= 0; i--) {
      if (t >= weekStarts[i]) return i;
    }
    return -1;
  };

  for (let i = 0; i < WEEKS; i++) {
    const d = new Date(weekStarts[i]);
    buckets.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), income: 0, expense: 0 });
  }

  chandaList.forEach(c => {
    const idx = bucketIndexFor(c.date);
    if (idx >= 0) buckets[idx].income += getChandaCreditAmount(c);
  });
  donationAds.forEach(d => {
    const idx = bucketIndexFor(d.date);
    if (idx >= 0) buckets[idx].income += d.amount;
  });
  expenses.forEach(e => {
    const idx = bucketIndexFor(e.date);
    if (idx >= 0) buckets[idx].expense += getExpenseCreditAmount(e);
  });

  return buckets;
}

export function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [committeeName, setCommitteeName] = useState('');
  const [committeeLogo, setCommitteeLogo] = useState('');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [chandaList, members, donationAds, expenses, committee] = await Promise.all([
      listChanda(), listMembers(), listDonationAds(), listExpenses(), getCommitteeInfo(),
    ]);
    setCommitteeName(committee.association || committee.name);
    setCommitteeLogo(committee.logo || '');

    const totalChanda = chandaList.reduce((s, c) => s + getChandaCreditAmount(c), 0);
    const totalDonation = donationAds.reduce((s, d) => s + d.amount, 0);
    const totalMembership = members.reduce((s, m) => s + getMemberCreditAmount(m), 0);
    const totalCollected = totalChanda + totalDonation + totalMembership;
    const totalSpent = expenses.reduce((s, e) => s + getExpenseCreditAmount(e), 0);

    const recentChanda = chandaList.slice(0, 3).map((c: Chanda) => ({
      id: `c-${c.id}`, kind: 'in' as const, label: `${c.donorName} — Chanda`, when: formatDate(c.date), amount: formatAmount(getChandaCreditAmount(c)),
    }));
    const recentExpenses = expenses.slice(0, 3).map((e: Expense) => ({
      id: `e-${e.id}`, kind: 'out' as const, label: e.title, when: formatDate(e.date), amount: formatAmount(getExpenseCreditAmount(e)),
    }));
    const recent = [...recentChanda, ...recentExpenses].slice(0, 4);

    const weeks = buildWeeklyActivity(chandaList, donationAds, expenses);

    setTotals({ totalChanda, totalMembers: members.length, totalDonation, totalCollected, totalSpent, recent, weeks });
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!totals) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  const collectedPct = totals.totalCollected > 0 ? Math.min(100, (totals.totalCollected / (totals.totalCollected + totals.totalSpent || 1)) * 100) : 0;
  const spentPct = 100 - collectedPct;

  const maxWeekValue = Math.max(1, ...totals.weeks.flatMap(w => [w.income, w.expense]));
  const isLogoUrl = /^https?:\/\//.test(committeeLogo);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 6, 20) }]}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.locationRow} onPress={() => navigation.navigate('Profile')} activeOpacity={0.7}>
            {isLogoUrl ? (
              <Image source={{ uri: committeeLogo }} style={styles.committeeLogo} />
            ) : (
              <View style={styles.committeeInitial}>
                <Text style={styles.committeeInitialText}>{(committeeName || 'C').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.locationText} numberOfLines={1}>{committeeName || 'Your Committee'}</Text>
          </TouchableOpacity>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'}!</Text>
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Menu')}>
          <LayoutGrid size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
      >
        <View style={styles.statsRow}>
          <View style={styles.activityCard}>
            <View style={styles.barsRow}>
              {totals.weeks.map((w, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barPairInner}>
                    <View style={[styles.bar, styles.barIncomeSeg, { height: `${Math.max(6, (w.income / maxWeekValue) * 100)}%` }]} />
                    <View style={[styles.bar, styles.barExpenseSeg, { height: `${Math.max(6, (w.expense / maxWeekValue) * 100)}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.activityLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
                <Text style={styles.legendText}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#7c2d12' }]} />
                <Text style={styles.legendText}>Expense</Text>
              </View>
            </View>
            <View>
              <Text style={styles.activityTitle}>Activity</Text>
              <Text style={styles.activitySubtitle} numberOfLines={1}>Income vs expense · 5 weeks</Text>
            </View>
          </View>

          <View style={{ flex: 1, gap: 12 }}>
            <View style={[styles.miniCard, { backgroundColor: '#fdf2f8' }]}>
              <View style={[styles.miniIconWrap, { backgroundColor: '#fce7f3' }]}>
                <CreditCard size={20} color="#9d174d" strokeWidth={2} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={[styles.miniValue, { color: '#831843' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{formatAmount(totals.totalChanda)}</Text>
                <Text style={[styles.miniLabel, { color: '#a8477a' }]}>Total Chanda</Text>
              </View>
            </View>
            <View style={[styles.miniCard, { backgroundColor: colors.indigoBg }]}>
              <View style={[styles.miniIconWrap, { backgroundColor: '#e0e7ff' }]}>
                <Users size={20} color={colors.indigoText} strokeWidth={2} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={[styles.miniValue, { color: colors.indigoText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{totals.totalMembers}</Text>
                <Text style={[styles.miniLabel, { color: colors.indigo }]}>Members</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>This period</Text>
            <View style={styles.surplusTag}>
              <TrendingUp size={12} color={colors.green} strokeWidth={2.5} />
              <Text style={styles.surplusText}>{totals.totalCollected >= totals.totalSpent ? 'Surplus' : 'Deficit'}</Text>
            </View>
          </View>
          <View style={{ gap: 9 }}>
            <View>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Collected</Text>
                <Text style={styles.progressValue}>{formatAmount(totals.totalCollected)}</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${collectedPct}%`, backgroundColor: colors.green }]} /></View>
            </View>
            <View>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Spent</Text>
                <Text style={styles.progressValue}>{formatAmount(totals.totalSpent)}</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${spentPct}%`, backgroundColor: colors.orange }]} /></View>
            </View>
          </View>
        </View>

        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick add</Text>
          </View>
          <View style={styles.grid}>
            <QuickTile icon={Wallet} color={colors.orange} bg={colors.orangeSoft} label="Chanda" onPress={() => navigation.navigate('ChandaList')} />
            <QuickTile icon={Users} color={colors.indigo} bg={colors.indigoBg} label="Members" onPress={() => navigation.navigate('MembersList')} />
            <QuickTile icon={HeartHandshake} color={colors.green} bg={colors.greenBg} label="Donation" onPress={() => navigation.navigate('DonationList')} />
            <QuickTile icon={Megaphone} color={colors.indigo} bg={colors.indigoBg} label="Advertisement" onPress={() => navigation.navigate('AdsList')} />
          </View>
          <View style={[styles.grid, { marginTop: 10 }]}>
            <QuickTile icon={Receipt} color={colors.red} bg={colors.redBg} label="Expenses" onPress={() => navigation.navigate('ExpensesList')} />
            <QuickTile icon={Store} color={colors.indigo} bg={colors.indigoBg} label="Vendor" onPress={() => navigation.navigate('VendorList')} />
            <QuickTile icon={HandCoins} color={colors.amber} bg={colors.amberBg} label="Loan" onPress={() => navigation.navigate('LoanList')} />
            <QuickTile icon={FileText} color={colors.orange} bg={colors.orangeSoft} label="Estimation" onPress={() => navigation.navigate('EstimationList')} />
          </View>
        </View>

        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>
          <View style={{ gap: 8 }}>
            {totals.recent.map(r => (
              <View key={r.id} style={styles.recentRow}>
                <View style={[styles.recentIcon, { backgroundColor: r.kind === 'in' ? '#dcfce7' : '#fee2e2' }]}>
                  {r.kind === 'in'
                    ? <Wallet size={18} color="#166534" strokeWidth={2} />
                    : <Receipt size={18} color="#b91c1c" strokeWidth={2} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.recentLabel} numberOfLines={1}>{r.label}</Text>
                  <Text style={styles.recentWhen}>{r.when}</Text>
                </View>
                <Text style={[styles.recentAmount, { color: r.kind === 'in' ? '#166534' : '#b91c1c' }]}>
                  {r.kind === 'in' ? '+' : '-'}{r.amount}
                </Text>
              </View>
            ))}
            {totals.recent.length === 0 && <Text style={styles.empty}>No activity yet.</Text>}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom + 6, 18) }]}>
        <View style={styles.navRow}>
          <Pressable onPress={() => navigation.navigate('Home')} hitSlop={10}>
            {({ pressed }) => <HomeIcon size={22} color={pressed ? colors.ink : colors.ink} strokeWidth={2.3} />}
          </Pressable>
          <Pressable onPress={() => navigation.navigate('TaskList')} hitSlop={10}>
            {({ pressed }) => <CheckSquare size={22} color={pressed ? colors.ink : colors.mutedLight} strokeWidth={pressed ? 2.3 : 2} />}
          </Pressable>
          <View style={{ width: 54 }} />
          <Pressable onPress={() => navigation.navigate('Reports')} hitSlop={10}>
            {({ pressed }) => <BarChart3 size={22} color={pressed ? colors.ink : colors.mutedLight} strokeWidth={pressed ? 2.3 : 2} />}
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={10}>
            {({ pressed }) => <User size={22} color={pressed ? colors.ink : colors.mutedLight} strokeWidth={pressed ? 2.3 : 2} />}
          </Pressable>
          <TouchableOpacity onPress={() => navigation.navigate('ChandaForm', { mode: 'add' })} style={styles.fab} activeOpacity={0.85}>
            <Plus size={22} color="#ffffff" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function QuickTile({ icon: Icon, color, bg, label, onPress }: { icon: any; color: string; bg: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.tile} activeOpacity={0.7}>
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <Icon size={20} color={color} strokeWidth={2} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 4, flexDirection: 'row', alignItems: 'flex-start' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, alignSelf: 'stretch', paddingRight: 28 },
  committeeLogo: { width: 33, height: 33, borderRadius: 16.5, borderWidth: 1, borderColor: '#d6d3d1' },
  committeeInitial: { width: 33, height: 33, borderRadius: 16.5, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d6d3d1' },
  committeeInitialText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  locationText: { flex: 1, fontSize: 13.5, color: colors.inkSoft, fontWeight: '800' },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.ink },
  menuButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 120, gap: 18 },
  statsRow: { flexDirection: 'row', gap: 12 },
  activityCard: { flex: 1.15, backgroundColor: '#fed7aa', borderRadius: radius.xl, padding: 16, justifyContent: 'flex-end', gap: 18 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 72, marginBottom: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barPairInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: '100%' },
  bar: { width: 8, borderRadius: 4 },
  barIncomeSeg: { backgroundColor: colors.green },
  barExpenseSeg: { backgroundColor: '#7c2d12' },
  activityLegendRow: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 10.5, fontWeight: '700', color: '#7c2d12' },
  activityTitle: { fontSize: 15, fontWeight: '800', color: '#7c2d12' },
  activitySubtitle: { fontSize: 10.5, color: '#9a5b34', marginTop: 1 },
  miniCard: { flex: 1, borderRadius: 18, padding: 13, justifyContent: 'center', gap: 9 },
  miniIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  miniValue: { fontSize: 17, fontWeight: '800' },
  miniLabel: { fontSize: 11, fontWeight: '600' },
  summaryCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 12 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { fontSize: 12.5, fontWeight: '700', color: colors.inkSoft },
  surplusTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  surplusText: { fontSize: 11, fontWeight: '700', color: colors.green },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { fontSize: 11.5, color: colors.inkSoft },
  progressValue: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  track: { height: 7, borderRadius: radius.pill, backgroundColor: colors.border },
  fill: { height: '100%', borderRadius: radius.pill },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  grid: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', gap: 7 },
  tileIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 10, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  recentRow: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recentLabel: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  recentWhen: { fontSize: 11.5, color: colors.mutedLight, marginTop: 1 },
  recentAmount: { fontSize: 13.5, fontWeight: '800' },
  empty: { fontSize: 13, color: colors.mutedLight, textAlign: 'center', paddingVertical: 12 },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 22 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, position: 'relative' },
  fab: { position: 'absolute', left: '50%', top: -30, marginLeft: -27, width: 54, height: 54, borderRadius: radius.pill, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', shadowColor: colors.dark, shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
