import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radius } from '../theme';

interface ListRowProps {
  initial: string;
  avatarBg: string;
  avatarColor: string;
  title: string;
  subtitle: string;
  amount: string;
  amountColor?: string;
  badgeLabel?: string;
  badgeBg?: string;
  badgeColor?: string;
  onPress: () => void;
}

export function ListRow({ initial, avatarBg, avatarColor, title, subtitle, amount, amountColor, badgeLabel, badgeBg, badgeColor, onPress }: ListRowProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={[styles.avatarText, { color: avatarColor }]}>{initial}</Text>
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: amountColor || colors.ink }]}>{amount}</Text>
        {badgeLabel && (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
          </View>
        )}
      </View>
      <ChevronRight size={16} color="#d6d3d1" strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 14 },
  middle: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 12, color: colors.mutedLight, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 5 },
  amount: { fontSize: 14, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
