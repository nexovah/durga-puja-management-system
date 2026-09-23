import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Receipt, CheckCircle2, Clock, ChevronRight } from 'lucide-react-native';
import { listExpenses, getExpenseCreditAmount, Expense } from '../lib/db';
import { colors, radius } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { Fab } from '../components/Fab';
import { formatAmount, formatDate, EXPENSE_STATUS_LABEL, STATUS_COLORS } from '../lib/labels';

export function ExpensesListScreen({ navigation }: any) {
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(true);

  const load = useCallback(async () => setRows(await listExpenses()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!rows) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const filtered = rows.filter(r => !search.trim() || `${r.title} ${r.vendorName} ${r.category}`.toLowerCase().includes(search.trim().toLowerCase()));
  const spent = rows.reduce((s, r) => s + getExpenseCreditAmount(r), 0);
  const paidCount = rows.filter(r => r.paymentStatus === 'paid').length;
  const partialCount = rows.filter(r => r.paymentStatus === 'partial').length;

  return (
    <View style={styles.container}>
      <ListHeader
        title="Expenses"
        onBack={() => navigation.goBack()}
        showStats={showStats}
        onToggleStats={() => setShowStats(s => !s)}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(s => !s)}
      />
      {showStats && (
        <SummaryWidgets
          widgets={[
            { label: 'Total Spent', value: formatAmount(spent), icon: Receipt, tint: 'neutral' },
            { label: 'Paid', value: String(paidCount), icon: CheckCircle2, tint: 'green' },
            { label: 'Partial', value: String(partialCount), icon: Clock, tint: 'amber' },
          ]}
        />
      )}
      {showSearch && <SearchBar value={search} onChangeText={setSearch} placeholder="Search title, vendor, voucher…" />}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const colorSet = STATUS_COLORS[item.paymentStatus];
          return (
            <TouchableOpacity onPress={() => navigation.navigate('ExpenseForm', { mode: 'edit', id: item.id })} style={styles.row} activeOpacity={0.7}>
              <View style={styles.icon}>
                <Receipt size={17} color={colors.red} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.subtitle} numberOfLines={1}>{item.category} · {formatDate(item.date)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <Text style={styles.amount}>-{formatAmount(getExpenseCreditAmount(item))}</Text>
                <View style={[styles.badge, { backgroundColor: colorSet.bg }]}>
                  <Text style={[styles.badgeText, { color: colorSet.text }]}>{EXPENSE_STATUS_LABEL[item.paymentStatus]}</Text>
                </View>
              </View>
              <ChevronRight size={16} color="#d6d3d1" strokeWidth={2.2} />
            </TouchableOpacity>
          );
        }}
      />
      <Fab onPress={() => navigation.navigate('ExpenseForm', { mode: 'add' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  row: { marginHorizontal: 20, marginVertical: 6, padding: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.redBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 12, color: colors.mutedLight, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '800', color: colors.red },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
