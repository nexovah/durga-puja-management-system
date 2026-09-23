import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { BottomSheet } from './BottomSheet';

interface SheetSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}

// A tappable field that opens a bottom sheet with a chip grid — used for
// single-choice fields with too many options to render inline (e.g.
// Expense Category's 19 options), so the page doesn't get eaten by a
// giant wrapped chip grid.
export function SheetSelect({ label, value, onChange, options, required }: SheetSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>{selected?.label || 'Select…'}</Text>
        <ChevronDown size={18} color={colors.muted} strokeWidth={2.2} />
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>{label}</Text>
        <ScrollView contentContainerStyle={styles.chipRow} showsVerticalScrollIndicator={false}>
          {options.map(opt => {
            const active = opt.value === value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => { onChange(opt.value); setOpen(false); }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  trigger: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
  },
  chipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.inkSoft },
  chipTextActive: { color: '#ffffff' },
});
