import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';

// Onboarding carousel shown after Splash, before Login — every time a user
// is logged out (matches the approved mockup: logo, one of 3 slides with a
// headline + supporting line, dot pagination, "Get Started"/"Skip" both
// leading to Login). Uses this app's own theme (colors.dark/colors.orange/
// colors.bg) rather than the mockup's raw colors, per the design system.
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'One Committee. One Dashboard.',
    subtitle: 'Chanda, donations, expenses, members and tasks — everything your committee needs, organized in one place.',
  },
  {
    title: 'Every Rupee, Clearly Tracked.',
    subtitle: 'Record collections and expenses with complete clarity — know exactly what’s collected, spent and pending, always.',
  },
  {
    title: 'Manage your Puja.\nOrganize your Committee.',
    subtitle: 'Stop managing your Puja across notebooks, spreadsheets, WhatsApp messages and scattered records. Durga CRM brings your committee’s everyday work together in one organized platform.',
  },
];

export function WelcomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const goToLogin = () => navigation.replace('Login');

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(i);
  };

  // Auto-advance every 4s, looping back to the first slide; restarts
  // whenever the user manually swipes so it doesn't fight their gesture.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = (index + 1) % SLIDES.length;
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
      setIndex(next);
    }, 4000);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.ring}>
              <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={goToLogin} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToLogin} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  ring: {
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: colors.orangeLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 36,
  },
  logo: { width: 96, height: 96, borderRadius: 48 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 12, lineHeight: 30 },
  subtitle: { fontSize: 14, color: colors.mutedLight, textAlign: 'center', lineHeight: 21, maxWidth: 320 },
  footer: { paddingHorizontal: 28, paddingTop: 8, alignItems: 'center', gap: 14 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.borderStrong },
  dotActive: { width: 22, backgroundColor: colors.orange },
  primaryButton: {
    width: '100%', backgroundColor: colors.dark, borderRadius: radius.pill,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  skipText: { fontSize: 13, fontWeight: '600', color: colors.mutedLight },
});
