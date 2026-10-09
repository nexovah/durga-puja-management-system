import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Phone, Pencil } from 'lucide-react-native';
import { listChanda, Chanda, getChandaCreditAmount } from '../lib/db';
import { colors, radius } from '../theme';
import { formatAmount, formatDate, formatCamelLabel, PAID_METHOD_LABEL, PAYMENT_STATUS_LABEL, STATUS_COLORS } from '../lib/labels';

export function ChandaDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const [item, setItem] = useState<Chanda | null | undefined>(undefined);

  const load = useCallback(async () => {
    const all = await listChanda();
    setItem(all.find(c => c.id === id) || null);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (item === undefined) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const statusColors = item ? STATUS_COLORS[item.paymentStatus] : undefined;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{item?.donorName || 'Collection'}</Text>
        {item && (
          <TouchableOpacity onPress={() => navigation.navigate('ChandaForm', { mode: 'edit', id: item.id })} style={styles.editButton}>
            <Pencil size={14} color="#ffffff" strokeWidth={2.4} />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {!item ? (
        <View style={styles.loading}><Text style={styles.emptyText}>Record not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatAmount(getChandaCreditAmount(item))}</Text>

          {statusColors && (
            <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>{PAYMENT_STATUS_LABEL[item.paymentStatus]}</Text>
            </View>
          )}

          {item.phone ? (
            <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${item.phone}`)} activeOpacity={0.7}>
              <Phone size={14} color={colors.orange} strokeWidth={2.4} />
              <Text style={styles.contactText}>{item.phone}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.list}>
            <InfoRow label="Paid Method" value={PAID_METHOD_LABEL[item.paidMethod]} />
            {item.category && <InfoRow label="Category" value={formatCamelLabel(item.category)} />}
            <InfoRow label="Date" value={formatDate(item.date)} />
            {item.billNumber && <InfoRow label="Bill Number" value={item.billNumber} />}
            {!!item.numPersons && <InfoRow label="Persons" value={String(item.numPersons)} />}
            {!!item.remarks && <InfoRow label="Remarks" value={item.remarks} />}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: colors.mutedLight },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryButtonBg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  editText: { fontSize: 12.5, fontWeight: '700', color: '#ffffff' },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  amount: { fontSize: 30, fontWeight: '800', color: colors.ink },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, marginTop: -8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: colors.orangeSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
  },
  contactText: { fontSize: 13, color: colors.orange, fontWeight: '700' },
  list: { gap: 8 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
  },
  infoLabel: { fontSize: 12.5, color: colors.mutedLight, fontWeight: '600' },
  infoValue: { fontSize: 13.5, color: colors.ink, fontWeight: '700', flex: 1, textAlign: 'right' },
});
