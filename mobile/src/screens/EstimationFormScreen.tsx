// Web's Estimation.tsx has a dynamic, drag-reorderable line-item editor.
// Mobile v1 simplifies this to a plain add/remove-row list — no
// drag-reorder — per the project's standing mobile-plan note.
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import {
  listEstimations, createEstimation, updateEstimation, DEFAULT_ESTIMATION_COLUMN_LABELS,
  Estimation, EstimationLineItem,
} from '../lib/estimations';
import { logActivity, diffFields } from '../lib/db';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../theme';
import { TextField } from '../components/FormField';
import { PinConfirmSheet } from '../components/PinConfirmSheet';
import { useKeyboardVisible } from '../components/KeyboardDoneBar';
import { genId, formatAmount } from '../lib/labels';

const blankLineItem = (): EstimationLineItem => ({ id: genId(), title: '', customField: '', customField2: '', amount: 0 });

// Line items are a dynamic, drag-reorderable list — too complex to diff
// field-by-field meaningfully, so only the top-level scalar fields are diffed.
const ESTIMATION_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
};

export function EstimationFormScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const { user } = useAuth();
  const { mode, id } = route.params || { mode: 'add' };
  const isEdit = mode === 'edit' && !!id;

  const [title, setTitle] = useState('');
  const [createdAt, setCreatedAt] = useState(new Date().toISOString());
  const [lineItems, setLineItems] = useState<EstimationLineItem[]>([blankLineItem()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [original, setOriginal] = useState<Estimation | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const all = await listEstimations();
      const existing = all.find(e => e.id === id);
      if (existing) {
        setOriginal(existing);
        setTitle(existing.title);
        setCreatedAt(existing.createdAt);
        setLineItems(existing.lineItems.length > 0 ? existing.lineItems : [blankLineItem()]);
      }
      setLoading(false);
    })();
  }, [isEdit, id]);

  const updateLineItem = (itemId: string, patch: Partial<EstimationLineItem>) => {
    setLineItems(prev => prev.map(li => (li.id === itemId ? { ...li, ...patch } : li)));
  };
  const addLineItem = () => setLineItems(prev => [...prev, blankLineItem()]);
  const removeLineItem = (itemId: string) => setLineItems(prev => (prev.length > 1 ? prev.filter(li => li.id !== itemId) : prev));

  const total = lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);

  const handleSaveButtonPress = () => {
    setError('');
    if (!title.trim()) {
      setError('Estimation title is required.');
      return;
    }
    if (isEdit) {
      setPinSheetOpen(true);
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    const cleanedItems = lineItems.filter(li => li.title.trim() !== '' || (Number(li.amount) || 0) !== 0);
    const payload: Omit<Estimation, 'id'> = {
      title: title.trim(),
      lineItems: (cleanedItems.length > 0 ? cleanedItems : lineItems).map(li => ({ ...li, amount: Number(li.amount) || 0 })),
      columnLabels: DEFAULT_ESTIMATION_COLUMN_LABELS,
      createdAt,
      createdBy: user?.id || '',
      createdByName: user?.name || '',
    };
    setSaving(true);
    try {
      if (isEdit) await updateEstimation(id, payload);
      else await createEstimation(payload);
      if (user) {
        logActivity({
          userId: user.id,
          username: user.username,
          userName: user.name,
          action: isEdit ? 'update' : 'create',
          module: 'estimation',
          summary: `${payload.title} — ${formatAmount(total)}`,
          device: Platform.OS === 'ios' ? 'ios' : 'android',
          changes: isEdit ? diffFields(original as any, payload as any, ESTIMATION_FIELD_LABELS) : undefined,
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
        <Text style={styles.title}>{isEdit ? 'Edit Estimation' : 'Add Estimation'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="Estimation title" />

        <View style={styles.field}>
          <Text style={styles.label}>Line Items</Text>
          {lineItems.map((li, idx) => (
            <View key={li.id} style={styles.lineItemCard}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemIndex}>#{idx + 1}</Text>
                <TouchableOpacity onPress={() => removeLineItem(li.id)} hitSlop={8}>
                  <X size={16} color={colors.mutedLight} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
              <TextField label="Item" value={li.title} onChangeText={v => updateLineItem(li.id, { title: v })} placeholder="Item name" />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <TextField label="Field 1" value={li.customField} onChangeText={v => updateLineItem(li.id, { customField: v })} placeholder="Optional" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Field 2" value={li.customField2} onChangeText={v => updateLineItem(li.id, { customField2: v })} placeholder="Optional" />
                </View>
              </View>
              <TextField
                label="Amount (₹)"
                value={li.amount ? String(li.amount) : ''}
                onChangeText={v => updateLineItem(li.id, { amount: parseFloat(v) || 0 })}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          ))}
          <TouchableOpacity onPress={addLineItem} style={styles.addRow}>
            <Plus size={16} color={colors.orange} strokeWidth={2.3} />
            <Text style={styles.addRowText}>Add Line Item</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatAmount(total)}</Text>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSaveButtonPress} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update Estimation' : 'Save Estimation'}</Text>}
        </TouchableOpacity>
      </View>

      <PinConfirmSheet
        visible={pinSheetOpen}
        itemLabel={title}
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
  field: { gap: 10 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  row: { flexDirection: 'row', gap: 12 },
  lineItemCard: { padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.card, gap: 10 },
  lineItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineItemIndex: { fontSize: 11.5, fontWeight: '700', color: colors.mutedLight },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.orange, borderStyle: 'dashed' },
  addRowText: { fontSize: 13, fontWeight: '700', color: colors.orange },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: radius.md, backgroundColor: colors.orangeSoft },
  totalLabel: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.orange },
  error: { fontSize: 12.5, color: colors.red },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 22, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: '#f4f1ec' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  saveButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.dark },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
