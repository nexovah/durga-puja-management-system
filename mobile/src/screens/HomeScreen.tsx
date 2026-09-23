import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import {
  Landmark, LayoutGrid, MapPin, Home as HomeIcon, CreditCard, TrendingUp, User, Plus,
  Wallet, Users, Gift, Receipt,
} from 'lucide-react-native';
import { useAuth } from '../lib/auth';
import {
  listChanda, listMembers, listDonationAds, listExpenses, getCommitteeInfo,
  getChandaCreditAmount, getMemberCreditAmount, getExpenseCreditAmount,
  Chanda, Expense,
} from '../lib/db';
import { colors, radius } from '../theme';
import { formatAmount, formatDate } from '../lib/labels';

type Totals = {
  totalChanda: number;
  totalMembers: number;
  totalDonation: number;
  totalCollected: number;
  totalSpent: number;
  recent: { id: string; kind: 'in' | 'out'; label: string; when: string; amount: string }[];
};

export function HomeScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [committeeName, setCommitteeName] = useState('');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [chandaList, members, donationAds, expenses, committee] = await Promise.all([
      listChanda(), listMembers(), listDonationAds(), listExpenses(), getCommitteeInfo(),
    ]);
    setCommitteeName(committee.association || committee.name);

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

    setTotals({ totalChanda, totalMembers: members.length, totalDonation, totalCollected, totalSpent, recent });
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.locationRow}>
            <MapPin size={12} color={colors.mutedLight} strokeWidth={2.3} />
            <Text style={styles.locationText} numberOfLines={1}>{committeeName || 'Your Committee'}</Text>
          </View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'}!</Text>
          <Text style={styles.welcome}>Welcome back</Text>
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => Alert.alert('Log out', 'Log out of Durga CRM?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: logout },
          ])}
        >
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
              <View style={[styles.bar, { height: '34%', opacity: 0.35 }]} />
              <View style={[styles.bar, { height: '58%', opacity: 0.5 }]} />
              <View style={[styles.bar, { height: '100%' }]} />
              <View style={[styles.bar, { height: '66%', opacity: 0.6 }]} />
              <View style={[styles.bar, { height: '40%', opacity: 0.4 }]} />
            </View>
            <View>
              <Text style={styles.activityTitle}>Activity</Text>
              <Text style={styles.activitySubtitle}>Chanda this week</Text>
            </View>
          </View>

          <View style={{ flex: 1, gap: 12 }}>
            <View style={[styles.miniCard, { backgroundColor: '#fdf2f8' }]}>
              <CreditCard size={17} color="#9d174d" strokeWidth={2} />
              <View>
                <Text style={[styles.miniValue, { color: '#831843' }]}>{formatAmount(totals.totalChanda)}</Text>
                <Text style={[styles.miniLabel, { color: '#a8477a' }]}>Total Chanda</Text>
              </View>
            </View>
            <View style={[styles.miniCard, { backgroundColor: colors.indigoBg }]}>
              <Users size={17} color={colors.indigoText} strokeWidth={2} />
              <View>
                <Text style={[styles.miniValue, { color: colors.indigoText }]}>{totals.totalMembers}</Text>
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
              <View style={styles.track}><View style={[styles.fill, { width: `${collectedPct}%`, backgroundColor: colors.orange }]} /></View>
            </View>
            <View>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Spent</Text>
                <Text style={styles.progressValue}>{formatAmount(totals.totalSpent)}</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${spentPct}%`, backgroundColor: '#d6d3d1' }]} /></View>
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
            <QuickTile icon={Gift} color={colors.green} bg={colors.greenBg} label="Ads" onPress={() => navigation.navigate('AdsList')} />
            <QuickTile icon={Receipt} color={colors.red} bg={colors.redBg} label="Expenses" onPress={() => navigation.navigate('ExpensesList')} />
          </View>
        </View>

        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
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

      <View style={styles.bottomNav}>
        <View style={styles.navRow}>
          <HomeIcon size={22} color={colors.ink} strokeWidth={2.3} />
          <Landmark size={22} color="#d6d3d1" strokeWidth={2} />
          <View style={{ width: 54 }} />
          <TrendingUp size={22} color="#d6d3d1" strokeWidth={2} />
          <User size={22} color="#d6d3d1" strokeWidth={2} />
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
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  locationText: { fontSize: 12, color: colors.mutedLight, fontWeight: '600', maxWidth: 220 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.ink },
  welcome: { fontSize: 13, color: colors.mutedLight, marginTop: 2 },
  menuButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 120, gap: 18 },
  statsRow: { flexDirection: 'row', gap: 12 },
  activityCard: { flex: 1.15, backgroundColor: '#fed7aa', borderRadius: radius.xl, padding: 16, justifyContent: 'space-between', gap: 20 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 46 },
  bar: { width: 8, borderRadius: 4, backgroundColor: '#9a3412' },
  activityTitle: { fontSize: 15, fontWeight: '800', color: '#7c2d12' },
  activitySubtitle: { fontSize: 11, color: '#9a5b34', marginTop: 1 },
  miniCard: { flex: 1, borderRadius: 18, padding: 13, justifyContent: 'space-between' },
  miniValue: { fontSize: 13, fontWeight: '800' },
  miniLabel: { fontSize: 9.5, fontWeight: '600' },
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
  fab: { position: 'absolute', left: '50%', top: -34, marginLeft: -27, width: 54, height: 54, borderRadius: radius.pill, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#ffffff', shadowColor: colors.dark, shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
