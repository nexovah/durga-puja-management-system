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
import { useAuth, UserPermissions } from '../lib/auth';
import { getCommitteeInfo, CommitteeInfo, getActiveEvent, ActiveEventInfo } from '../lib/db';
import { colors, radius } from '../theme';
import { SearchBar } from '../components/SearchBar';

interface MenuItem {
  icon: any;
  label: string;
  onPress: (navigation: any) => void;
  // Matches web's Sidebar.tsx gating — omitted means always shown
  // (e.g. Support/About items, which web doesn't gate either).
  show?: (p: Partial<UserPermissions>) => boolean;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const SECTIONS: MenuSection[] = [
  {
    label: 'Main Menu',
    items: [
      { icon: Wallet, label: 'Collection', onPress: nav => nav.navigate('ChandaList'), show: p => !!p.chanda },
      { icon: HeartHandshake, label: 'Donations', onPress: nav => nav.navigate('DonationList'), show: p => !!(p.donation ?? p.donationAds) },
      { icon: Megaphone, label: 'Sponsorship', onPress: nav => nav.navigate('AdsList'), show: p => !!(p.ads ?? p.donationAds) },
      { icon: Receipt, label: 'Expenses', onPress: nav => nav.navigate('ExpensesList'), show: p => !!p.expenses },
      { icon: Store, label: 'Vendors', onPress: nav => nav.navigate('VendorList'), show: p => !!p.vendors },
      { icon: Users, label: 'Members', onPress: nav => nav.navigate('MembersList'), show: p => !!p.members },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { icon: HandCoins, label: 'Loans', onPress: nav => nav.navigate('LoanList'), show: p => !!p.loans },
    ],
  },
  {
    label: 'Essential',
    items: [
      { icon: CheckSquare, label: 'Tasks', onPress: nav => nav.navigate('TaskList'), show: p => !!p.tasks },
      { icon: FileText, label: 'Estimations', onPress: nav => nav.navigate('EstimationList'), show: p => !!p.estimation },
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
  const [activeEvent, setActiveEvent] = useState<ActiveEventInfo | null>(null);

  const load = useCallback(async () => setCommittee(await getCommitteeInfo()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Read-only, refetched on focus — switching only ever happens on web.
  useFocusEffect(useCallback(() => { if (user?.tenantId) getActiveEvent(user.tenantId).then(setActiveEvent).catch(() => {}); }, [user?.tenantId]));

  const committeeName = committee?.association || committee?.name || '';
  const isCommitteeLogoUrl = !!committee?.logo && /^https?:\/\//.test(committee.logo);
  const isProfileLogoUrl = isCommitteeLogoUrl; // profile avatar reuses the same committee logo, as on ProfileScreen

  const query = search.trim().toLowerCase();
  const permissions = user?.permissions || {};
  const filteredSections = useMemo(() => {
    return SECTIONS
      .map(section => ({
        ...section,
        items: section.items.filter(i => (!i.show || i.show(permissions)) && (!query || i.label.toLowerCase().includes(query))),
      }))
      .filter(section => section.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user]);

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

      {activeEvent && (
        <View style={styles.eventBanner}>
          <Text style={styles.eventBannerText} numberOfLines={1}>
            {activeEvent.emoji || '🪔'} {activeEvent.name} {activeEvent.year}
          </Text>
        </View>
      )}

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
  committeeLogo: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#d6d3d1' },
  committeeInitial: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d6d3d1' },
  committeeInitialText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  committeeName: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.ink },
  profileAvatarImage: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#d6d3d1' },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d6d3d1' },
  profileAvatarText: { fontSize: 14, fontWeight: '800', color: colors.orange },
  eventBanner: { marginHorizontal: 20, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.orangeSoft, alignSelf: 'flex-start' },
  eventBannerText: { fontSize: 13, fontWeight: '700', color: colors.orange },
  list: { padding: 20, paddingTop: 8, gap: 20 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', color: colors.mutedLight, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2, paddingLeft: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#f4f1ec', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  empty: { fontSize: 13, color: colors.mutedLight, textAlign: 'center', paddingVertical: 24 },
});
