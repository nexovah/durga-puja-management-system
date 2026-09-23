import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { listLoans, createLoan, updateLoan, Loan } from '../lib/loans';
import { PaidMethod, logActivity, diffFields } from '../lib/db';
import { colors, radius } from '../theme';
import { TextField, ChipSelect } from '../components/FormField';
import { DateField } from '../components/DateField';
import { PinConfirmSheet } from '../components/PinConfirmSheet';
import { useKeyboardVisible } from '../components/KeyboardDoneBar';
import { useAuth } from '../lib/auth';
import { todayISO, formatAmount } from '../lib/labels';

const PAID_METHOD_OPTIONS: { value: PaidMethod; label: string }[] = [
  { value: 'notSelected', label: 'Not Selected' },
  { value: 'cash', label: 'Cash' },
  { value: 'qrScan', label: 'QR Scan' },
  { value: 'onlineBanking', label: 'Online Banking' },
  { value: 'check', label: 'Check' },
];

const emptyForm = {
  donorName: '', amountReceived: '', amountPaid: '', phone: '',
  paymentMethod: 'notSelected' as PaidMethod, date: todayISO(), returnDate: '', remarks: '',
};

const LOAN_FIELD_LABELS: Record<string, string> = {
  donorName: "Lender's Name", amountReceived: 'Amount Received', amountPaid: 'Amount Repaid',
  phone: 'Phone Number', paymentMethod: 'Paid Method', date: 'Date', returnDate: 'Return Date',
  remarks: 'Remarks',
};

export function LoanFormScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const keyboardVisible = useKeyboardVisible();
  const { mode, id } = route.params || { mode: 'add' };
  const isEdit = mode === 'edit' && !!id;

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [original, setOriginal] = useState<Loan | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const all = await listLoans();
      const existing = all.find(l => l.id === id);
      if (existing) {
        setOriginal(existing);
        setForm({
          donorName: existing.donorName,
          amountReceived: String(existing.amountReceived),
          amountPaid: String(existing.amountPaid || 0),
          phone: existing.phone,
          paymentMethod: existing.paymentMethod,
          date: existing.date,
          returnDate: existing.returnDate || '',
          remarks: existing.remarks,
        });
      }
      setLoading(false);
    })();
  }, [isEdit, id]);

  const handleSaveButtonPress = () => {
    setError('');
    if (!form.donorName.trim() || !form.amountReceived.trim()) {
      setError('Lender name and amount received are required.');
      return;
    }
    if (isEdit) {
      setPinSheetOpen(true);
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    const payload: Omit<Loan, 'id'> = {
      donorName: form.donorName.trim(),
      amountReceived: parseFloat(form.amountReceived) || 0,
      amountPaid: parseFloat(form.amountPaid) || 0,
      phone: form.phone.trim(),
      paymentMethod: form.paymentMethod,
      date: form.date,
      returnDate: form.returnDate.trim() || undefined,
      remarks: form.remarks.trim(),
    };
    setSaving(true);
    try {
      if (isEdit) await updateLoan(id, payload);
      else await createLoan(payload);
      if (user) {
        logActivity({
          userId: user.id,
          username: user.username,
          userName: user.name,
          action: isEdit ? 'update' : 'create',
          module: 'loans',
          summary: `${payload.donorName} — ${formatAmount(payload.amountReceived)}`,
          device: Platform.OS === 'ios' ? 'ios' : 'android',
          changes: isEdit ? diffFields(original as any, payload as any, LOAN_FIELD_LABELS) : undefined,
        }).catch(() => {});
      }
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Edit Loan' : 'Add Loan'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Lender's Name" required value={form.donorName} onChangeText={v => setForm({ ...form, donorName: v })} placeholder="Lender's name" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="Amount Received (₹)" required value={form.amountReceived} onChangeText={v => setForm({ ...form, amountReceived: v })} placeholder="0" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Amount Repaid (₹)" value={form.amountPaid} onChangeText={v => setForm({ ...form, amountPaid: v })} placeholder="0" keyboardType="numeric" />
          </View>
        </View>
        <TextField label="Phone Number" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} placeholder="10-digit phone" keyboardType="phone-pad" />
        <ChipSelect label="Paid Method" value={form.paymentMethod} onChange={v => setForm({ ...form, paymentMethod: v as PaidMethod })} options={PAID_METHOD_OPTIONS} />
        <DateField label="Date" required value={form.date} onChange={v => setForm({ ...form, date: v })} />
        <DateField label="Return Date" value={form.returnDate} onChange={v => setForm({ ...form, returnDate: v })} />
        <TextField label="Remarks" value={form.remarks} onChangeText={v => setForm({ ...form, remarks: v })} placeholder="Optional notes" multiline />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSaveButtonPress} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update Loan' : 'Save Loan'}</Text>}
        </TouchableOpacity>
      </View>

      <PinConfirmSheet
        visible={pinSheetOpen}
        itemLabel={form.donorName}
        onCancel={() => setPinSheetOpen(false)}
        onConfirm={() => { setPinSheetOpen(false); doSave(); }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  form: { padding: 20, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  error: { fontSize: 12.5, color: colors.red },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 22, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: '#f4f1ec' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  saveButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.dark },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
