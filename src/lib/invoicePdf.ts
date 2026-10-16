// Invoice PDF in the client's language, with the company's payment details (Zelle, Venmo, Cash App, check)
import { translate, type Lang } from './i18n';

export type PaymentInfo = { zelle?: string; venmo?: string; cashapp?: string; check_to?: string; check_address?: string; note?: string };
export type PdfInvoice = {
  number: string; issued_on: string | null; due_on: string | null; total_cents: number; paid_cents: number;
  lines: { description: string; quantity: number; unit_cents: number; amount_cents: number }[];
};

const money = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function invoicePdf(o: { company: { name: string; address?: string | null; phone?: string | null }; client: { name: string; address?: string; email?: string | null }; inv: PdfInvoice; pay: PaymentInfo; lang: Lang }) {
  const { jsPDF } = await import('jspdf');
  const t = (k: string, p?: Record<string, string | number>) => translate(o.lang, k, p);
  const fmtDate = (d: string | null) => (d ? new Date(d + 'T12:00').toLocaleDateString(o.lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;
  // header band
  doc.setFillColor(10, 61, 53); doc.rect(0, 0, W, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(15, 31, 28);
  doc.text(o.company.name, M, y);
  doc.setFontSize(26); doc.setTextColor(11, 124, 110);
  doc.text(t('pdf.invoice'), W - M, y, { align: 'right' });
  y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(86, 105, 101);
  if (o.company.address) { doc.text(o.company.address, M, y); }
  doc.text(o.inv.number, W - M, y, { align: 'right' });
  y += 34;
  // bill to / dates
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(86, 105, 101);
  doc.text(t('pdf.billTo').toUpperCase(), M, y);
  doc.text(t('pdf.issued').toUpperCase(), W - M - 150, y);
  doc.text(t('pdf.due').toUpperCase(), W - M, y, { align: 'right' });
  y += 15;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(15, 31, 28);
  doc.text(o.client.name, M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(fmtDate(o.inv.issued_on), W - M - 150, y);
  doc.text(fmtDate(o.inv.due_on), W - M, y, { align: 'right' });
  y += 14;
  doc.setFontSize(10); doc.setTextColor(86, 105, 101);
  if (o.client.address) { doc.text(o.client.address, M, y); y += 13; }
  if (o.client.email) { doc.text(o.client.email, M, y); y += 13; }
  y += 18;
  // lines
  doc.setFillColor(244, 247, 246); doc.roundedRect(M, y - 14, W - 2 * M, 24, 6, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(86, 105, 101);
  doc.text(t('pdf.description').toUpperCase(), M + 10, y + 2);
  doc.text(t('pdf.qty').toUpperCase(), W - M - 170, y + 2, { align: 'right' });
  doc.text(t('pdf.amount').toUpperCase(), W - M - 10, y + 2, { align: 'right' });
  y += 28;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(15, 31, 28);
  for (const l of o.inv.lines) {
    const desc = doc.splitTextToSize(l.description, W - 2 * M - 220);
    doc.text(desc, M + 10, y);
    doc.text(String(Number(l.quantity)), W - M - 170, y, { align: 'right' });
    doc.text(money(l.amount_cents), W - M - 10, y, { align: 'right' });
    y += 16 * desc.length + 6;
    doc.setDrawColor(223, 231, 229); doc.line(M, y - 10, W - M, y - 10);
    if (y > 640) { doc.addPage(); y = 56; }
  }
  // totals
  y += 6;
  const row = (label: string, v: string, bold = false, color: [number, number, number] = [15, 31, 28]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 14 : 11); doc.setTextColor(...color);
    doc.text(label, W - M - 170, y); doc.text(v, W - M - 10, y, { align: 'right' }); y += bold ? 22 : 17;
  };
  row(t('pdf.total'), money(o.inv.total_cents));
  if (o.inv.paid_cents > 0) row(t('pdf.paid'), `- ${money(o.inv.paid_cents)}`, false, [11, 107, 95]);
  row(t('pdf.balance'), money(Math.max(0, o.inv.total_cents - o.inv.paid_cents)), true, [11, 124, 110]);
  // how to pay
  const ways: [string, string][] = [];
  if (o.pay.zelle) ways.push(['Zelle', o.pay.zelle]);
  if (o.pay.venmo) ways.push(['Venmo', o.pay.venmo]);
  if (o.pay.cashapp) ways.push(['Cash App', o.pay.cashapp]);
  if (o.pay.check_to) ways.push([t('pdf.check'), `${t('pdf.payableTo')} ${o.pay.check_to}${o.pay.check_address ? ` · ${o.pay.check_address}` : ''}`]);
  if (ways.length || o.pay.note) {
    y += 18;
    const h = 30 + ways.length * 18 + (o.pay.note ? 30 : 0);
    doc.setFillColor(227, 241, 238); doc.roundedRect(M, y - 16, W - 2 * M, h, 10, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 107, 95);
    doc.text(t('pdf.howToPay'), M + 14, y + 2); y += 22;
    doc.setFontSize(11);
    for (const [k, v] of ways) { doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 31, 28); doc.text(k, M + 14, y); doc.setFont('helvetica', 'normal'); doc.text(v, M + 110, y); y += 18; }
    if (o.pay.note) { doc.setFontSize(10); doc.setTextColor(62, 79, 76); doc.text(doc.splitTextToSize(o.pay.note, W - 2 * M - 28), M + 14, y + 4); y += 30; }
    doc.setFontSize(9); doc.setTextColor(62, 79, 76); doc.text(t('pdf.reference', { n: o.inv.number }), M + 14, y + 2);
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(150, 165, 160);
  doc.text(t('pdf.thanks'), M, doc.internal.pageSize.getHeight() - 36);
  return doc.output('blob') as Blob;
}

/** Share sheet on phones (WhatsApp, Messages, Mail); download elsewhere. Returns true when the share sheet opened. */
export async function shareFile(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return true; } catch { /* closed */ return true; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return false;
}
