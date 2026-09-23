// Lightweight app menu opened from Home's top-right icon. Replaces the old
// behavior where that icon led straight to a logout confirm — logout now
// lives in ProfileScreen instead.
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, User, Wallet, Users, Gift, Receipt, Store, HandCoins, CheckSquare, FileText } from 'lucide-react-native';
import { colors, radius } from '../theme';

export function MenuScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const items: { icon: any; label: string; onPress: () => void }[] = [
    { icon: User, label: 'Profile', onPress: () => navigation.navigate('Profile') },
    { icon: Wallet, label: 'Chanda', onPress: () => navigation.navigate('ChandaList') },
    { icon: Users, label: 'Members', onPress: () => navigation.navigate('MembersList') },
    { icon: Gift, label: 'Donations', onPress: () => navigation.navigate('DonationList') },
    { icon: Gift, label: 'Ads', onPress: () => navigation.navigate('AdsList') },
    { icon: Receipt, label: 'Expenses', onPress: () => navigation.navigate('ExpensesList') },
    { icon: Store, label: 'Vendors', onPress: () => navigation.navigate('VendorList') },
    { icon: HandCoins, label: 'Loans', onPress: () => navigation.navigate('LoanList') },
    { icon: CheckSquare, label: 'Tasks', onPress: () => navigation.navigate('TaskList') },
    { icon: FileText, label: 'Estimations', onPress: () => navigation.navigate('EstimationList') },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>Menu</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {items.map(item => (
          <TouchableOpacity key={item.label} style={styles.row} onPress={item.onPress} activeOpacity={0.7}>
            <View style={styles.iconBox}>
              <item.icon size={18} color={colors.inkSoft} strokeWidth={2} />
            </View>
            <Text style={styles.rowLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  list: { padding: 20, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#f4f1ec', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
