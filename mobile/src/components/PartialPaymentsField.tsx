import { useState } from 'react';
import { Platform, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Plus, X, Calendar } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { BottomSheet } from './BottomSheet';

export interface PartialPaymentRow {
  amount: string;
  voucherNumber: string;
  date: string;
}

interface PartialPaymentsFieldProps {
  rows: PartialPaymentRow[];
  onChange: (rows: PartialPaymentRow[]) => void;
  totalAmount: number;
}

// Ports the web app's partial-payments UX (src/app/components/Expenses.tsx,
// ~line 570-635): a list of amount/voucher/date rows with per-row remove
// and an "Add partial payment" button, instead of a single amount field.
export function PartialPaymentsField({ rows, onChange, totalAmount }: PartialPaymentsFieldProps) {
  const [dateSheetIndex, setDateSheetIndex] = useState<number | null>(null);

  const updateRow = (index: number, patch: Partial<PartialPaymentRow>) => {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const addRow = () => onChange([...rows, { amount: '', voucherNumber: '', date: '' }]);

  const sum = rows.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const openDateSheet = (index: number) => {
    const row = rows[index];
    setTempDate(row.date ? new Date(row.date) : new Date());
    setDateSheetIndex(index);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Partial Payments</Text>

      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          <TextInput
            value={row.amount}
            onChangeText={v => updateRow(index, { amount: v })}
            placeholder="Amount"
            placeholderTextColor={colors.mutedLight}
            keyboardType="numeric"
            style={[styles.input, styles.amountInput]}
          />
          <TextInput
            value={row.voucherNumber}
            onChangeText={v => updateRow(index, { voucherNumber: v })}
            placeholder="Voucher Number"
            placeholderTextColor={colors.mutedLight}
            style={[styles.input, styles.voucherInput]}
          />
          <TouchableOpacity style={styles.dateButton} onPress={() => openDateSheet(index)}>
            <Calendar size={15} color={colors.inkSoft} strokeWidth={2.2} />
            <Text style={styles.dateButtonText} numberOfLines={1}>{row.date || 'Date'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeButton} onPress={() => removeRow(index)} hitSlop={8}>
            <X size={16} color={colors.muted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={addRow}>
        <Plus size={16} color={colors.orange} strokeWidth={2.4} />
        <Text style={styles.addButtonText}>Add partial payment</Text>
      </TouchableOpacity>

      {rows.length > 0 && (
        <Text style={[styles.sumText, sum >= totalAmount && totalAmount > 0 ? styles.sumOk : styles.sumWarn]}>
          ₹{sum.toLocaleString('en-IN')} / ₹{totalAmount.toLocaleString('en-IN')}
        </Text>
      )}

      <BottomSheet visible={dateSheetIndex !== null} onClose={() => setDateSheetIndex(null)}>
        <Text style={styles.sheetTitle}>Select Date</Text>
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          themeVariant="light"
          accentColor={colors.orange}
          onChange={(_event, selectedDate) => {
            if (!selectedDate) {
              if (Platform.OS === 'android') setDateSheetIndex(null);
              return;
            }
            if (Platform.OS === 'android') {
              // Android's calendar display fires onChange once and dismisses itself.
              if (dateSheetIndex !== null) {
                updateRow(dateSheetIndex, { date: selectedDate.toISOString().split('T')[0] });
              }
              setDateSheetIndex(null);
            } else {
              // iOS inline picker: just track the tapped value here, commit on Done.
              setTempDate(selectedDate);
            }
          }}
        />
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => {
              if (dateSheetIndex !== null) {
                updateRow(dateSheetIndex, { date: tempDate.toISOString().split('T')[0] });
              }
              setDateSheetIndex(null);
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
  field: { gap: 10 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  amountInput: { width: 92 },
  voucherInput: { flex: 1, minWidth: 90 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    maxWidth: 100,
  },
  dateButtonText: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  removeButton: { padding: 4 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  addButtonText: { fontSize: 13, fontWeight: '700', color: colors.orange },
  sumText: { fontSize: 12.5, fontWeight: '700' },
  sumOk: { color: colors.green },
  sumWarn: { color: colors.amber },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  doneButton: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  doneButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
