import { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { BottomSheet } from './BottomSheet';
import { formatDate } from '../lib/labels';

interface DateFieldProps {
  label: string;
  value: string; // ISO 'YYYY-MM-DD', may be empty
  onChange: (isoDate: string) => void;
  required?: boolean;
}

// Same bottom-sheet calendar pattern as PartialPaymentsField's per-row date
// picker, generalized for every plain "Date" field across the app's forms —
// tap the field, pick from a real calendar in a bottom sheet, tap Done (iOS)
// or pick (Android), value lands back in the field once the sheet closes.
export function DateField({ label, value, onChange, required }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const openSheet = () => {
    setTempDate(value ? new Date(value) : new Date());
    setOpen(true);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TouchableOpacity style={styles.input} onPress={openSheet} activeOpacity={0.7}>
        <Calendar size={16} color={colors.mutedLight} strokeWidth={2.1} />
        <Text style={[styles.valueText, !value && styles.placeholderText]}>
          {value ? formatDate(value) : 'Select date'}
        </Text>
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>Select Date</Text>
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          themeVariant="light"
          accentColor={colors.orange}
          onValueChange={(_event, selectedDate) => {
            if (Platform.OS === 'android') {
              onChange(selectedDate.toISOString().split('T')[0]);
              setOpen(false);
            } else {
              setTempDate(selectedDate);
            }
          }}
          onDismiss={() => { if (Platform.OS === 'android') setOpen(false); }}
        />
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => {
              onChange(tempDate.toISOString().split('T')[0]);
              setOpen(false);
            }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: '100%', paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  valueText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  placeholderText: { color: colors.mutedLight, fontWeight: '400' },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  doneButton: {
    marginTop: 10, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.dark,
  },
  doneButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
