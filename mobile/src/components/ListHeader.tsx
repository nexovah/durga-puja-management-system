import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, BarChart3, Search } from 'lucide-react-native';
import { colors } from '../theme';

interface ListHeaderProps {
  title: string;
  onBack: () => void;
  showStats?: boolean;
  onToggleStats?: () => void;
  showSearch?: boolean;
  onToggleSearch?: () => void;
}

// Shared header for every module's list screen: back arrow, title, and
// borderless icon toggles (stats widgets, search bar) — orange when the
// section is showing, gray when hidden. Same real stroke icons as the web
// app (lucide), no emoji, no background chip on the icon itself.
export function ListHeader({ title, onBack, showStats, onToggleStats, showSearch, onToggleSearch }: ListHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: Math.max(insets.top + 14, 24) }]}>
      <TouchableOpacity onPress={onBack} hitSlop={10}>
        <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      {onToggleSearch && (
        <TouchableOpacity onPress={onToggleSearch} hitSlop={10}>
          <Search size={20} color={showSearch ? colors.orange : '#d6d3d1'} strokeWidth={2.2} />
        </TouchableOpacity>
      )}
      {onToggleStats && (
        <TouchableOpacity onPress={onToggleStats} hitSlop={10}>
          <BarChart3 size={20} color={showStats ? colors.orange : '#d6d3d1'} strokeWidth={2.2} />
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
    gap: 16,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
});
