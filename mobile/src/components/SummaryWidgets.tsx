import { View, Text, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors, radius } from '../theme';

export interface Widget {
  label: string;
  value: string;
  icon: LucideIcon;
  tint: 'neutral' | 'green' | 'amber';
}

const TINTS: Record<Widget['tint'], { bg: string; border: string; iconBg: string; iconColor: string; valueColor: string }> = {
  neutral: { bg: colors.card, border: colors.border, iconBg: '#f4f1ec', iconColor: colors.inkSoft, valueColor: colors.ink },
  green: { bg: colors.greenBg, border: colors.greenBorder, iconBg: colors.card, iconColor: colors.green, valueColor: colors.greenText },
  amber: { bg: colors.amberBg, border: colors.amberBorder, iconBg: colors.card, iconColor: colors.amber, valueColor: colors.amberText },
};

// The 3 collapsible "widgets like dashboard" shown at the top of every
// module's list screen — real numbers computed from the live list, not
// static mockup values.
export function SummaryWidgets({ widgets }: { widgets: Widget[] }) {
  return (
    <View style={styles.row}>
      {widgets.map((w, i) => {
        const t = TINTS[w.tint];
        const Icon = w.icon;
        return (
          <View key={i} style={[styles.card, { backgroundColor: t.bg, borderColor: t.border }]}>
            <View style={[styles.iconBox, { backgroundColor: t.iconBg }]}>
              <Icon size={14} color={t.iconColor} strokeWidth={2.1} />
            </View>
            <Text style={[styles.value, { color: t.valueColor }]} numberOfLines={1}>{w.value}</Text>
            <Text style={[styles.label, { color: t.iconColor }]} numberOfLines={1}>{w.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 14 },
  card: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: 13 },
  iconBox: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  value: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 9.5, fontWeight: '600', marginTop: 1 },
});
