// Search-and-pick field for a standing tenant-wide entity (Donor/
// Committee-member/Vendor/Advertiser) — mobile equivalent of web's
// "Pick a member"/"Pick a vendor" picker pattern (search box, result list
// with a small source pill, "+ Add new" quick-add). Composed entirely from
// existing on-brand pieces (SearchBar + BottomSheet), no new visual
// language. Client-side filter over an already-loaded `items` array —
// these tenant-wide lists are small, no need for server-side search.
import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Plus, Check, User as UserIcon } from 'lucide-react-native';
import { SearchBar } from './SearchBar';
import { BottomSheet } from './BottomSheet';
import { TextField } from './FormField';
import { colors, radius } from '../theme';

export interface PickableEntity {
  id: string;
  label: string;
  subtitle?: string;
  phone?: string | null;
  source?: 'donor' | 'member' | 'vendor' | 'advertiser';
}

const SOURCE_LABEL: Record<string, string> = {
  donor: 'DONOR',
  member: 'MEMBER',
  vendor: 'VENDOR',
  advertiser: 'ADVERTISER',
};

interface EntityPickerProps {
  label: string;
  placeholder: string;
  items: PickableEntity[];
  picked: PickableEntity | null;
  onPick: (item: PickableEntity) => void;
  onClear: () => void;
  onQuickAdd: (name: string, phone: string) => Promise<PickableEntity>;
  quickAddLabel: string;
}

export function EntityPicker({ label, placeholder, items, picked, onPick, onClear, onQuickAdd, quickAddLabel }: EntityPickerProps) {
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter(i => i.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query, items]);

  const handleQuickAdd = async () => {
    if (!addName.trim()) { setAddError('Name is required.'); return; }
    setAdding(true);
    setAddError('');
    try {
      const created = await onQuickAdd(addName.trim(), addPhone.trim());
      onPick(created);
      setAddOpen(false);
      setAddName('');
      setAddPhone('');
      setQuery('');
    } catch (err: any) {
      console.error('Quick-add failed', err);
      setAddError(err?.message || 'Could not add — please try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      {picked ? (
        <View style={styles.pickedCard}>
          <View style={styles.pickedAvatar}>
            <Text style={styles.pickedAvatarText}>{picked.label.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pickedName} numberOfLines={1}>{picked.label}</Text>
            {!!(picked.subtitle || picked.phone) && (
              <Text style={styles.pickedSubtitle} numberOfLines={1}>
                {[picked.subtitle, picked.phone].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClear} hitSlop={10}>
            <Text style={styles.clearText}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <SearchBar value={query} onChangeText={setQuery} placeholder={placeholder} bare />
          {matches.length > 0 && (
            <View style={styles.resultsBox}>
              <FlatList
                data={matches}
                keyExtractor={i => i.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultRow} onPress={() => { onPick(item); setQuery(''); }}>
                    <View style={styles.resultIcon}>
                      <UserIcon size={14} color={colors.orange} />
                    </View>
                    <Text style={styles.resultLabel} numberOfLines={1}>{item.label}</Text>
                    {item.source && (
                      <View style={styles.sourcePill}>
                        <Text style={styles.sourcePillText}>{SOURCE_LABEL[item.source] || item.source}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
          <TouchableOpacity style={styles.quickAddRow} onPress={() => { setAddName(query); setAddOpen(true); }}>
            <Plus size={14} color={colors.orange} />
            <Text style={styles.quickAddText}>{quickAddLabel}</Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <Text style={styles.sheetTitle}>{quickAddLabel}</Text>
        <TextField label="Name" value={addName} onChangeText={setAddName} placeholder="Full name" required />
        <TextField label="Phone" value={addPhone} onChangeText={setAddPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" />
        {!!addError && <Text style={styles.errorText}>{addError}</Text>}
        <TouchableOpacity style={styles.sheetSaveButton} onPress={handleQuickAdd} disabled={adding}>
          <Check size={16} color={colors.primaryButtonText} />
          <Text style={styles.sheetSaveText}>{adding ? 'Adding…' : 'Add'}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  pickedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.orangeSoft, borderWidth: 1, borderColor: colors.orangeLight,
    borderRadius: radius.md, padding: 12,
  },
  pickedAvatar: {
    width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.orangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  pickedAvatarText: { fontSize: 14, fontWeight: '700', color: colors.orange },
  pickedName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  pickedSubtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  clearText: { fontSize: 12, fontWeight: '600', color: colors.orange },
  resultsBox: {
    marginTop: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultIcon: {
    width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.orangeSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  resultLabel: { flex: 1, fontSize: 13, color: colors.ink, fontWeight: '500' },
  sourcePill: { backgroundColor: colors.orangeSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  sourcePillText: { fontSize: 9, fontWeight: '700', color: colors.orange, letterSpacing: 0.3 },
  quickAddRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  quickAddText: { fontSize: 13, fontWeight: '600', color: colors.orange },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 14 },
  errorText: { fontSize: 12, color: colors.red, marginBottom: 8 },
  sheetSaveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primaryButtonBg, paddingVertical: 14, borderRadius: radius.md, marginTop: 4,
  },
  sheetSaveText: { fontSize: 14, fontWeight: '700', color: colors.primaryButtonText },
});
