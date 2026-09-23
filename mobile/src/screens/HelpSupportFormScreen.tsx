// Post a new support query. Username + date are read-only/auto-filled per
// spec — no PinConfirmSheet, no logActivity(): support tickets are a
// separate concern from the CRM's Activity Log.
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Paperclip, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { createTicket } from '../lib/support';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../theme';
import { TextField } from '../components/FormField';
import { formatDate } from '../lib/labels';

export function HelpSupportFormScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const today = formatDate(new Date().toISOString());

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!body.trim()) {
      setError('Please describe your query.');
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await createTicket({
        userId: user.id,
        username: user.username,
        userName: user.name,
        title,
        body,
        imageUri,
      });
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>Post a New Query</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.metaRow}>
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>Submitted by</Text>
            <Text style={styles.metaValue}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{today}</Text>
          </View>
        </View>

        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="Short summary of your query" />
        <TextField label="Description" required value={body} onChangeText={setBody} placeholder="Describe your issue or question in detail" multiline />

        <View style={styles.field}>
          <Text style={styles.label}>Attachment</Text>
          {imageUri ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={styles.removeImage} onPress={() => setImageUri(undefined)} hitSlop={8}>
                <X size={14} color="#ffffff" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.attachButton} onPress={pickImage} activeOpacity={0.7}>
              <Paperclip size={16} color={colors.inkSoft} strokeWidth={2} />
              <Text style={styles.attachText}>Attach a screenshot</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Submit</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  form: { padding: 20, gap: 14 },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaField: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, gap: 3 },
  metaLabel: { fontSize: 11, fontWeight: '700', color: colors.mutedLight },
  metaValue: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  attachButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: colors.card },
  attachText: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  imageWrap: { position: 'relative', alignSelf: 'flex-start' },
  imagePreview: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.border },
  removeImage: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 12.5, color: colors.red },
  footer: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: '#f4f1ec' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  saveButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.dark },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
