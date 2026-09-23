import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { listTasks, createTask, updateTask, defaultExpiryDate, Task, TaskPriority } from '../lib/tasks';
import { listMembers, Member } from '../lib/db';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../theme';
import { TextField, ChipSelect } from '../components/FormField';
import { DateField } from '../components/DateField';
import { PinConfirmSheet } from '../components/PinConfirmSheet';
import { useKeyboardVisible } from '../components/KeyboardDoneBar';
import { todayISO } from '../lib/labels';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'note', label: 'Note' },
  { value: 'completed', label: 'Completed' },
];

export function TaskFormScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const { user } = useAuth();
  const { mode, id } = route.params || { mode: 'add' };
  const isEdit = mode === 'edit' && !!id;

  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [createdAt, setCreatedAt] = useState(new Date().toISOString());
  const [expiryDate, setExpiryDate] = useState(defaultExpiryDate(new Date().toISOString()));
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinSheetOpen, setPinSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const allMembers = await listMembers();
      setMembers(allMembers);
      if (isEdit) {
        const all = await listTasks();
        const existing = all.find(t => t.id === id);
        if (existing) {
          setTitle(existing.title);
          setDescription(existing.description);
          setPriority(existing.priority);
          setCreatedAt(existing.createdAt);
          setExpiryDate(existing.expiryDate || defaultExpiryDate(existing.createdAt));
          setAssignedMemberIds(existing.assignedMemberIds || []);
        }
      }
      setLoading(false);
    })();
  }, [isEdit, id]);

  const toggleMember = (memberId: string) => {
    setAssignedMemberIds(prev => prev.includes(memberId) ? prev.filter(m => m !== memberId) : [...prev, memberId]);
  };

  const handleSaveButtonPress = () => {
    setError('');
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    if (isEdit) {
      setPinSheetOpen(true);
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    const payload: Omit<Task, 'id'> = {
      title: title.trim(),
      description: description.trim(),
      priority,
      createdAt,
      expiryDate,
      assignedMemberIds,
      createdBy: user?.id || '',
      createdByName: user?.name || '',
    };
    setSaving(true);
    try {
      if (isEdit) await updateTask(id, payload);
      else await createTask(payload);
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
        <Text style={styles.title}>{isEdit ? 'Edit Task' : 'Add Task'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="Task title" />
        <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Optional details" multiline />
        <ChipSelect label="Priority" required value={priority} onChange={v => setPriority(v as TaskPriority)} options={PRIORITY_OPTIONS} />
        <DateField label="Expiry Date" required value={expiryDate} onChange={setExpiryDate} />

        <View style={styles.field}>
          <Text style={styles.label}>Assigned Members</Text>
          <View style={styles.chipRow}>
            {members.length === 0 && <Text style={styles.emptyMembers}>No members yet.</Text>}
            {members.map(m => {
              const active = assignedMemberIds.includes(m.id);
              return (
                <TouchableOpacity key={m.id} onPress={() => toggleMember(m.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSaveButtonPress} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{isEdit ? 'Update Task' : 'Save Task'}</Text>}
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
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.inkSoft },
  chipTextActive: { color: '#ffffff' },
  emptyMembers: { fontSize: 12.5, color: colors.mutedLight },
  error: { fontSize: 12.5, color: colors.red },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 22, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: '#f4f1ec' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  saveButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.dark },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
