import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { BottomSheet } from './BottomSheet';

interface SheetMultiSelectProps {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  emptyOptionsText?: string;
}

// Multi-select variant of SheetSelect — a tappable field showing a summary
// of the current picks, opening a bottom sheet with a checkable chip grid
// and a Done button, instead of a long inline chip row eating page space
// (e.g. Task's "Assigned Members", which can have many options).
export function SheetMultiSelect({ label, values, onChange, options, emptyOptionsText }: SheetMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };

  const summary = values.length === 0
    ? 'Select…'
    : options.filter(o => values.includes(o.value)).map(o => o.label).join(', ');

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText} numberOfLines={1}>{summary}</Text>
        <ChevronDown size={18} color={colors.muted} strokeWidth={2.2} />
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>{label}</Text>
        {options.length === 0 ? (
          <Text style={styles.emptyText}>{emptyOptionsText || 'No options yet.'}</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.chipRow} showsVerticalScrollIndicator={false}>
            {options.map(opt => {
              const active = values.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => toggle(opt.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  {active && <Check size={13} color="#ffffff" strokeWidth={2.6} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <TouchableOpacity style={styles.doneButton} onPress={() => setOpen(false)}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
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
    gap: 10,
  },
  triggerText: { flex: 1, fontSize: 14, color: colors.ink, fontWeight: '600' },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 14 },
  emptyText: { fontSize: 12.5, color: colors.mutedLight, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
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
  doneButton: {
    marginTop: 14, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.dark,
  },
  doneButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
