import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { BottomSheet } from './BottomSheet';

interface PinConfirmSheetProps {
  visible: boolean;
  itemLabel?: string; // e.g. the donor's name — shown so the user knows what they're updating
  onCancel: () => void;
  onConfirm: () => void;
}

const generatePin = () => String(Math.floor(1000 + Math.random() * 9000));

// Ports the web app's random-4-digit-PIN confirm (DeleteConfirmModal.tsx) to
// a bottom sheet, used before UPDATE (not add) so an accidental edit-save
// can't silently overwrite real data — same friction, same UX, mobile form.
export function PinConfirmSheet({ visible, itemLabel, onCancel, onConfirm }: PinConfirmSheetProps) {
  const [pin, setPin] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (visible) {
      setPin(generatePin());
      setInput('');
      setError(false);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (input.trim() === pin) {
      onConfirm();
    } else {
      setError(true);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <Text style={styles.title}>Confirm Update</Text>
      <Text style={styles.message}>
        {itemLabel ? (
          <>Confirm you want to update <Text style={styles.messageHighlight}>{itemLabel}</Text>.</>
        ) : (
          'Confirm you want to save this update.'
        )}
      </Text>

      <View style={styles.pinBox}>
        <Text style={styles.pinLabel}>Type this PIN to confirm</Text>
        <Text style={styles.pinValue}>{pin}</Text>
      </View>

      <TextInput
        value={input}
        onChangeText={v => { setInput(v.replace(/\D/g, '').slice(0, 4)); setError(false); }}
        placeholder="Enter PIN"
        placeholderTextColor={colors.mutedLight}
        keyboardType="numeric"
        maxLength={4}
        autoFocus
        style={[styles.input, error && styles.inputError]}
      />
      {error && <Text style={styles.errorText}>PIN doesn't match. Try again.</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={input.length !== 4}
          style={[styles.confirmButton, input.length !== 4 && styles.confirmButtonDisabled]}
        >
          <Text style={styles.confirmText}>Update</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  message: { fontSize: 13, color: colors.mutedLight, marginBottom: 16, lineHeight: 19 },
  messageHighlight: { color: colors.ink, fontWeight: '800' },
  pinBox: {
    backgroundColor: colors.orangeSoft, borderWidth: 1, borderColor: '#fcd9b8',
    borderRadius: radius.lg, padding: 16, alignItems: 'center', marginBottom: 16,
  },
  pinLabel: { fontSize: 11.5, fontWeight: '700', color: colors.orange, marginBottom: 4 },
  pinValue: { fontSize: 28, fontWeight: '800', color: colors.orange, letterSpacing: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.md,
    paddingVertical: 12, textAlign: 'center', fontSize: 18, letterSpacing: 8,
    color: colors.ink, backgroundColor: colors.card, marginBottom: 6,
  },
  inputError: { borderColor: colors.red },
  errorText: { fontSize: 12, color: colors.red, textAlign: 'center', marginBottom: 6 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  confirmButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.dark },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: radius.md, backgroundColor: '#f4f1ec' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
});
