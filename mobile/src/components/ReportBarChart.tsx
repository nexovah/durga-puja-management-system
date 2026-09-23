import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export interface BarChartPoint {
  label: string;
  value: number;
}

// Plain-View bar chart — same technique as Home's Activity widget (no
// charting library, since none is installed and a handful of bars doesn't
// warrant one). Single-series version of Home's income/expense bar pair.
export function ReportBarChart({ points, tint = colors.orange }: { points: BarChartPoint[]; tint?: string }) {
  const max = Math.max(1, ...points.map(p => p.value));
  return (
    <View style={styles.card}>
      <View style={styles.barsRow}>
        {points.map((p, i) => (
          <View key={i} style={styles.barCol}>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: `${Math.max(4, (p.value / max) * 100)}%`, backgroundColor: tint }]} />
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>{p.label}</Text>
          </View>
        ))}
        {points.length === 0 && <Text style={styles.empty}>No data for this range.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110 },
  barCol: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 14, borderRadius: 5, minHeight: 4 },
  barLabel: { fontSize: 9, color: colors.mutedLight, fontWeight: '600' },
  empty: { fontSize: 13, color: colors.mutedLight, textAlign: 'center', paddingVertical: 20 },
});
