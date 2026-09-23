import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Landmark } from 'lucide-react-native';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../theme';

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
      <View style={styles.ring}>
        <View style={styles.iconTile}>
          <Landmark size={44} color="#ffffff" strokeWidth={1.7} />
        </View>
      </View>
      <Text style={styles.title}>Durga CRM</Text>
      <Text style={styles.subtitle}>Committee management, simplified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 18 },
  ring: {
    width: 190,
    height: 190,
    borderRadius: radius.pill,
    backgroundColor: colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.mutedLight },
});
