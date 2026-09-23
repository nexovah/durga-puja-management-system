import { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FileText, ListChecks, TrendingUp } from 'lucide-react-native';
import { listEstimations, getEstimationTotal, Estimation } from '../lib/estimations';
import { colors } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { ListRow } from '../components/ListRow';
import { Fab } from '../components/Fab';
import { formatAmount, formatDate } from '../lib/labels';

export function EstimationListScreen({ navigation }: any) {
  const [rows, setRows] = useState<Estimation[] | null>(null);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(true);

  const load = useCallback(async () => setRows(await listEstimations()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!rows) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const filtered = rows.filter(r => !search.trim() || r.title.toLowerCase().includes(search.trim().toLowerCase()));
  const totalValue = rows.reduce((s, r) => s + getEstimationTotal(r), 0);
  const totalLineItems = rows.reduce((s, r) => s + r.lineItems.length, 0);

  return (
    <View style={styles.container}>
      <ListHeader
        title="Estimations"
        onBack={() => navigation.goBack()}
        showStats={showStats}
        onToggleStats={() => setShowStats(s => !s)}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(s => !s)}
      />
      {showStats && (
        <SummaryWidgets
          widgets={[
            { label: 'Estimations', value: String(rows.length), icon: FileText, tint: 'neutral' },
            { label: 'Total Value', value: formatAmount(totalValue), icon: TrendingUp, tint: 'green' },
            { label: 'Line Items', value: String(totalLineItems), icon: ListChecks, tint: 'amber' },
          ]}
        />
      )}
      {showSearch && <SearchBar value={search} onChangeText={setSearch} placeholder="Search estimation title…" />}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <ListRow
            initial={(item.title || '?').charAt(0).toUpperCase()}
            avatarBg={colors.indigoBg}
            avatarColor={colors.indigoText}
            title={item.title || 'Untitled'}
            subtitle={`${item.lineItems.length} item${item.lineItems.length === 1 ? '' : 's'} · ${formatDate(item.createdAt)}`}
            amount={formatAmount(getEstimationTotal(item))}
            onPress={() => navigation.navigate('EstimationForm', { mode: 'edit', id: item.id })}
          />
        )}
      />
      <Fab onPress={() => navigation.navigate('EstimationForm', { mode: 'add' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
