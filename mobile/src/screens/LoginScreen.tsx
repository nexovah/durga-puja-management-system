import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Landmark, User, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../theme';

// Real login — calls the same login() RPC the web app uses (see
// mobile/src/lib/auth.tsx). A wrong password fails for real; no bypass.
export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!username.trim() || !password) {
      setError('Enter your User ID and password.');
      return;
    }
    setSubmitting(true);
    const result = await login(username.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Invalid User ID or password.');
      return;
    }
    navigation.replace('Home');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.ring}>
          <View style={styles.iconTile}>
            <Landmark size={28} color="#ffffff" strokeWidth={1.8} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to your committee account</Text>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>User ID</Text>
            <View style={styles.inputWrap}>
              <User size={16} color={colors.mutedLight} strokeWidth={2} style={styles.inputIcon} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your user ID"
                placeholderTextColor={colors.mutedLight}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={colors.mutedLight} strokeWidth={2} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.mutedLight}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={[styles.input, { paddingRight: 40 }]}
              />
              <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeButton} hitSlop={8}>
                {showPassword ? <EyeOff size={16} color={colors.mutedLight} strokeWidth={2} /> : <Eye size={16} color={colors.mutedLight} strokeWidth={2} />}
              </TouchableOpacity>
            </View>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={[styles.button, submitting && { opacity: 0.6 }]}>
            {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Log In</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.footnote}>
          Add and update your committee's Chanda, Members, Expenses and more — right from your phone.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 200, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  ring: { width: 118, height: 118, borderRadius: radius.pill, backgroundColor: colors.orangeLight, alignItems: 'center', justifyContent: 'center' },
  iconTile: { width: 58, height: 58, borderRadius: 17, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 32, paddingBottom: 32, alignItems: 'center', gap: 22 },
  title: { fontSize: 19, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  subtitle: { fontSize: 12.5, color: colors.mutedLight, marginTop: -14, textAlign: 'center' },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 22,
    gap: 15,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 14, zIndex: 1 },
  input: {
    width: '100%',
    paddingLeft: 40,
    paddingRight: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    fontSize: 14.5,
    color: colors.ink,
  },
  eyeButton: { position: 'absolute', right: 14 },
  error: { fontSize: 12.5, color: colors.red, textAlign: 'center' },
  button: { backgroundColor: colors.dark, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#ffffff', fontSize: 14.5, fontWeight: '700' },
  footnote: { fontSize: 11.5, color: colors.mutedLight, textAlign: 'center', lineHeight: 17, paddingHorizontal: 8 },
});
