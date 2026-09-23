import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Phone } from 'lucide-react-native';
import { listExpenses, vendorGroupsFromExpenses, VendorGroup, Expense, getExpenseCreditAmount } from '../lib/db';
import { colors, radius } from '../theme';
import { formatAmount, formatDate, formatCamelLabel } from '../lib/labels';

interface PaymentRow {
  id: string;
  date: string;
  title: string;
  category: string;
  voucherNumber: string;
  amount: number;
}

// Partial-payment expenses store each installment's amount/date separately —
// split those into one row per installment instead of one row per expense,
// same as web's paymentRowsFor() (src/app/components/Vendors.tsx ~line 41).
function paymentRowsFor(entries: Expense[]): PaymentRow[] {
  const rows: PaymentRow[] = [];
  for (const exp of entries) {
    const partials = exp.partialPayments || [];
    if (exp.paymentStatus === 'partial' && partials.length > 0) {
      partials.forEach((payment, i) => {
        rows.push({
          id: `${exp.id}-${i}`,
          date: payment.date || exp.date,
          title: exp.title,
          category: exp.category,
          voucherNumber: payment.voucherNumber || exp.voucherNumber || '',
          amount: payment.amount,
        });
      });
    } else {
      rows.push({
        id: exp.id,
        date: exp.date,
        title: exp.title,
        category: exp.category,
        voucherNumber: exp.voucherNumber || '',
        amount: getExpenseCreditAmount(exp),
      });
    }
  }
  return rows;
}

// Mirrors the web app's vendor detail panel (src/app/components/Vendors.tsx,
// ~line 199-269): contract total / paid / pending / transaction-count stat
// cards, category chips, and the full payment-history list for that vendor.
export function VendorDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { key } = route.params;
  const [group, setGroup] = useState<VendorGroup | null | undefined>(undefined);

  const load = useCallback(async () => {
    const expenses = await listExpenses();
    const groups = vendorGroupsFromExpenses(expenses);
    setGroup(groups.find(g => g.key === key) || null);
  }, [key]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (group === undefined) {
    return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;
  }

  const pending = group ? Math.max(0, group.totalContractAmount - group.totalAmount) : 0;
  const rows = group ? paymentRowsFor(group.entries) : [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{group?.name || 'Vendor'}</Text>
      </View>

      {!group ? (
        <View style={styles.loading}><Text style={styles.emptyText}>Vendor not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {group.contact ? (
            <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${group.contact}`)} activeOpacity={0.7}>
              <Phone size={14} color={colors.orange} strokeWidth={2.4} />
              <Text style={styles.contactText}>{group.contact}</Text>
            </TouchableOpacity>
          ) : null}

          {group.categories.length > 0 && (
            <View style={styles.chipRow}>
              {group.categories.map(cat => (
                <View key={cat} style={styles.chip}>
                  <Text style={styles.chipText}>{formatCamelLabel(cat)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Contract Total</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatAmount(group.totalContractAmount)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.greenBg, borderColor: colors.greenBorder }]}>
              <Text style={[styles.statLabel, { color: colors.greenText }]}>Paid</Text>
              <Text style={[styles.statValue, { color: colors.greenText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatAmount(group.totalAmount)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.amberBg, borderColor: colors.amberBorder }]}>
              <Text style={[styles.statLabel, { color: colors.amberText }]}>Pending</Text>
              <Text style={[styles.statValue, { color: colors.amberText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatAmount(pending)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Transactions</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{rows.length}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Payment History</Text>
          <View style={styles.list}>
            {rows.map(row => (
              <View key={row.id} style={styles.historyRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{row.title}</Text>
                  <Text style={styles.historyMeta} numberOfLines={1}>
                    {formatCamelLabel(row.category)} · {formatDate(row.date)}{row.voucherNumber ? ` · ${row.voucherNumber}` : ''}
                  </Text>
                </View>
                <Text style={styles.historyAmount}>{formatAmount(row.amount)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: colors.mutedLight },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: -6, backgroundColor: colors.orangeSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
  },
  contactText: { fontSize: 13, color: colors.orange, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.orangeSoft },
  chipText: { fontSize: 11.5, fontWeight: '700', color: colors.orange },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 6 },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.mutedLight },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  list: { gap: 8 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
  },
  historyTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  historyMeta: { fontSize: 11.5, color: colors.mutedLight, marginTop: 2 },
  historyAmount: { fontSize: 13.5, fontWeight: '800', color: colors.green },
});
