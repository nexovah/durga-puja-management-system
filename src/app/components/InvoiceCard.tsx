// Offscreen-rendered invoice template — same html2canvas+jsPDF pattern
// already used by ReceiptCard.tsx/ReceiptModal.tsx for collection
// receipts, reused here for a billing invoice instead. Layout follows a
// standard invoice structure (From/Bill-to, invoice #/date, line item,
// total, footer) — not any specific brand's template.

export interface InvoiceCardData {
  invoiceNumber: string;
  date: string;
  fromName: string;
  fromEmail: string;
  fromPhone: string;
  billToName: string;
  billToAddress: string;
  billToEmail: string;
  planLabel: string;
  amountPaise: number;
  currency: string;
}

const CAPTURE_ID = 'invoice-card-capture';

export function InvoiceCard({ data }: { data: InvoiceCardData }) {
  const amount = (data.amountPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: data.currency });
  const dateLabel = new Date(data.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });

  return (
    <div
      id={CAPTURE_ID}
      style={{
        width: 720,
        padding: 48,
        background: '#ffffff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#1f2937',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>FROM</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{data.fromName}</div>
          {data.fromEmail && <div style={{ fontSize: 13, color: '#4b5563' }}>{data.fromEmail}</div>}
          {data.fromPhone && <div style={{ fontSize: 13, color: '#4b5563' }}>{data.fromPhone}</div>}

          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginTop: 24, marginBottom: 8 }}>BILL TO</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{data.billToName}</div>
          {data.billToAddress && <div style={{ fontSize: 13, color: '#4b5563', maxWidth: 260 }}>{data.billToAddress}</div>}
          {data.billToEmail && <div style={{ fontSize: 13, color: '#4b5563' }}>{data.billToEmail}</div>}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ background: '#f3f4f6', padding: '10px 20px', borderRadius: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>INVOICE</div>
          </div>
          <table style={{ marginTop: 16, fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ color: '#6b7280', paddingRight: 16, textAlign: 'left' }}>Invoice #</td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{data.invoiceNumber}</td>
              </tr>
              <tr>
                <td style={{ color: '#6b7280', paddingRight: 16, textAlign: 'left' }}>Date</td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{dateLabel}</td>
              </tr>
              <tr>
                <td style={{ color: '#6b7280', paddingRight: 16, textAlign: 'left' }}>Total Amount</td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{amount}</td>
              </tr>
              <tr>
                <td style={{ color: '#6b7280', paddingRight: 16, textAlign: 'left', fontWeight: 700 }}>Total Paid</td>
                <td style={{ fontWeight: 800, textAlign: 'right' }}>{amount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <table style={{ width: '100%', marginTop: 40, borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700 }}>Description</th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <td style={{ padding: '12px' }}>{data.planLabel}</td>
            <td style={{ padding: '12px', textAlign: 'right' }}>{amount}</td>
          </tr>
          <tr>
            <td style={{ padding: '12px', fontWeight: 700, textAlign: 'right' }}>Total</td>
            <td style={{ padding: '12px', fontWeight: 800, textAlign: 'right' }}>{amount}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 56, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Invoice created via</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#ea580c' }}>Durga CRM</span>
      </div>
    </div>
  );
}

export async function downloadInvoicePdf(invoiceId: string) {
  const el = document.getElementById(CAPTURE_ID);
  if (!el) return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  const widthMm = 190;
  const heightMm = (canvas.height / canvas.width) * widthMm;
  const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] });
  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
  pdf.save(`invoice-${invoiceId.slice(0, 8)}.pdf`);
}
