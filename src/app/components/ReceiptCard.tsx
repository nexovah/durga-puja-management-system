// The one receipt design shared by three call sites: the Settings live
// preview, the in-app ReceiptModal, and the public ReceiptPublicPage —
// so there's exactly one receipt layout to maintain, never three drifting
// copies. Mobile-first portrait card, deliberately ornate/traditional
// ("Hindu shastra" styling — temple-parapet border strips, a radiating
// halo behind the header symbol, a subtle mandala-dot texture, and the
// Google Font `Yatra One` for the key lines) rather than a flat generic
// card. Also carries @media print rules for both A5 and 80mm thermal
// paper widths.
export interface ReceiptCardData {
  committeeName: string;
  committeeAddress: string | null;
  committeeEmail: string | null;
  committeePhone: string | null;
  committeeLogo: string | null;
  committeeRegNo: string | null;
  receiptNumber: string;
  donorName: string;
  phone: string | null;
  /** Always shown when present — not a user-toggleable setting, this is the chanda row's own bill number. */
  billNumber: string | null;
  numPersons: number | null;
  amount: number;
  paidMethod: string;
  date: string;
  collectedBy: string | null;
  colorTheme: 'saffron' | 'rose' | 'emerald' | 'indigo' | 'custom';
  customColorHex: string | null;
  headerSymbol: string;
  blessingLine: string;
  receiptLanguage: 'en' | 'bn' | 'hi';
  showAmountWords: boolean;
  showPersons: boolean;
  showPaymentMethod: boolean;
  showCollectedBy: boolean;
  showLogo: boolean;
  showAddress: boolean;
  showContact: boolean;
  showRegNo: boolean;
  showUpiId: boolean;
  upiId: string | null;
  signatoryLabel: string;
  signatureUrl: string | null;
  sealUrl: string | null;
  show80g: boolean;
  reg80g: string | null;
  pan: string | null;
  declarationText: string | null;
  paperSize: 'a5' | 'thermal80mm';
  orientation: 'portrait' | 'landscape';
  /** Header overrides — each falls back to the matching committee* field when blank. */
  headerLogoUrl: string | null;
  headerLogoSize: 'small' | 'medium' | 'large';
  headerTitle: string | null;
  headerSubtitle1: string | null;
  headerSubtitle2: string | null;
  headerBandTitle: string | null;
  /** 'image' replaces the whole gradient band (symbol + band title) with bandImageUrl, uncropped. */
  bandMode: 'default' | 'image';
  bandImageUrl: string | null;
}

const HEADER_LOGO_PX: Record<ReceiptCardData['headerLogoSize'], number> = {
  small: 36, medium: 52, large: 64,
};

const THEME_SOLID: Record<Exclude<ReceiptCardData['colorTheme'], 'custom'>, [string, string]> = {
  saffron: ['#f97316', '#ef4444'],
  rose: ['#f43f5e', '#db2777'],
  emerald: ['#10b981', '#0d9488'],
  indigo: ['#6366f1', '#9333ea'],
};

