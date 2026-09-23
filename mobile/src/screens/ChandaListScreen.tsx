import { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Receipt, CheckCircle2, Clock } from 'lucide-react-native';
import { listChanda, getChandaCreditAmount, Chanda } from '../lib/db';
import { colors } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { ListRow } from '../components/ListRow';
import { Fab } from '../components/Fab';
import { formatAmount, formatDate, PAYMENT_STATUS_LABEL, STATUS_COLORS } from '../lib/labels';

export function ChandaListScreen({ navigation }: any) {
  const [rows, setRows] = useState<Chanda[] | null>(null);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(true);

  const load = useCallback(async () => {
    const data = await listChanda();
    setRows(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!rows) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  const filtered = rows.filter(r => !search.trim() || `${r.donorName} ${r.phone}`.toLowerCase().includes(search.trim().toLowerCase()));

  const collected = rows.reduce((s, r) => s + getChandaCreditAmount(r), 0);
  const pending = rows.reduce((s, r) => {
    if (r.paymentStatus === 'pending') return s + r.amount;
    if (r.paymentStatus === 'partial') return s + Math.max(0, r.amount - (r.partialAmount || 0));
    return s;
  }, 0);
  const target = collected + pending;

  return (
    <View style={styles.container}>
      <ListHeader
        title="Chanda Collection"
        onBack={() => navigation.goBack()}
        showStats={showStats}
        onToggleStats={() => setShowStats(s => !s)}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(s => !s)}
      />
      {showStats && (
        <SummaryWidgets
          widgets={[
            { label: 'Target', value: formatAmount(target), icon: Receipt, tint: 'neutral' },
            { label: 'Collected', value: formatAmount(collected), icon: CheckCircle2, tint: 'green' },
            { label: 'Pending', value: formatAmount(pending), icon: Clock, tint: 'amber' },
          ]}
        />
      )}
      {showSearch && <SearchBar value={search} onChangeText={setSearch} placeholder="Search donor name, phone…" />}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const colorSet = STATUS_COLORS[item.paymentStatus];
          return (
            <ListRow
              initial={item.donorName.charAt(0).toUpperCase()}
              avatarBg={colorSet.bg}
              avatarColor={colorSet.text}
              title={item.donorName}
              subtitle={formatDate(item.date)}
              amount={formatAmount(getChandaCreditAmount(item))}
              badgeLabel={PAYMENT_STATUS_LABEL[item.paymentStatus]}
              badgeBg={colorSet.bg}
              badgeColor={colorSet.text}
              onPress={() => navigation.navigate('ChandaForm', { mode: 'edit', id: item.id })}
            />
          );
        }}
      />
      <Fab onPress={() => navigation.navigate('ChandaForm', { mode: 'add' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
