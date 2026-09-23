import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { listExpenses, createExpense, updateExpense, logActivity, diffFields, Expense, ExpensePaymentStatus, PaidThrough } from '../lib/db';
import { colors, radius } from '../theme';
import { TextField, ChipSelect } from '../components/FormField';
import { DateField } from '../components/DateField';
import { SheetSelect } from '../components/SheetSelect';
import { PartialPaymentsField, PartialPaymentRow } from '../components/PartialPaymentsField';
import { PinConfirmSheet } from '../components/PinConfirmSheet';
import { useKeyboardVisible } from '../components/KeyboardDoneBar';
import { useAuth } from '../lib/auth';
import { todayISO, formatAmount } from '../lib/labels';

const CATEGORY_OPTIONS = [
  { value: 'construction', label: 'Construction' },
  { value: 'decoration', label: 'Decoration' },
  { value: 'idol', label: 'Idol' },
  { value: 'pujaRituals', label: 'Puja Rituals' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'electricityGenerator', label: 'Electricity/Generator' },
  { value: 'soundAudio', label: 'Sound/Audio' },
  { value: 'food', label: 'Food & Bhog' },
  { value: 'culturalProgramme', label: 'Cultural Programme' },
  { value: 'publicity', label: 'Publicity' },
  { value: 'printingStationery', label: 'Printing/Stationery' },
  { value: 'security', label: 'Security' },
  { value: 'volunteerStaff', label: 'Volunteer/Staff' },
  { value: 'sanitationCleaning', label: 'Sanitation/Cleaning' },
  { value: 'medicalFirstAid', label: 'Medical/First Aid' },
  { value: 'transport', label: 'Transport & Immersion' },
  { value: 'permissionsGovtFees', label: 'Permissions/Govt Fees' },
  { value: 'insuranceSafety', label: 'Insurance/Safety' },
  { value: 'other', label: 'Other' },
];
const PAID_THROUGH_OPTIONS: { value: PaidThrough; label: string }[] = [
  { value: 'notSelected', label: 'Not Selected' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'qrPayment', label: 'QR Payment' },
  { value: 'onlineBanking', label: 'Online Banking' },
];
const STATUS_OPTIONS: { value: ExpensePaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'cancelled', label: 'Cancelled' },
];

const emptyForm = {
  title: '', amount: '', category: 'other', paymentStatus: 'paid' as ExpensePaymentStatus,
  paidThrough: 'notSelected' as PaidThrough, date: todayISO(), voucherNumber: '',
  vendorName: '', vendorContact: '', remarks: '',
};

const EXPENSE_FIELD_LABELS: Record<string, string> = {
  title: 'Title', amount: 'Amount', paymentStatus: 'Payment Status', paidThrough: 'Paid Through',
  date: 'Date', category: 'Category', voucherNumber: 'Voucher Number', vendorName: 'Vendor Name',
  vendorContact: 'Vendor Contact', remarks: 'Remarks',
};

