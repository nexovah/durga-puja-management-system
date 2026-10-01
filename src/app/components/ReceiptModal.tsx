import { useRef, useState } from 'react';
import { X, MessageCircle, Link as LinkIcon, Mail, FileDown, Check } from 'lucide-react';
import { Chanda, CommitteeInfo } from '../App';
import { ReceiptSettings } from '../lib/db';
import { ReceiptCard, ReceiptCardData } from './ReceiptCard';

interface ReceiptModalProps {
  chanda: Chanda;
  committeeInfo: CommitteeInfo;
  receiptSettings: ReceiptSettings;
  tenantSlug: string | null;
  onClose: () => void;
}

export function ReceiptModal({ chanda, committeeInfo, receiptSettings, tenantSlug, onClose }: ReceiptModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const data: ReceiptCardData = {
    committeeName: committeeInfo.name || 'Committee',
    committeeAddress: committeeInfo.address || null,
    committeeEmail: committeeInfo.email || null,
    committeePhone: committeeInfo.mobile1 || committeeInfo.phone || null,
    committeeLogo: committeeInfo.logo || null,
    committeeRegNo: committeeInfo.regNumber || null,
    receiptNumber: chanda.receiptNumber || '-',
    donorName: chanda.donorName,
    phone: chanda.phone || null,
    billNumber: chanda.billNumber || null,
    numPersons: chanda.numPersons ?? null,
    amount: chanda.amount,
    paidMethod: chanda.paidMethod,
    date: chanda.date,
    collectedBy: chanda.collectedBy || null,
    colorTheme: receiptSettings.colorTheme,
    customColorHex: receiptSettings.customColorHex || null,
    headerSymbol: receiptSettings.headerSymbol,
    blessingLine: receiptSettings.blessingLine,
    receiptLanguage: receiptSettings.receiptLanguage,
    showAmountWords: receiptSettings.showAmountWords,
    showPersons: receiptSettings.showPersons,
    showPaymentMethod: receiptSettings.showPaymentMethod,
    showCollectedBy: receiptSettings.showCollectedBy,
    showLogo: receiptSettings.showLogo,
    showAddress: receiptSettings.showAddress,
    showContact: receiptSettings.showContact,
    showRegNo: receiptSettings.showRegNo,
    showUpiId: receiptSettings.showUpiId,
    upiId: receiptSettings.upiId || null,
    signatoryLabel: receiptSettings.signatoryLabel,
    signatureUrl: receiptSettings.signatureUrl || null,
    sealUrl: receiptSettings.sealUrl || null,
    show80g: receiptSettings.show80g,
    reg80g: receiptSettings.reg80g || null,
    pan: receiptSettings.pan || null,
    declarationText: receiptSettings.declarationText || null,
    paperSize: receiptSettings.paperSize,
    orientation: receiptSettings.orientation,
    headerLogoUrl: receiptSettings.headerLogoUrl || null,
    headerLogoSize: receiptSettings.headerLogoSize,
    headerTitle: receiptSettings.headerTitle || null,
    headerSubtitle1: receiptSettings.headerSubtitle1 || null,
    headerSubtitle2: receiptSettings.headerSubtitle2 || null,
    headerBandTitle: receiptSettings.headerBandTitle || null,
    bandMode: receiptSettings.bandMode,
    bandImageUrl: receiptSettings.bandImageUrl || null,
  };

  const publicUrl = tenantSlug
    ? `${window.location.origin}/${tenantSlug}/receipt/${chanda.receiptToken}`
    : '';

  const handleWhatsApp = () => {
    const text = `Your contribution receipt (${data.receiptNumber}) from ${data.committeeName}: ${publicUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleEmail = () => {
    const subject = `Your contribution receipt ${data.receiptNumber}`;
    const body = `Please find your receipt here: ${publicUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleDownloadPdf = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const widthMm = 100;
      const heightMm = (canvas.height / canvas.width) * widthMm;
      const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] });
      pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
      pdf.save(`receipt-${data.receiptNumber}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Contribution receipt</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Receipt {data.receiptNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-950">
          <div ref={cardRef}>
            <ReceiptCard data={data} />
          </div>
        </div>

        <div className="p-6 pt-0 space-y-2">
          <button
            onClick={handleWhatsApp}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
          >
            <MessageCircle size={18} />
            Send on WhatsApp
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
            >
              <FileDown size={16} />
              {downloading ? '…' : 'PDF'}
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <LinkIcon size={16} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              onClick={handleEmail}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Mail size={16} />
              Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
