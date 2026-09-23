import { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Users, CheckCircle2, Clock } from 'lucide-react-native';
import { listMembers, getMemberCreditAmount, Member } from '../lib/db';
import { colors } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { ListRow } from '../components/ListRow';
import { Fab } from '../components/Fab';
import { formatAmount } from '../lib/labels';

export function MembersListScreen({ navigation }: any) {
  const [rows, setRows] = useState<Member[] | null>(null);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);

  const load = useCallback(async () => setRows(await listMembers()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!rows) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const filtered = rows.filter(r => !search.trim() || `${r.name} ${r.phone}`.toLowerCase().includes(search.trim().toLowerCase()));
  const paidCount = rows.filter(r => getMemberCreditAmount(r) > 0).length;

  return (
    <View style={styles.container}>
      <ListHeader title="Members" onBack={() => navigation.goBack()} showStats={showStats} onToggleStats={() => setShowStats(s => !s)} />
      {showStats && (
        <SummaryWidgets
          widgets={[
            { label: 'Total Members', value: String(rows.length), icon: Users, tint: 'neutral' },
            { label: 'Paid', value: String(paidCount), icon: CheckCircle2, tint: 'green' },
            { label: 'Pending', value: String(rows.length - paidCount), icon: Clock, tint: 'amber' },
          ]}
        />
      )}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, phone, designation…" />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const paid = getMemberCreditAmount(item) > 0;
          return (
            <ListRow
              initial={item.name.charAt(0).toUpperCase()}
              avatarBg={paid ? '#dcfce7' : '#fef3c7'}
              avatarColor={paid ? '#166534' : '#92400e'}
              title={item.name}
              subtitle={item.role || 'Member'}
              amount={formatAmount(getMemberCreditAmount(item))}
              badgeLabel={paid ? 'Paid' : 'Pending'}
              badgeBg={paid ? '#dcfce7' : '#fef3c7'}
              badgeColor={paid ? '#166534' : '#92400e'}
              onPress={() => navigation.navigate('MemberForm', { mode: 'edit', id: item.id })}
            />
          );
        }}
      />
      <Fab onPress={() => navigation.navigate('MemberForm', { mode: 'add' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
