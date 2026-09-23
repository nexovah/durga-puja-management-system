import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { listChanda, createChanda, updateChanda, Chanda, PaidMethod, PaymentStatus } from '../lib/db';
import { colors, radius } from '../theme';
import { TextField, ChipSelect } from '../components/FormField';
import { DateField } from '../components/DateField';
import { PinConfirmSheet } from '../components/PinConfirmSheet';
import { useKeyboardVisible } from '../components/KeyboardDoneBar';
import { todayISO, PAYMENT_STATUS_LABEL, STATUS_COLORS } from '../lib/labels';

const PAID_METHOD_OPTIONS: { value: PaidMethod; label: string }[] = [
  { value: 'notSelected', label: 'Not Selected' },
  { value: 'cash', label: 'Cash' },
  { value: 'qrScan', label: 'QR Scan' },
  { value: 'onlineBanking', label: 'Online Banking' },
  { value: 'check', label: 'Check' },
];
const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
];

const emptyForm = {
  donorName: '', amount: '', amount1: '', amount2: '', billNumber: '', phone: '', phone2: '',
  paidMethod: 'notSelected' as PaidMethod, paymentStatus: 'pending' as PaymentStatus,
  partialAmount: '', date: todayISO(), remarks: '',
};

export function ChandaFormScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const { mode, id } = route.params || { mode: 'add' };
  const isEdit = mode === 'edit' && !!id;

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinSheetOpen, setPinSheetOpen] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const all = await listChanda();
      const existing = all.find(c => c.id === id);
      if (existing) {
        setForm({
          donorName: existing.donorName,
          amount: String(existing.amount),
          amount1: existing.amount1 !== undefined ? String(existing.amount1) : '',
          amount2: existing.amount2 !== undefined ? String(existing.amount2) : '',
          billNumber: existing.billNumber || '',
          phone: existing.phone,
          phone2: existing.phone2 || '',
          paidMethod: existing.paidMethod,
          paymentStatus: existing.paymentStatus,
          partialAmount: existing.partialAmount ? String(existing.partialAmount) : '',
          date: existing.date,
          remarks: existing.remarks,
        });
      }
      setLoading(false);
    })();
  }, [isEdit, id]);

  // Amount 1 / Amount 2 are an optional breakdown of the main Amount field —
  // matching web's logic: leaving both blank lets Amount stay freely typed,
  // filling either one makes Amount always reflect their sum.
  const handleSubAmountChange = (field: 'amount1' | 'amount2', value: string) => {
    const next = { ...form, [field]: value };
    const a1 = field === 'amount1' ? value : form.amount1;
    const a2 = field === 'amount2' ? value : form.amount2;
    if (a1.trim() !== '' || a2.trim() !== '') {
      next.amount = ((parseFloat(a1) || 0) + (parseFloat(a2) || 0)).toString();
    }
    setForm(next);
  };

  const handleSaveButtonPress = () => {
    setError('');
    if (!form.donorName.trim() || !form.amount.trim()) {
      setError('Donor name and amount are required.');
      return;
    }
    if (isEdit) {
      setPinSheetOpen(true);
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    const payload: Omit<Chanda, 'id'> = {
      donorName: form.donorName.trim(),
      amount: parseFloat(form.amount) || 0,
      amount1: form.amount1.trim() !== '' ? parseFloat(form.amount1) : undefined,
      amount2: form.amount2.trim() !== '' ? parseFloat(form.amount2) : undefined,
      billNumber: form.billNumber.trim() || undefined,
      phone: form.phone.trim(),
      phone2: form.phone2.trim() || undefined,
      paidMethod: form.paidMethod,
      paymentStatus: form.paymentStatus,
      partialAmount: form.paymentStatus === 'partial' ? (parseFloat(form.partialAmount) || 0) : undefined,
      date: form.date,
      remarks: form.remarks.trim(),
    };
    setSaving(true);
    try {
      if (isEdit) await updateChanda(id, payload);
      else await createChanda(payload);
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Edit Chanda' : 'Add Chanda'}</Text>
        {isEdit && (
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[form.paymentStatus].bg }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[form.paymentStatus].text }]}>{PAYMENT_STATUS_LABEL[form.paymentStatus]}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Donor's Name" required value={form.donorName} onChangeText={v => setForm({ ...form, donorName: v })} placeholder="Donor's name" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="Amount (₹)" required value={form.amount} onChangeText={v => setForm({ ...form, amount: v })} placeholder="0" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Bill Number" value={form.billNumber} onChangeText={v => setForm({ ...form, billNumber: v })} placeholder="Optional" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="Amount 1 (₹)" value={form.amount1} onChangeText={v => handleSubAmountChange('amount1', v)} placeholder="Optional" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Amount 2 (₹)" value={form.amount2} onChangeText={v => handleSubAmountChange('amount2', v)} placeholder="Optional" keyboardType="numeric" />
          </View>
        </View>
        <TextField label="Phone Number" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} placeholder="10-digit phone" keyboardType="phone-pad" />
        <ChipSelect label="Paid Method" value={form.paidMethod} onChange={v => setForm({ ...form, paidMethod: v as PaidMethod })} options={PAID_METHOD_OPTIONS} />
        <ChipSelect label="Payment Status" required value={form.paymentStatus} onChange={v => setForm({ ...form, paymentStatus: v as PaymentStatus })} options={STATUS_OPTIONS} />
        {form.paymentStatus === 'partial' && (
          <TextField label="Amount Paid So Far (₹)" value={form.partialAmount} onChangeText={v => setForm({ ...form, partialAmount: v })} placeholder="0" keyboardType="numeric" />
        )}
        <DateField label="Date" required value={form.date} onChange={v => setForm({ ...form, date: v })} />
        <TextField label="Remarks" value={form.remarks} onChangeText={v => setForm({ ...form, remarks: v })} placeholder="Optional notes" multiline />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSaveButtonPress} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update Chanda' : 'Save Chanda'}</Text>}
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
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#166534' },
  form: { padding: 20, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  error: { fontSize: 12.5, color: colors.red },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 22, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: '#f4f1ec' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  saveButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.dark },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
