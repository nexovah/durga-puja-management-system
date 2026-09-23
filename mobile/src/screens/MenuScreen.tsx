// App menu opened from Home's top-right icon. Redesigned with a header
// (close + committee identity + profile avatar), a live search filter, and
// grouped sections — same existing item targets, plus a new Support/About
// group. Visual treatment (icon chip + label rows) matches the original.
import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, Wallet, Users, HeartHandshake, Megaphone, Receipt, Store, HandCoins, CheckSquare, FileText,
  Info, LifeBuoy, Shield, RotateCcw,
} from 'lucide-react-native';
import { useAuth } from '../lib/auth';
import { getCommitteeInfo, CommitteeInfo } from '../lib/db';
import { colors, radius } from '../theme';
import { SearchBar } from '../components/SearchBar';

interface MenuItem {
  icon: any;
  label: string;
  onPress: (navigation: any) => void;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const SECTIONS: MenuSection[] = [
  {
    label: 'Main Menu',
    items: [
      { icon: Wallet, label: 'Chanda', onPress: nav => nav.navigate('ChandaList') },
      { icon: HeartHandshake, label: 'Donations', onPress: nav => nav.navigate('DonationList') },
      { icon: Megaphone, label: 'Ads', onPress: nav => nav.navigate('AdsList') },
      { icon: Receipt, label: 'Expenses', onPress: nav => nav.navigate('ExpensesList') },
      { icon: Store, label: 'Vendors', onPress: nav => nav.navigate('VendorList') },
      { icon: Users, label: 'Members', onPress: nav => nav.navigate('MembersList') },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { icon: HandCoins, label: 'Loans', onPress: nav => nav.navigate('LoanList') },
    ],
  },
  {
    label: 'Essential',
    items: [
      { icon: CheckSquare, label: 'Tasks', onPress: nav => nav.navigate('TaskList') },
      { icon: FileText, label: 'Estimations', onPress: nav => nav.navigate('EstimationList') },
    ],
  },
  {
    label: 'Support',
    items: [
      { icon: Info, label: 'About', onPress: nav => nav.navigate('LegalContent', { slug: 'about', title: 'About' }) },
      { icon: LifeBuoy, label: 'Help & Support', onPress: nav => nav.navigate('HelpSupport') },
      { icon: FileText, label: 'Terms & Conditions', onPress: nav => nav.navigate('LegalContent', { slug: 'terms', title: 'Terms & Conditions' }) },
      { icon: Shield, label: 'Privacy Policy', onPress: nav => nav.navigate('LegalContent', { slug: 'privacy', title: 'Privacy Policy' }) },
      { icon: RotateCcw, label: 'Refund Policy', onPress: nav => nav.navigate('LegalContent', { slug: 'refund', title: 'Refund Policy' }) },
    ],
  },
];

export function MenuScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [committee, setCommittee] = useState<CommitteeInfo | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => setCommittee(await getCommitteeInfo()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const committeeName = committee?.association || committee?.name || '';
  const isCommitteeLogoUrl = !!committee?.logo && /^https?:\/\//.test(committee.logo);
  const isProfileLogoUrl = isCommitteeLogoUrl; // profile avatar reuses the same committee logo, as on ProfileScreen

  const query = search.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    if (!query) return SECTIONS;
    return SECTIONS
      .map(section => ({ ...section, items: section.items.filter(i => i.label.toLowerCase().includes(query)) }))
      .filter(section => section.items.length > 0);
  }, [query]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <X size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.identity}>
          {isCommitteeLogoUrl ? (
            <Image source={{ uri: committee!.logo }} style={styles.committeeLogo} />
          ) : (
            <View style={styles.committeeInitial}>
              <Text style={styles.committeeInitialText}>{(committeeName || 'C').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.committeeName} numberOfLines={1}>{committeeName || 'Your Committee'}</Text>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Profile')} hitSlop={6}>
          {isProfileLogoUrl ? (
            <Image source={{ uri: committee!.logo }} style={styles.profileAvatarImage} />
          ) : (
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{(committeeName || user?.name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search menu…" />

      <ScrollView contentContainerStyle={styles.list}>
        {filteredSections.map(section => (
          <View key={section.label} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            {section.items.map(item => (
              <TouchableOpacity key={item.label} style={styles.row} onPress={() => item.onPress(navigation)} activeOpacity={0.7}>
                <View style={styles.iconBox}>
                  <item.icon size={18} color={colors.inkSoft} strokeWidth={2} />
                </View>
                <Text style={styles.rowLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        {filteredSections.length === 0 && <Text style={styles.empty}>No menu items match "{search}".</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  committeeLogo: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
  committeeInitial: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  committeeInitialText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  committeeName: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.ink },
  profileAvatarImage: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { fontSize: 14, fontWeight: '800', color: colors.orange },
  list: { padding: 20, paddingTop: 8, gap: 20 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', color: colors.mutedLight, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2, paddingLeft: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#f4f1ec', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  empty: { fontSize: 13, color: colors.mutedLight, textAlign: 'center', paddingVertical: 24 },
});
