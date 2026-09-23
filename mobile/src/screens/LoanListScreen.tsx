import { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HandCoins, TrendingDown, Landmark } from 'lucide-react-native';
import { listLoans, getLoanNetAmount, Loan } from '../lib/loans';
import { colors } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { ListRow } from '../components/ListRow';
import { Fab } from '../components/Fab';
import { formatAmount, formatDate } from '../lib/labels';

export function LoanListScreen({ navigation }: any) {
  const [rows, setRows] = useState<Loan[] | null>(null);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(true);

  const load = useCallback(async () => setRows(await listLoans()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!rows) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const filtered = rows.filter(r => !search.trim() || `${r.donorName} ${r.phone}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalReceived = rows.reduce((s, r) => s + r.amountReceived, 0);
  const totalPaid = rows.reduce((s, r) => s + (r.amountPaid || 0), 0);
  const outstanding = rows.reduce((s, r) => s + getLoanNetAmount(r), 0);

  return (
    <View style={styles.container}>
      <ListHeader
        title="Loans"
        onBack={() => navigation.goBack()}
        showStats={showStats}
        onToggleStats={() => setShowStats(s => !s)}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(s => !s)}
      />
      {showStats && (
        <SummaryWidgets
          widgets={[
            { label: 'Received', value: formatAmount(totalReceived), icon: HandCoins, tint: 'neutral' },
            { label: 'Repaid', value: formatAmount(totalPaid), icon: Landmark, tint: 'green' },
            { label: 'Outstanding', value: formatAmount(outstanding), icon: TrendingDown, tint: 'amber' },
          ]}
        />
      )}
      {showSearch && <SearchBar value={search} onChangeText={setSearch} placeholder="Search lender name, phone…" />}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <ListRow
            initial={item.donorName.charAt(0).toUpperCase()}
            avatarBg={colors.amberBg}
            avatarColor={colors.amberText}
            title={item.donorName}
            subtitle={formatDate(item.date)}
            amount={formatAmount(getLoanNetAmount(item))}
            amountColor={colors.amber}
            onPress={() => navigation.navigate('LoanForm', { mode: 'edit', id: item.id })}
          />
        )}
      />
      <Fab onPress={() => navigation.navigate('LoanForm', { mode: 'add' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
