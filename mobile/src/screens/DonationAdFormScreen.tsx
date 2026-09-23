import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { listDonationAds, createDonationAd, updateDonationAd, DonationAd, DonationAdCategory, PaidMethod } from '../lib/db';
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

const emptyForm = { donorName: '', companyName: '', amount: '', paidMethod: 'notSelected' as PaidMethod, inKind: '', date: todayISO(), voucherNumber: '', phone: '', phone2: '', remarks: '' };

export function DonationAdFormScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const category: DonationAdCategory = route.params?.category || 'donation';
  const isAds = category === 'ads';
  const { mode, id } = route.params || { mode: 'add' };
  const isEdit = mode === 'edit' && !!id;

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const all = await listDonationAds(category);
      const existing = all.find(d => d.id === id);
      if (existing) {
        setForm({
          donorName: existing.donorName, companyName: existing.companyName || '',
          amount: String(existing.amount), paidMethod: existing.paidMethod,
          inKind: existing.inKind, date: existing.date, voucherNumber: existing.voucherNumber || '',
          phone: existing.phone, phone2: existing.phone2 || '', remarks: existing.remarks,
        });
      }
      setLoading(false);
    })();
  }, [isEdit, id, category]);

  const handleSave = async () => {
    setError('');
    if ((isAds && !form.companyName.trim()) || (!isAds && !form.donorName.trim()) || !form.amount.trim()) {
      setError(isAds ? 'Company name and amount are required.' : 'Donor name and amount are required.');
      return;
    }
    const payload: Omit<DonationAd, 'id'> = {
      category,
      donorName: form.donorName.trim(),
      companyName: form.companyName.trim() || undefined,
      amount: parseFloat(form.amount) || 0,
      paidMethod: form.paidMethod,
      inKind: form.inKind.trim(),
      date: form.date,
      voucherNumber: !isAds ? (form.voucherNumber.trim() || undefined) : undefined,
      phone: form.phone.trim(),
      phone2: form.phone2.trim() || undefined,
      remarks: form.remarks.trim(),
    };
    setSaving(true);
    try {
      if (isEdit) await updateDonationAd(id, payload);
      else await createDonationAd(payload);
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? `Edit ${isAds ? 'Ad' : 'Donation'}` : `Add ${isAds ? 'Ad' : 'Donation'}`}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        {isAds ? (
          <TextField label="Company Name" required value={form.companyName} onChangeText={v => setForm({ ...form, companyName: v })} placeholder="Company name" />
        ) : (
          <TextField label="Donor's Name" required value={form.donorName} onChangeText={v => setForm({ ...form, donorName: v })} placeholder="Donor's name" />
        )}
        <TextField label="Amount (₹)" required value={form.amount} onChangeText={v => setForm({ ...form, amount: v })} placeholder="0" keyboardType="numeric" />
        <TextField label="Phone Number" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} placeholder="10-digit phone" keyboardType="phone-pad" />
        <ChipSelect label="Paid Method" value={form.paidMethod} onChange={v => setForm({ ...form, paidMethod: v as PaidMethod })} options={PAID_METHOD_OPTIONS} />
        {!isAds && (
          <TextField label="Voucher Number" value={form.voucherNumber} onChangeText={v => setForm({ ...form, voucherNumber: v })} placeholder="Optional" />
        )}
        <TextField label="In Kind (if any)" value={form.inKind} onChangeText={v => setForm({ ...form, inKind: v })} placeholder="e.g. materials, not cash" />
        <TextField label="Date" required value={form.date} onChangeText={v => setForm({ ...form, date: v })} placeholder="YYYY-MM-DD" />
        <TextField label="Remarks" value={form.remarks} onChangeText={v => setForm({ ...form, remarks: v })} placeholder="Optional notes" multiline />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update' : 'Save'}</Text>}
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
  form: { padding: 20, gap: 14 },
  error: { fontSize: 12.5, color: colors.red },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 22, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: '#f4f1ec' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  saveButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.dark },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
