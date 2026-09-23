import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { listChanda, createChanda, updateChanda, Chanda, PaidMethod, PaymentStatus } from '../lib/db';
import { colors, radius } from '../theme';
import { TextField, ChipSelect } from '../components/FormField';
import { todayISO } from '../lib/labels';

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
  donorName: '', amount: '', billNumber: '', phone: '', phone2: '',
  paidMethod: 'notSelected' as PaidMethod, paymentStatus: 'pending' as PaymentStatus,
  partialAmount: '', date: todayISO(), remarks: '',
};

export function ChandaFormScreen({ route, navigation }: any) {
  const { mode, id } = route.params || { mode: 'add' };
  const isEdit = mode === 'edit' && !!id;

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const all = await listChanda();
      const existing = all.find(c => c.id === id);
      if (existing) {
        setForm({
          donorName: existing.donorName,
          amount: String(existing.amount),
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

  const handleSave = async () => {
    setError('');
    if (!form.donorName.trim() || !form.amount.trim()) {
      setError('Donor name and amount are required.');
      return;
    }
    const payload: Omit<Chanda, 'id'> = {
      donorName: form.donorName.trim(),
      amount: parseFloat(form.amount) || 0,
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Edit Chanda' : 'Add Chanda'}</Text>
        {isEdit && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Paid</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <TextField label="Donor's Name" required value={form.donorName} onChangeText={v => setForm({ ...form, donorName: v })} placeholder="Donor's name" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="Amount (₹)" required value={form.amount} onChangeText={v => setForm({ ...form, amount: v })} placeholder="0" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Bill Number" value={form.billNumber} onChangeText={v => setForm({ ...form, billNumber: v })} placeholder="Optional" />
          </View>
        </View>
        <TextField label="Phone Number" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} placeholder="10-digit phone" keyboardType="phone-pad" />
        <ChipSelect label="Paid Method" value={form.paidMethod} onChange={v => setForm({ ...form, paidMethod: v as PaidMethod })} options={PAID_METHOD_OPTIONS} />
        <ChipSelect label="Payment Status" required value={form.paymentStatus} onChange={v => setForm({ ...form, paymentStatus: v as PaymentStatus })} options={STATUS_OPTIONS} />
        {form.paymentStatus === 'partial' && (
          <TextField label="Amount Paid So Far (₹)" value={form.partialAmount} onChangeText={v => setForm({ ...form, partialAmount: v })} placeholder="0" keyboardType="numeric" />
        )}
        <TextField label="Date" required value={form.date} onChangeText={v => setForm({ ...form, date: v })} placeholder="YYYY-MM-DD" />
        <TextField label="Remarks" value={form.remarks} onChangeText={v => setForm({ ...form, remarks: v })} placeholder="Optional notes" multiline />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update Chanda' : 'Save Chanda'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
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
