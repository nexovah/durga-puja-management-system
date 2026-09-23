// Vendors — read-only, derived from Expense.vendorName/vendorContact, same
// as the web app's Vendors.tsx. There is no separate vendors table, so
// there is nothing to add/edit here (matches web behavior exactly).
import { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Store, Receipt, TrendingUp } from 'lucide-react-native';
import { listExpenses, vendorGroupsFromExpenses, VendorGroup } from '../lib/db';
import { colors } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { ListRow } from '../components/ListRow';
import { formatAmount } from '../lib/labels';

export function VendorListScreen({ navigation }: any) {
  const [groups, setGroups] = useState<VendorGroup[] | null>(null);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(true);

  const load = useCallback(async () => {
    const expenses = await listExpenses();
    setGroups(vendorGroupsFromExpenses(expenses));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!groups) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const filtered = groups.filter(g => !search.trim() || `${g.name} ${g.contact}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalPaid = groups.reduce((s, g) => s + g.totalAmount, 0);
  const totalPending = groups.reduce((s, g) => s + Math.max(0, g.totalContractAmount - g.totalAmount), 0);

  return (
    <View style={styles.container}>
      <ListHeader
        title="Vendors"
        onBack={() => navigation.goBack()}
        showStats={showStats}
        onToggleStats={() => setShowStats(s => !s)}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(s => !s)}
      />
      {showStats && (
        <SummaryWidgets
          widgets={[
            { label: 'Vendors', value: String(groups.length), icon: Store, tint: 'neutral' },
            { label: 'Paid', value: formatAmount(totalPaid), icon: Receipt, tint: 'green' },
            { label: 'Pending', value: formatAmount(totalPending), icon: TrendingUp, tint: 'amber' },
          ]}
        />
      )}
      {showSearch && <SearchBar value={search} onChangeText={setSearch} placeholder="Search vendor name, contact…" />}
      <FlatList
        data={filtered}
        keyExtractor={item => item.key}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <ListRow
            initial={item.name.charAt(0).toUpperCase()}
            avatarBg={colors.indigoBg}
            avatarColor={colors.indigoText}
            title={item.name}
            subtitle={`${item.entries.length} transaction${item.entries.length === 1 ? '' : 's'}`}
            metaText={item.contact || undefined}
            amount={formatAmount(item.totalAmount)}
            amountColor={colors.green}
            onPress={() => navigation.navigate('VendorDetail', { key: item.key })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
