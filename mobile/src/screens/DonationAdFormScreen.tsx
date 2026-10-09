import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { listDonationAds, createDonationAd, updateDonationAd, logActivity, diffFields, DonationAd, DonationAdCategory, PaidMethod, PaymentStatus, listDonors, listCommitteeMembers, createDonor, listAdvertisers, createAdvertiser } from '../lib/db';
import { colors, radius } from '../theme';
import { TextField, ChipSelect } from '../components/FormField';
import { DateField } from '../components/DateField';
import { SheetSelect } from '../components/SheetSelect';
import { PinConfirmSheet } from '../components/PinConfirmSheet';
import { useKeyboardVisible } from '../components/KeyboardDoneBar';
import { useAuth } from '../lib/auth';
import { todayISO, formatAmount } from '../lib/labels';
import { EntityPicker, PickableEntity } from '../components/EntityPicker';

const PAID_METHOD_OPTIONS: { value: PaidMethod; label: string }[] = [
  { value: 'notSelected', label: 'Not Selected' },
  { value: 'cash', label: 'Cash' },
  { value: 'qrScan', label: 'QR Scan' },
  { value: 'onlineBanking', label: 'Online Banking' },
  { value: 'check', label: 'Check' },
];
const ADS_CATEGORY_OPTIONS = [
  { value: 'handBook', label: 'Hand Book' },
  { value: 'souvenir', label: 'Souvenir' },
  { value: 'leaflet', label: 'Leaflet' },
  { value: 'bill', label: 'Bill' },
  { value: 'foodCoupon', label: 'Food Coupon' },
  { value: 'bookmark', label: 'Bookmark' },
  { value: 'gate', label: 'Gate' },
  { value: 'banner', label: 'Banner' },
  { value: 'hoarding', label: 'Hoarding' },
  { value: 'flex', label: 'Flex' },
  { value: 'pillar', label: 'Pillar' },
  { value: 'roadsideBranding', label: 'Roadside Branding' },
  { value: 'welcomeBoard', label: 'Welcome Board' },
  { value: 'standee', label: 'Standee' },
  { value: 'corridorBranding', label: 'Corridor Branding' },
  { value: 'pandalBranding', label: 'Pandal Branding' },
  { value: 'insidePremisesBranding', label: 'Inside Premises Branding' },
  { value: 'stageBackdrop', label: 'Stage Backdrop' },
  { value: 'stageSidePanel', label: 'Stage Side Panel' },
  { value: 'stall', label: 'Stall' },
];

const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

const emptyForm = { donorName: '', companyName: '', amount: '', paidMethod: 'notSelected' as PaidMethod, paymentStatus: 'pending' as PaymentStatus, inKind: '', date: todayISO(), voucherNumber: '', phone: '', phone2: '', remarks: '', donorId: null as string | null, advertiserId: null as string | null };

const DONATION_AD_FIELD_LABELS: Record<string, string> = {
  donorName: "Donor's Name", companyName: 'Company Name', amount: 'Amount', paidMethod: 'Paid Method',
  paymentStatus: 'Payment Status', inKind: 'In Kind', date: 'Date', voucherNumber: 'Voucher Number', phone: 'Phone Number',
  phone2: 'Phone Number 2', remarks: 'Remarks',
};