export function ExpenseFormScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const keyboardVisible = useKeyboardVisible();
  const { mode, id } = route.params || { mode: 'add' };
  const isEdit = mode === 'edit' && !!id;

  const [form, setForm] = useState(emptyForm);
  const [partialPayments, setPartialPayments] = useState<PartialPaymentRow[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [original, setOriginal] = useState<Expense | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const all = await listExpenses();
      const existing = all.find(e => e.id === id);
      if (existing) {
        setOriginal(existing);
        setForm({
          title: existing.title, amount: String(existing.amount), category: existing.category,
          paymentStatus: existing.paymentStatus, paidThrough: existing.paidThrough, date: existing.date,
          voucherNumber: existing.voucherNumber || '', vendorName: existing.vendorName || '',
          vendorContact: existing.vendorContact || '', remarks: existing.remarks,
        });
        setPartialPayments(
          (existing.partialPayments || []).map(p => ({
            amount: String(p.amount ?? ''),
            voucherNumber: p.voucherNumber || '',
            date: p.date || '',
          }))
        );
      }
      setLoading(false);
    })();
  }, [isEdit, id]);

  const handleSaveButtonPress = () => {
    setError('');
    if (!form.title.trim() || !form.amount.trim()) {
      setError('Title and amount are required.');
      return;
    }
    if (isEdit) {
      setPinSheetOpen(true);
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    const payload: Omit<Expense, 'id'> = {
      title: form.title.trim(),
      amount: parseFloat(form.amount) || 0,
      paymentStatus: form.paymentStatus,
      partialPayments: form.paymentStatus === 'partial'
        ? partialPayments
            .filter(p => p.amount.trim() !== '' || p.voucherNumber.trim() !== '' || p.date.trim() !== '')
            .map(p => ({
              amount: parseFloat(p.amount) || 0,
              voucherNumber: p.voucherNumber.trim() || undefined,
              date: p.date.trim() || undefined,
            }))
        : undefined,
      paidThrough: form.paidThrough,
      date: form.date,
      category: form.category,
      voucherNumber: form.voucherNumber.trim() || undefined,
      vendorName: form.vendorName.trim() || undefined,
      vendorContact: form.vendorContact.trim() || undefined,
      remarks: form.remarks.trim(),
    };
    setSaving(true);
    try {
      if (isEdit) await updateExpense(id, payload);
      else await createExpense(payload);
      if (user) {
        logActivity({
          userId: user.id,
          username: user.username,
          userName: user.name,
          action: isEdit ? 'update' : 'create',
          module: 'expenses',
          summary: `${payload.title} — ${formatAmount(payload.amount)}`,
          device: Platform.OS === 'ios' ? 'ios' : 'android',
          changes: isEdit ? diffFields(original as any, payload as any, EXPENSE_FIELD_LABELS) : undefined,
          recordLabel: payload.title,
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
        <Text style={styles.title}>{isEdit ? 'Edit Expense' : 'Add Expense'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Title" required value={form.title} onChangeText={v => setForm({ ...form, title: v })} placeholder="What was this expense for?" />
        <TextField label="Amount (₹)" required value={form.amount} onChangeText={v => setForm({ ...form, amount: v })} placeholder="0" keyboardType="numeric" />
        <SheetSelect label="Category" value={form.category} onChange={v => setForm({ ...form, category: v })} options={CATEGORY_OPTIONS} />
        <ChipSelect label="Payment Status" required value={form.paymentStatus} onChange={v => setForm({ ...form, paymentStatus: v as ExpensePaymentStatus })} options={STATUS_OPTIONS} />
        {form.paymentStatus === 'partial' && (
          <PartialPaymentsField rows={partialPayments} onChange={setPartialPayments} totalAmount={parseFloat(form.amount) || 0} />
        )}
        <ChipSelect label="Paid Through" value={form.paidThrough} onChange={v => setForm({ ...form, paidThrough: v as PaidThrough })} options={PAID_THROUGH_OPTIONS} />
        <TextField label="Voucher Number" value={form.voucherNumber} onChangeText={v => setForm({ ...form, voucherNumber: v })} placeholder="Optional" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="Vendor Name" value={form.vendorName} onChangeText={v => setForm({ ...form, vendorName: v })} placeholder="Optional" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Vendor Contact" value={form.vendorContact} onChangeText={v => setForm({ ...form, vendorContact: v })} placeholder="Optional" keyboardType="phone-pad" />
          </View>
        </View>
        <DateField label="Date" required value={form.date} onChange={v => setForm({ ...form, date: v })} />
        <TextField label="Remarks" value={form.remarks} onChangeText={v => setForm({ ...form, remarks: v })} placeholder="Optional notes" multiline />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSaveButtonPress} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update Expense' : 'Save Expense'}</Text>}
        </TouchableOpacity>
      </View>

      <PinConfirmSheet
        visible={pinSheetOpen}
        itemLabel={form.title}
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
