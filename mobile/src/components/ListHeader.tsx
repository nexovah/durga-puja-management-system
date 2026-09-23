import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, BarChart3 } from 'lucide-react-native';
import { colors } from '../theme';

interface ListHeaderProps {
  title: string;
  onBack: () => void;
  showStats?: boolean;
  onToggleStats?: () => void;
}

// Shared header for every module's list screen: back arrow, title, and an
// optional stats-toggle button (the "widgets you can close" the user asked
// for) — same real stroke icons as the web app (lucide), no emoji.
export function ListHeader({ title, onBack, showStats, onToggleStats }: ListHeaderProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onBack} hitSlop={10}>
        <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      {onToggleStats && (
        <TouchableOpacity
          onPress={onToggleStats}
          style={[styles.toggle, { backgroundColor: showStats ? colors.orangeSoft : colors.dark }]}
          hitSlop={8}
        >
          <BarChart3 size={16} color={showStats ? colors.orange : '#ffffff'} strokeWidth={2.2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  toggle: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
