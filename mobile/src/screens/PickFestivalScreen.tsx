// Pick which active festival this user is currently working in — mirrors
// web's EventSwitcher dropdown: personal, instant, no confirmation. Lists
// only the tenant's currently-active festivals (events.is_active = true);
// marking one active/inactive is still web/admin-only (ManageFestivalsPage).
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays, Check } from 'lucide-react-native';
import { useAuth } from '../lib/auth';
import { listActiveEvents, setCurrentEvent, getMyCurrentEvent, ActiveEventInfo } from '../lib/db';
import { colors, radius } from '../theme';

export function PickFestivalScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [events, setEvents] = useState<ActiveEventInfo[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    const [list, current] = await Promise.all([listActiveEvents(user.tenantId), getMyCurrentEvent()]);
    setEvents(list);
    setCurrentId(current?.id ?? null);
  }, [user?.tenantId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePick = async (eventId: string) => {
    if (eventId === currentId) { navigation.goBack(); return; }
    setSwitching(eventId);
    try {
      await setCurrentEvent(eventId);
      navigation.goBack();
    } catch (err) {
      console.error('Failed to switch festival', err);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pick your festival</Text>
        <View style={{ width: 22 }} />
      </View>

      {events === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.orange} />
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <CalendarDays size={32} color={colors.muted} />
          <Text style={styles.emptyText}>No active festivals yet — ask your admin to activate one.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {events.map(event => {
            const selected = event.id === currentId;
            return (
              <TouchableOpacity
                key={event.id}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => handlePick(event.id)}
                disabled={switching === event.id}
              >
                <Text style={styles.emoji}>{event.emoji || '🪔'}</Text>
                <Text style={styles.rowLabel} numberOfLines={1}>{event.name} {event.year}</Text>
                {switching === event.id ? (
                  <ActivityIndicator size="small" color={colors.orange} />
                ) : selected ? (
                  <Check size={18} color={colors.orange} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  emoji: { fontSize: 20 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
});
