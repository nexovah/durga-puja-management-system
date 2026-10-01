import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ReceiptCard, ReceiptCardData } from './ReceiptCard';

interface ReceiptPublicPageProps {
  tenantSlug: string;
  token: string;
}

// Public, no-login receipt view — /<tenant-slug>/receipt/<token>. Reads
// via the token-gated get_chanda_receipt_public() RPC (see
// supabase/100_chanda_receipts.sql), never RLS, since the visitor here
// is an anonymous donor, not a logged-in committee user.
export function ReceiptPublicPage({ tenantSlug, token }: ReceiptPublicPageProps) {
  const [data, setData] = useState<ReceiptCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase.rpc('get_chanda_receipt_public', { p_tenant_slug: tenantSlug, p_token: token })
      .then(({ data: rows, error }) => {
        if (error || !rows || rows.length === 0) {
          setNotFound(true);
          return;
        }
        const row = rows[0];
        setData({
          committeeName: row.committee_name || 'Committee',
          committeeAddress: row.committee_address,
          committeeEmail: row.committee_email,
          committeePhone: row.committee_phone,
          committeeLogo: row.committee_logo,
          committeeRegNo: row.committee_reg_no,
          receiptNumber: row.receipt_number || '-',
          donorName: row.donor_name,
          phone: row.phone,
          billNumber: row.bill_number || null,
          numPersons: row.num_persons,
          amount: Number(row.amount) || 0,
          paidMethod: row.paid_method,
          date: row.collection_date,
          collectedBy: row.collected_by,
          colorTheme: row.color_theme || 'saffron',
          customColorHex: row.custom_color_hex,
          headerSymbol: row.header_symbol || '🕉️',
          blessingLine: row.blessing_line || '',
          receiptLanguage: row.receipt_language || 'en',
          showAmountWords: row.show_amount_words !== false,
          showPersons: row.show_persons !== false,
          showPaymentMethod: row.show_payment_method !== false,
          showCollectedBy: row.show_collected_by !== false,
          showLogo: row.show_logo !== false,
          showAddress: row.show_address !== false,
          showContact: row.show_contact !== false,
          showRegNo: row.show_reg_no === true,
          showUpiId: row.show_upi_id === true,
          upiId: row.upi_id,
          signatoryLabel: row.signatory_label || 'Authorised signatory',
          signatureUrl: row.signature_url,
          sealUrl: row.seal_url,
          show80g: row.show_80g === true,
          reg80g: row.reg_80g,
          pan: row.pan,
          declarationText: row.declaration_text,
          paperSize: row.paper_size || 'a5',
          orientation: row.orientation || 'portrait',
          headerLogoUrl: row.header_logo_url,
          headerLogoSize: row.header_logo_size || 'medium',
          headerTitle: row.header_title,
          headerSubtitle1: row.header_subtitle1,
          headerSubtitle2: row.header_subtitle2,
          headerBandTitle: row.header_band_title,
          bandMode: row.band_mode === 'image' ? 'image' : 'default',
          bandImageUrl: row.band_image_url,
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [tenantSlug, token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
      {loading ? (
        <div className="text-gray-500">Loading receipt…</div>
      ) : notFound || !data ? (
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <ShieldAlert className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="font-bold text-gray-800">Receipt not found</p>
          <p className="text-sm text-gray-500 mt-1">This link is invalid or the receipt no longer exists.</p>
        </div>
      ) : (
        <ReceiptCard data={data} />
      )}
    </div>
  );
}
