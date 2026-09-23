import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, LogOut, User as UserIcon } from 'lucide-react-native';
import { useAuth } from '../lib/auth';
import { getCommitteeInfo, CommitteeInfo } from '../lib/db';
import { colors, radius } from '../theme';

export function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [committee, setCommittee] = useState<CommitteeInfo | null>(null);

  const load = useCallback(async () => setCommittee(await getCommitteeInfo()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLogout = () => {
    Alert.alert('Log out', 'Log out of Durga CRM?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <UserIcon size={30} color={colors.orange} strokeWidth={2} />
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.username}>@{user?.username || ''}</Text>
        </View>

        <View style={styles.card}>
          <Row label="Role" value={user?.isAdmin ? 'Administrator' : 'Member'} />
          <Row label="Committee" value={committee?.association || committee?.name} />
          <Row label="Email" value={committee?.email} />
          <Row label="Phone" value={committee?.mobile1 || committee?.phone} />
          <Row label="Address" value={committee?.address} />
          {!committee && <ActivityIndicator color={colors.orange} style={{ marginTop: 8 }} />}
        </View>
        <Text style={styles.hint}>These details are managed from Settings and cannot be edited here.</Text>
      </ScrollView>

      <View style={[styles.logoutBar, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.8}>
          <LogOut size={18} color={colors.orange} strokeWidth={2.2} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  content: { padding: 20, paddingBottom: 12, gap: 16 },
  avatarWrap: { alignItems: 'center', gap: 4, marginTop: 8 },
  avatar: { width: 68, height: 68, borderRadius: radius.pill, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink },
  username: { fontSize: 13, color: colors.mutedLight },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowLabel: { fontSize: 12.5, color: colors.mutedLight, fontWeight: '600', width: 84 },
  rowValue: { flex: 1, fontSize: 13.5, color: colors.ink, fontWeight: '700', textAlign: 'left' },
  hint: { fontSize: 11.5, color: colors.mutedLight, textAlign: 'center', paddingHorizontal: 8 },
  logoutBar: { backgroundColor: colors.card, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.orangeSoft, paddingVertical: 14, borderRadius: radius.md },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.orange },
});