function darken(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const r = Math.max(0, parseInt(n.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(n.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(n.slice(4, 6), 16) - amount);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function themeColors(data: ReceiptCardData): [string, string] {
  if (data.colorTheme === 'custom' && data.customColorHex) {
    return [data.customColorHex, darken(data.customColorHex, 40)];
  }
  return THEME_SOLID[data.colorTheme === 'custom' ? 'saffron' : data.colorTheme];
}

const PAID_METHOD_LABEL: Record<string, string> = {
  notSelected: '-', cash: 'Cash', qrScan: 'UPI', onlineBanking: 'Online Banking', check: 'Cheque',
};

const LABELS: Record<ReceiptCardData['receiptLanguage'], Record<string, string>> = {
  en: {
    title: 'Contribution Receipt', receiptNo: 'Receipt no.', donor: 'Donor', phone: 'Phone', billNumber: 'Bill no.', persons: 'Persons',
    payment: 'Payment', date: 'Date', collectedBy: 'Collected by', upi: 'UPI ID', regNo: 'Reg. no.',
  },
  bn: {
    title: 'অনুদান রসিদ', receiptNo: 'রসিদ নং', donor: 'দাতা', phone: 'ফোন', billNumber: 'বিল নং', persons: 'ব্যক্তি',
    payment: 'পেমেন্ট', date: 'তারিখ', collectedBy: 'সংগ্রহকারী', upi: 'UPI আইডি', regNo: 'নিবন্ধন নং',
  },
  hi: {
    title: 'योगदान रसीद', receiptNo: 'रसीद सं.', donor: 'दाता', phone: 'फ़ोन', billNumber: 'बिल सं.', persons: 'व्यक्ति',
    payment: 'भुगतान', date: 'तारीख', collectedBy: 'संग्रहकर्ता', upi: 'UPI आईडी', regNo: 'पंजी. सं.',
  },
};

// Indian-numbering (lakh/crore) amount-in-words — no library needed for
// the range receipts realistically fall in.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function threeDigitsToWords(n: number): string {
  if (n < 100) return twoDigitsToWords(n);
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigitsToWords(n % 100) : '');
}
export function amountToWords(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return 'Zero Rupees Only';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(threeDigitsToWords(crore) + ' Crore');
  if (lakh) parts.push(threeDigitsToWords(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigitsToWords(thousand) + ' Thousand');
  if (rest) parts.push(threeDigitsToWords(rest));
  return parts.join(' ') + ' Rupees Only';
}

// Temple-parapet zigzag strip, pure CSS (two diagonal gradients forming
// repeating triangles) — no image assets needed.
function TempleBorder({ color }: { color: string }) {
  return (
    <div
      className="h-2.5 w-full"
      style={{
        backgroundImage: `linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(-45deg, ${color} 25%, transparent 25%)`,
        backgroundSize: '14px 14px',
        backgroundColor: 'transparent',
      }}
    />
  );
}

export function ReceiptCard({ data }: { data: ReceiptCardData }) {
  const [c1, c2] = themeColors(data);
  const labels = LABELS[data.receiptLanguage] || LABELS.en;
  const thermal = data.paperSize === 'thermal80mm';
  const cardWidth = thermal ? 'max-w-[300px]' : 'max-w-[380px]';
  const effectiveLogo = data.headerLogoUrl || data.committeeLogo;
  const effectiveTitle = data.headerTitle || data.committeeName;
  const effectiveSub1 = data.headerSubtitle1 || data.committeeAddress;
  const effectiveSub2 = data.headerSubtitle2 || data.committeeEmail;
  const effectiveBandTitle = data.headerBandTitle || data.committeeName;
  const logoPx = HEADER_LOGO_PX[data.headerLogoSize];

  return (
    <div className={`receipt-card ${cardWidth} w-full mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden relative`}>
      {/* Subtle mandala-dot texture behind everything */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${c1}22 1px, transparent 1px)`,
          backgroundSize: '18px 18px',
          opacity: 0.5,
        }}
      />

      <div className="relative">
        <TempleBorder color={c1} />

        {(data.showLogo || data.showAddress || data.showContact) && (
          <div className="px-5 pt-4 pb-3 flex items-center gap-3">
            {data.showLogo && effectiveLogo && (
              <img
                src={effectiveLogo}
                alt=""
                className="rounded-full object-cover shrink-0 border-2"
                style={{ borderColor: c1, width: logoPx, height: logoPx }}
              />
            )}
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate" style={{ fontFamily: "'Yatra One', cursive" }}>{effectiveTitle}</p>
              {data.showAddress && effectiveSub1 && <p className="text-xs text-gray-500 truncate">{effectiveSub1}</p>}
              {data.showContact && effectiveSub2 && <p className="text-xs text-gray-500 truncate">{effectiveSub2}</p>}
              {data.showRegNo && data.committeeRegNo && <p className="text-xs text-gray-500 truncate">{labels.regNo}: {data.committeeRegNo}</p>}
            </div>
          </div>
        )}

        {data.bandMode === 'image' && data.bandImageUrl ? (
          <img src={data.bandImageUrl} alt="" className="w-full block" />
        ) : (
          <div
            className="px-5 py-5 text-center text-white relative"
            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
          >
            {data.headerSymbol && (
              <div className="relative inline-flex items-center justify-center w-14 h-14 mb-1.5">
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: '0 0 0 4px rgba(255,255,255,0.18), 0 0 0 9px rgba(255,255,255,0.1), 0 0 0 15px rgba(255,255,255,0.05)' }}
                />
                <span className="relative text-3xl leading-none">{data.headerSymbol}</span>
              </div>
            )}
            <div className="font-bold text-lg" style={{ fontFamily: "'Yatra One', cursive" }}>{effectiveBandTitle}</div>
          </div>
        )}

        <TempleBorder color={c1} />

        <div className="px-5 py-5 text-center border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 tracking-wide uppercase">{labels.title}</p>
          <p className="text-3xl font-extrabold mt-1" style={{ color: c1, fontFamily: "'Yatra One', cursive" }}>
            ₹{data.amount.toLocaleString('en-IN')}
          </p>
          {data.showAmountWords && <p className="text-xs text-gray-500 italic mt-0.5">{amountToWords(data.amount)}</p>}
        </div>

        <div className="px-5 py-3 divide-y divide-gray-100 text-sm">
          <Row label={labels.receiptNo} value={data.receiptNumber} bold />
          <Row label={labels.donor} value={data.donorName} bold />
          {data.phone && <Row label={labels.phone} value={data.phone} />}
          {data.billNumber && <Row label={labels.billNumber} value={data.billNumber} />}
          {data.showPersons && data.numPersons != null && <Row label={labels.persons} value={String(data.numPersons)} />}
          {data.showPaymentMethod && <Row label={labels.payment} value={PAID_METHOD_LABEL[data.paidMethod] || data.paidMethod} />}
          <Row label={labels.date} value={new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
          {data.showUpiId && data.upiId && <Row label={labels.upi} value={data.upiId} />}
        </div>

        {data.blessingLine && (
          <p className="text-center text-sm font-semibold px-5 pb-3" style={{ color: c1 }}>{data.blessingLine}</p>
        )}

        {(data.signatureUrl || data.sealUrl) && (
          <div className="px-5 pb-2 flex items-center justify-center gap-6">
            {data.signatureUrl && <img src={data.signatureUrl} alt="Signature" className="h-10 object-contain" />}
            {data.sealUrl && <img src={data.sealUrl} alt="Seal" className="h-14 w-14 object-contain" />}
          </div>
        )}

        <div className="px-5 pb-4 pt-2 text-right">
          <div className="inline-block border-t border-gray-300 pt-1">
            <p className="text-xs text-gray-400">{data.signatoryLabel}</p>
          </div>
        </div>

        {data.show80g && (
          <div className="px-5 pb-4 pt-3 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-500">
              {data.reg80g && <>80G Reg. No: {data.reg80g} </>}
              {data.pan && <>· PAN: {data.pan}</>}
            </p>
            {data.declarationText && <p className="text-[10px] text-gray-400 mt-1 leading-snug">{data.declarationText}</p>}
          </div>
        )}

        <TempleBorder color={c1} />
      </div>

      <style>{`
        @media print {
          .receipt-card { max-width: 100%; box-shadow: none; border: none; }
          @page { size: ${thermal ? '80mm auto' : data.orientation === 'landscape' ? 'A5 landscape' : 'A5 portrait'}; margin: ${thermal ? '2mm' : '8mm'}; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-900 text-right truncate ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}
