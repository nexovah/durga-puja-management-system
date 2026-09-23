import { useEffect, useState } from 'react';
import { Keyboard, Platform, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Tracks keyboard visibility so forms can show a "Done" bar right above it —
// there is otherwise no way to dismiss the keyboard once it covers the
// field/footer being typed into, on either iOS or Android.
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return visible;
}

export function KeyboardDoneBar() {
  const visible = useKeyboardVisible();
  if (!visible) return null;
  return (
    <View style={styles.bar}>
      <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={10} style={styles.button}>
        <Text style={styles.text}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'flex-end',
  },
  button: { paddingVertical: 4, paddingHorizontal: 6 },
  text: { fontSize: 14, fontWeight: '700', color: colors.orange },
});