export function DonationAdFormScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const keyboardVisible = useKeyboardVisible();
  const category: DonationAdCategory = route.params?.category || 'donation';
  const isAds = category === 'ads';
  const { mode, id } = route.params || { mode: 'add' };
  const isEdit = mode === 'edit' && !!id;

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [original, setOriginal] = useState<DonationAd | null>(null);
  const [tab, setTab] = useState<'member' | 'thirdParty'>('member');
  const [pickablePeople, setPickablePeople] = useState<PickableEntity[]>([]);
  const [pickableAdvertisers, setPickableAdvertisers] = useState<PickableEntity[]>([]);

  useEffect(() => {
    (async () => {
      const [donors, members] = await Promise.all([listDonors(), listCommitteeMembers()]);
      setPickablePeople([
        ...donors.map(d => ({ id: d.id, label: [d.firstName, d.lastName].filter(Boolean).join(' '), subtitle: d.unitNo || undefined, phone: d.phone, source: 'donor' as const })),
        ...members.map(m => ({ id: m.id, label: [m.firstName, m.lastName].filter(Boolean).join(' '), phone: m.phone, source: 'member' as const })),
      ]);
      const advertisers = await listAdvertisers();
      setPickableAdvertisers(advertisers.map(a => ({ id: a.id, label: a.name, phone: a.phone, source: 'advertiser' as const })));
    })();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const all = await listDonationAds(category);
      const existing = all.find(d => d.id === id);
      if (existing) {
        setOriginal(existing);
        setForm({
          donorName: existing.donorName, companyName: existing.companyName || '',
          amount: String(existing.amount), paidMethod: existing.paidMethod,
          paymentStatus: existing.paymentStatus || 'pending',
          inKind: existing.inKind, date: existing.date, voucherNumber: existing.voucherNumber || '',
          phone: existing.phone, phone2: existing.phone2 || '', remarks: existing.remarks,
          donorId: existing.donorId ?? null, advertiserId: existing.advertiserId ?? null,
        });
        setTab(existing.donorId ? 'member' : 'thirdParty');
      }
      setLoading(false);
    })();
  }, [isEdit, id, category]);

  const pickedPerson = pickablePeople.find(p => p.id === form.donorId) || null;
  const pickedAdvertiser = pickableAdvertisers.find(a => a.id === form.advertiserId) || null;

  const handleSaveButtonPress = () => {
    setError('');
    if (tab === 'member' && !form.donorId) {
      setError('Please pick a member.');
      return;
    }
    if (tab === 'thirdParty' && isAds && !form.advertiserId && !form.donorName.trim()) {
      setError('Please pick an advertiser.');
      return;
    }
    if ((!isAds && tab === 'thirdParty' && !form.donorName.trim()) || !form.amount.trim()) {
      setError(isAds ? 'Amount is required.' : 'Donor name and amount are required.');
      return;
    }
    if (isEdit) {
      setPinSheetOpen(true);
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    const payload: Omit<DonationAd, 'id'> = {
      category,
      donorName: form.donorName.trim(),
      companyName: form.companyName.trim() || undefined,
      amount: parseFloat(form.amount) || 0,
      paidMethod: form.paidMethod,
      paymentStatus: form.paymentStatus,
      inKind: form.inKind.trim(),
      date: form.date,
      voucherNumber: !isAds ? (form.voucherNumber.trim() || undefined) : undefined,
      phone: form.phone.trim(),
      phone2: form.phone2.trim() || undefined,
      remarks: form.remarks.trim(),
      donorId: tab === 'member' ? form.donorId : null,
      advertiserId: tab === 'thirdParty' && isAds ? form.advertiserId : null,
    };
    setSaving(true);
    try {
      if (isEdit) await updateDonationAd(id, payload);
      else await createDonationAd(payload);
      if (user) {
        logActivity({
          userId: user.id,
          username: user.username,
          userName: user.name,
          action: isEdit ? 'update' : 'create',
          module: 'donation_ads',
          summary: `${payload.companyName || payload.donorName} — ${formatAmount(payload.amount)}`,
          device: Platform.OS === 'ios' ? 'ios' : 'android',
          changes: isEdit ? diffFields(original as any, payload as any, DONATION_AD_FIELD_LABELS) : undefined,
          recordLabel: payload.companyName || payload.donorName,
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
        <Text style={styles.title}>{isEdit ? `Edit ${isAds ? 'Sponsorship' : 'Donation'}` : `Add ${isAds ? 'Sponsorship' : 'Donation'}`}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabButton, tab === 'member' && styles.tabButtonActive]} onPress={() => { setTab('member'); setForm(f => ({ ...f, advertiserId: null })); }}>
            <Text style={[styles.tabText, tab === 'member' && styles.tabTextActive]}>Member</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, tab === 'thirdParty' && styles.tabButtonActive]} onPress={() => { setTab('thirdParty'); setForm(f => ({ ...f, donorId: null })); }}>
            <Text style={[styles.tabText, tab === 'thirdParty' && styles.tabTextActive]}>Third-party</Text>
          </TouchableOpacity>
        </View>

        {tab === 'member' ? (
          <EntityPicker
            label="Pick a member"
            placeholder="Search flat / name…"
            items={pickablePeople}
            picked={pickedPerson}
            onPick={item => setForm(f => ({ ...f, donorId: item.id, donorName: item.label, phone: item.phone || '' }))}
            onClear={() => setForm(f => ({ ...f, donorId: null, donorName: '', phone: '' }))}
            onQuickAdd={async (name, phone) => {
              const created = await createDonor({ firstName: name, phone });
              const entity: PickableEntity = { id: created.id, label: [created.firstName, created.lastName].filter(Boolean).join(' '), phone: created.phone, source: 'donor' };
              setPickablePeople(prev => [...prev, entity]);
              return entity;
            }}
            quickAddLabel="Not in the list? Add the member"
          />
        ) : isAds ? (
          <EntityPicker
            label="Pick an advertiser"
            placeholder="Search advertiser / company…"
            items={pickableAdvertisers}
            picked={pickedAdvertiser}
            onPick={item => setForm(f => ({ ...f, advertiserId: item.id, donorName: item.label, phone: item.phone || '' }))}
            onClear={() => setForm(f => ({ ...f, advertiserId: null, donorName: '', phone: '' }))}
            onQuickAdd={async (name, phone) => {
              const created = await createAdvertiser({ name, phone });
              const entity: PickableEntity = { id: created.id, label: created.name, phone: created.phone, source: 'advertiser' };
              setPickableAdvertisers(prev => [...prev, entity]);
              return entity;
            }}
            quickAddLabel="Not in the list? Add the advertiser"
          />
        ) : (
          <TextField label="Donor's Name *" required value={form.donorName} onChangeText={v => setForm({ ...form, donorName: v })} placeholder="Donor's name" />
        )}
        {isAds && tab === 'thirdParty' && (
          <TextField label="Company Name" value={form.companyName} onChangeText={v => setForm({ ...form, companyName: v })} placeholder="Company name" />
        )}
        <TextField label="Amount (₹)" required value={form.amount} onChangeText={v => setForm({ ...form, amount: v })} placeholder="0" keyboardType="numeric" />
        {tab === 'thirdParty' && (
          <>
            <TextField label="Contact" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} placeholder="10-digit phone" keyboardType="phone-pad" />
            <TextField label="WhatsApp" value={form.phone2} onChangeText={v => setForm({ ...form, phone2: v })} placeholder="Optional" keyboardType="phone-pad" />
          </>
        )}
        <ChipSelect label="Paid Method" value={form.paidMethod} onChange={v => setForm({ ...form, paidMethod: v as PaidMethod })} options={PAID_METHOD_OPTIONS} />
        <ChipSelect label="Payment Status" required value={form.paymentStatus} onChange={v => setForm({ ...form, paymentStatus: v as PaymentStatus })} options={STATUS_OPTIONS} />
        {!isAds && (
          <TextField label="Voucher Number" value={form.voucherNumber} onChangeText={v => setForm({ ...form, voucherNumber: v })} placeholder="Optional" />
        )}
        {isAds ? (
          <SheetSelect label="Sponsorship Category" value={form.inKind} onChange={v => setForm({ ...form, inKind: v })} options={ADS_CATEGORY_OPTIONS} />
        ) : (
          <TextField label="In Kind (if any)" value={form.inKind} onChangeText={v => setForm({ ...form, inKind: v })} placeholder="e.g. materials, not cash" />
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
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update' : 'Save'}</Text>}
        </TouchableOpacity>
      </View>

      <PinConfirmSheet
        visible={pinSheetOpen}
        itemLabel={form.donorName || form.companyName}
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
  tabRow: { flexDirection: 'row', gap: 8, backgroundColor: colors.secondaryButtonBg, borderRadius: radius.pill, padding: 4, marginBottom: 2 },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
  tabButtonActive: { backgroundColor: colors.primaryButtonBg },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  tabTextActive: { color: '#ffffff' },
  error: { fontSize: 12.5, color: colors.red },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 22, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.secondaryButtonBg },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  saveButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.primaryButtonBg },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
