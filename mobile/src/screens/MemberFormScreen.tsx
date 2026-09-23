import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { listMembers, createMember, updateMember, Member, PaidMethod, PaymentStatus } from '../lib/db';
import { colors, radius } from '../theme';
import { TextField, ChipSelect } from '../components/FormField';
import { DateField } from '../components/DateField';
import { SheetSelect } from '../components/SheetSelect';
import { PinConfirmSheet } from '../components/PinConfirmSheet';
import { useKeyboardVisible } from '../components/KeyboardDoneBar';
import { todayISO } from '../lib/labels';

const ROLE_OPTIONS = [
  { value: 'president', label: 'President' },
  { value: 'vicePresident', label: 'Vice President' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'assistantSecretary', label: 'Assistant Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'executiveMember', label: 'Executive Member' },
  { value: 'advisoryPatron', label: 'Advisory / Patron' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'chiefAdviser', label: 'Chief Adviser' },
  { value: 'adviser', label: 'Adviser' },
];
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
  name: '', phone: '', address: '', role: '', joinDate: todayISO(),
  membershipAmount: '', membershipPaidMethod: 'notSelected' as PaidMethod,
  membershipPaymentStatus: 'pending' as PaymentStatus, membershipPartialAmount: '',
  membershipDate: todayISO(), membershipRemarks: '',
};

export function MemberFormScreen({ route, navigation }: any) {
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
      const all = await listMembers();
      const existing = all.find(m => m.id === id);
      if (existing) {
        setForm({
          name: existing.name, phone: existing.phone, address: existing.address, role: existing.role,
          joinDate: existing.joinDate,
          membershipAmount: existing.membershipAmount ? String(existing.membershipAmount) : '',
          membershipPaidMethod: existing.membershipPaidMethod || 'notSelected',
          membershipPaymentStatus: existing.membershipPaymentStatus || 'pending',
          membershipPartialAmount: existing.membershipPartialAmount ? String(existing.membershipPartialAmount) : '',
          membershipDate: existing.membershipDate || todayISO(),
          membershipRemarks: existing.membershipRemarks || '',
        });
      }
      setLoading(false);
    })();
  }, [isEdit, id]);

  const handleSaveButtonPress = () => {
    setError('');
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (isEdit) {
      setPinSheetOpen(true);
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    const payload: Omit<Member, 'id'> = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      role: form.role.trim(),
      joinDate: form.joinDate,
      membershipAmount: form.membershipAmount ? parseFloat(form.membershipAmount) || 0 : undefined,
      membershipPaidMethod: form.membershipAmount ? form.membershipPaidMethod : undefined,
      membershipPaymentStatus: form.membershipAmount ? form.membershipPaymentStatus : undefined,
      membershipPartialAmount: form.membershipPaymentStatus === 'partial' ? (parseFloat(form.membershipPartialAmount) || 0) : undefined,
      membershipDate: form.membershipAmount ? form.membershipDate : undefined,
      membershipRemarks: form.membershipRemarks.trim(),
    };
    setSaving(true);
    try {
      if (isEdit) await updateMember(id, payload);
      else await createMember(payload);
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
        <Text style={styles.title}>{isEdit ? 'Edit Member' : 'Add Member'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Name" required value={form.name} onChangeText={v => setForm({ ...form, name: v })} placeholder="Full name" />
        <TextField label="Phone Number" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} placeholder="10-digit phone" keyboardType="phone-pad" />
        <TextField label="Address" value={form.address} onChangeText={v => setForm({ ...form, address: v })} placeholder="Address" multiline />
        <SheetSelect label="Role / Designation" value={form.role} onChange={v => setForm({ ...form, role: v })} options={ROLE_OPTIONS} />
        <DateField label="Join Date" required value={form.joinDate} onChange={v => setForm({ ...form, joinDate: v })} />

        <Text style={styles.sectionLabel}>Membership Payment (optional)</Text>
        <TextField label="Membership Amount (₹)" value={form.membershipAmount} onChangeText={v => setForm({ ...form, membershipAmount: v })} placeholder="0" keyboardType="numeric" />
        <ChipSelect label="Paid Method" value={form.membershipPaidMethod} onChange={v => setForm({ ...form, membershipPaidMethod: v as PaidMethod })} options={PAID_METHOD_OPTIONS} />
        <ChipSelect label="Payment Status" value={form.membershipPaymentStatus} onChange={v => setForm({ ...form, membershipPaymentStatus: v as PaymentStatus })} options={STATUS_OPTIONS} />
        {form.membershipPaymentStatus === 'partial' && (
          <TextField label="Amount Paid So Far (₹)" value={form.membershipPartialAmount} onChangeText={v => setForm({ ...form, membershipPartialAmount: v })} placeholder="0" keyboardType="numeric" />
        )}
        <TextField label="Remarks" value={form.membershipRemarks} onChangeText={v => setForm({ ...form, membershipRemarks: v })} placeholder="Optional notes" multiline />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSaveButtonPress} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update Member' : 'Save Member'}</Text>}
        </TouchableOpacity>
      </View>

      <PinConfirmSheet
        visible={pinSheetOpen}
        itemLabel={form.name}
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
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedLight, textTransform: 'uppercase', marginTop: 4 },
  error: { fontSize: 12.5, color: colors.red },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 22, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: '#f4f1ec' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  saveButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.dark },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
