// Help & Support ticket list — read-only list of the current user's own
// tickets (RLS already scopes to user_id, see supabase/059_support_tickets
// .sql), with a persistent "Post a New Query" entry point regardless of
// whether tickets already exist.
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, LifeBuoy, Plus } from 'lucide-react-native';
import { listMyTickets, SupportTicket, TicketStatus } from '../lib/support';
import { colors, radius } from '../theme';
import { formatDate } from '../lib/labels';
import { BottomSheet } from '../components/BottomSheet';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const TICKET_STATUS_COLORS: Record<TicketStatus, { bg: string; text: string }> = {
  open: { bg: colors.amberBg, text: colors.amberText },
  in_progress: { bg: colors.indigoBg, text: colors.indigoText },
  resolved: { bg: colors.greenBg, text: colors.greenText },
};

export function HelpSupportScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const load = useCallback(async () => setTickets(await listMyTickets()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
      </View>

      {tickets === null ? (
        <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>
      ) : tickets.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <LifeBuoy size={28} color={colors.orange} strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>You haven't submitted any support requests yet</Text>
          <Text style={styles.emptySubtitle}>Have a question or ran into an issue? Post a new query and we'll get back to you.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {tickets.map(t => {
            const colorSet = TICKET_STATUS_COLORS[t.status];
            return (
              <TouchableOpacity key={t.id} style={styles.card} activeOpacity={0.7} onPress={() => setSelected(t)}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardCode}>{t.ticketCode}</Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colorSet.bg }]}>
                    <Text style={[styles.badgeText, { color: colorSet.text }]}>{STATUS_LABEL[t.status]}</Text>
                  </View>
                </View>
                <Text style={styles.cardBody} numberOfLines={2}>{t.body}</Text>
                <Text style={styles.cardDate}>{formatDate(t.createdAt)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('HelpSupportForm')}
          style={styles.newButton}
          activeOpacity={0.85}
        >
          <Plus size={18} color="#ffffff" strokeWidth={2.4} />
          <Text style={styles.newButtonText}>Post a New Query</Text>
        </TouchableOpacity>
      </View>

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <View style={styles.detail}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardCode}>{selected.ticketCode}</Text>
                <Text style={styles.detailTitle}>{selected.title}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: TICKET_STATUS_COLORS[selected.status].bg }]}>
                <Text style={[styles.badgeText, { color: TICKET_STATUS_COLORS[selected.status].text }]}>
                  {STATUS_LABEL[selected.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.detailDate}>Submitted {formatDate(selected.createdAt)}</Text>
            <Text style={styles.detailBody}>{selected.body}</Text>
            {selected.imageUrl && (
              <Image source={{ uri: selected.imageUrl }} style={styles.detailImage} resizeMode="cover" />
            )}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: colors.mutedLight, textAlign: 'center', lineHeight: 19 },
  list: { padding: 20, gap: 10, paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardCode: { fontSize: 10.5, fontWeight: '700', color: colors.orange, letterSpacing: 0.3, marginBottom: 3 },
  cardTitle: { fontSize: 14.5, fontWeight: '800', color: colors.ink },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  cardBody: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
  cardDate: { fontSize: 11, color: colors.mutedLight, marginTop: 2 },
  footer: { backgroundColor: colors.card, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  newButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.dark, paddingVertical: 14, borderRadius: radius.md },
  newButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  detail: { gap: 10, paddingBottom: 10 },
  detailTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 1, lineHeight: 21 },
  detailDate: { fontSize: 11.5, color: colors.mutedLight },
  detailBody: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 20 },
  detailImage: { width: '100%', height: 220, borderRadius: radius.lg, marginTop: 4, backgroundColor: colors.border },
});
