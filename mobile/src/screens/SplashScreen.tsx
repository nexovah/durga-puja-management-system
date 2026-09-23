import { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';

// Real auth check, not a timed splash — waits for AuthProvider to finish
// reading the persisted session from AsyncStorage, then the navigator
// (see RootNavigator.tsx) sends the user to Home or Login accordingly.
export function SplashScreen({ navigation }: any) {
  const { loading, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    navigation.replace(user ? 'Home' : 'Login');
  }, [loading, user]);

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Durga CRM</Text>
      <Text style={styles.subtitle}>One committee. One dashboard. Everything under control.</Text>
      <Text style={styles.tagline}>Plan · Collect · Manage · Celebrate</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  logo: { width: 190, height: 190, borderRadius: 95, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.mutedLight, textAlign: 'center' },
  tagline: { fontSize: 12, fontWeight: '700', color: colors.orange, letterSpacing: 0.3 },
});
