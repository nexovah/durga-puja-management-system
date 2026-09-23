// Reports hub — tile grid of the 8 report modules, matching Home's
// "Quick add" tile pattern. View + export only, nothing to add/edit/delete.
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Wallet, Users, Gift, Receipt, Store, HandCoins, FileText } from 'lucide-react-native';
import { colors, radius } from '../theme';

const MODULES: { key: string; label: string; icon: any; color: string; bg: string }[] = [
  { key: 'chanda', label: 'Chanda', icon: Wallet, color: colors.orange, bg: colors.orangeSoft },
  { key: 'donation', label: 'Donation', icon: Gift, color: colors.green, bg: colors.greenBg },
  { key: 'ads', label: 'Ads', icon: Gift, color: colors.green, bg: colors.greenBg },
  { key: 'expenses', label: 'Expenses', icon: Receipt, color: colors.red, bg: colors.redBg },
  { key: 'vendor', label: 'Vendor', icon: Store, color: colors.indigo, bg: colors.indigoBg },
  { key: 'member', label: 'Members', icon: Users, color: colors.indigo, bg: colors.indigoBg },
  { key: 'loan', label: 'Loans', icon: HandCoins, color: colors.amber, bg: colors.amberBg },
  { key: 'estimation', label: 'Estimation', icon: FileText, color: colors.orange, bg: colors.orangeSoft },
];

export function ReportsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>Reports</Text>
        <View style={{ width: 20 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.hint}>View activity and download reports for any module.</Text>
        <View style={styles.grid}>
          {MODULES.map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => navigation.navigate('ReportDetail', { module: m.key })}
              style={styles.tile}
              activeOpacity={0.7}
            >
              <View style={[styles.tileIcon, { backgroundColor: m.bg }]}>
                <m.icon size={22} color={m.color} strokeWidth={2} />
              </View>
              <Text style={styles.tileLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  hint: { fontSize: 12.5, color: colors.mutedLight, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: { width: '30%', alignItems: 'center', gap: 8, marginBottom: 6 },
  tileIcon: { width: 58, height: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
});
