// Generic CMS content screen for About / Terms / Privacy / Refund, driven by
// route.params.slug — same 'cms_pages' table + query as web's
// getCmsPageRequest (src/app/lib/db.ts), body rendered as plain paragraphs
// split on '\n' (see web's LegalPage.tsx — no HTML in `body`).
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { getCmsPageRequest, CmsPageContent } from '../lib/db';
import { MarkdownBody } from '../lib/markdown';
import { colors } from '../theme';

// The web About page doesn't exist yet either, so there's no 'about' row in
// cms_pages — this is an intentional placeholder until the real content
// exists, not a data-integrity shortcut.
const ABOUT_FALLBACK = [
  'Durga CRM is a simple platform built to help Puja and festival committees run their day-to-day work without the chaos of spreadsheets and WhatsApp threads.',
  'From tracking Chanda collections, donations and ads, to managing expenses, vendors, loans and member records — everything your committee already does is organized in one place, accessible from your phone.',
  'Built for committees of any size, Durga CRM keeps your accounts transparent and your tasks on track, right through to immersion day.',
].join('\n');

export function LegalContentScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { slug, title } = route.params || {};
  const [page, setPage] = useState<CmsPageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCmsPageRequest(slug).then(setPage).catch(() => setPage(null)).finally(() => setLoading(false));
  }, [slug]);

  const body = page?.body || (slug === 'about' ? ABOUT_FALLBACK : '');
  const notFound = !loading && !page && slug !== 'about';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 24) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>{title || 'Details'}</Text>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.orange} size="large" /></View>
      ) : notFound ? (
        <View style={styles.loading}><Text style={styles.notFound}>Content not available.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <MarkdownBody body={body} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 13.5, color: colors.mutedLight },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
});
