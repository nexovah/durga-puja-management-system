import { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CheckSquare, Clock, AlertTriangle } from 'lucide-react-native';
import { listTasks, Task } from '../lib/tasks';
import { colors } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { SummaryWidgets } from '../components/SummaryWidgets';
import { SearchBar } from '../components/SearchBar';
import { ListRow } from '../components/ListRow';
import { Fab } from '../components/Fab';
import { formatDate, STATUS_COLORS, TASK_PRIORITY_LABEL } from '../lib/labels';

export function TaskListScreen({ navigation }: any) {
  const [rows, setRows] = useState<Task[] | null>(null);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(true);

  const load = useCallback(async () => setRows(await listTasks()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!rows) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const filtered = rows.filter(r => !search.trim() || `${r.title} ${r.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  const openCount = rows.filter(r => r.priority !== 'completed').length;
  const highCount = rows.filter(r => r.priority === 'high').length;
  const completedCount = rows.filter(r => r.priority === 'completed').length;

  return (
    <View style={styles.container}>
      <ListHeader
        title="Tasks"
        onBack={() => navigation.goBack()}
        showStats={showStats}
        onToggleStats={() => setShowStats(s => !s)}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(s => !s)}
      />
      {showStats && (
        <SummaryWidgets
          widgets={[
            { label: 'Open', value: String(openCount), icon: CheckSquare, tint: 'neutral' },
            { label: 'High Priority', value: String(highCount), icon: AlertTriangle, tint: 'amber' },
            { label: 'Completed', value: String(completedCount), icon: Clock, tint: 'green' },
          ]}
        />
      )}
      {showSearch && <SearchBar value={search} onChangeText={setSearch} placeholder="Search title, description…" />}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const colorSet = STATUS_COLORS[item.priority];
          return (
            <ListRow
              initial={item.title.charAt(0).toUpperCase()}
              avatarBg={colorSet.bg}
              avatarColor={colorSet.text}
              title={item.title}
              subtitle={item.expiryDate ? `Due ${formatDate(item.expiryDate)}` : formatDate(item.createdAt)}
              amount=""
              badgeLabel={TASK_PRIORITY_LABEL[item.priority]}
              badgeBg={colorSet.bg}
              badgeColor={colorSet.text}
              onPress={() => navigation.navigate('TaskForm', { mode: 'edit', id: item.id })}
            />
          );
        }}
      />
      <Fab onPress={() => navigation.navigate('TaskForm', { mode: 'add' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
