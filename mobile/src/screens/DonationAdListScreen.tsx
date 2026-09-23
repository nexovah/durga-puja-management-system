import { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Gift, Landmark, TrendingUp } from 'lucide-react-native';
import { listDonationAds, DonationAd, DonationAdCategory } from '../lib/db';
import { colors } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { ListRow } from '../components/ListRow';
import { Fab } from '../components/Fab';
import { formatAmount, formatDate } from '../lib/labels';

export function DonationAdListScreen({ route, navigation }: any) {
  const category: DonationAdCategory = route.params?.category || 'donation';
  const isAds = category === 'ads';
  const title = isAds ? 'Ads Collection' : 'Donations';

  const [rows, setRows] = useState<DonationAd[] | null>(null);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(true);

  const load = useCallback(async () => setRows(await listDonationAds(category)), [category]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!rows) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const filtered = rows.filter(r => !search.trim() || `${r.donorName} ${r.companyName} ${r.phone}`.toLowerCase().includes(search.trim().toLowerCase()));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const thisMonth = rows.filter(r => (r.date || '').slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s, r) => s + r.amount, 0);

  return (
    <View style={styles.container}>
      <ListHeader
        title={title}
        onBack={() => navigation.goBack()}
        showStats={showStats}
        onToggleStats={() => setShowStats(s => !s)}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(s => !s)}
      />
      {showStats && (
        <SummaryWidgets
          widgets={[
            { label: isAds ? 'Total Ads' : 'Total Donations', value: formatAmount(total), icon: Gift, tint: 'neutral' },
            { label: 'Transactions', value: String(rows.length), icon: Landmark, tint: 'neutral' },
            { label: 'This month', value: formatAmount(thisMonth), icon: TrendingUp, tint: 'amber' },
          ]}
        />
      )}
      {showSearch && <SearchBar value={search} onChangeText={setSearch} placeholder={isAds ? 'Search company name, phone…' : 'Search donor name, phone…'} />}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <ListRow
            initial={(item.donorName || item.companyName || '?').charAt(0).toUpperCase()}
            avatarBg={isAds ? colors.indigoBg : colors.greenBg}
            avatarColor={isAds ? colors.indigoText : colors.greenText}
            title={item.donorName || item.companyName || 'Unnamed'}
            subtitle={formatDate(item.date)}
            amount={formatAmount(item.amount)}
            amountColor={isAds ? colors.indigo : colors.green}
            onPress={() => navigation.navigate('DonationAdForm', { category, mode: 'edit', id: item.id })}
          />
        )}
      />
      <Fab onPress={() => navigation.navigate('DonationAdForm', { category, mode: 'add' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
