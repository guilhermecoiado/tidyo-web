// Invoice PDF in the client's language, with the company's payment details (Zelle, Venmo, Cash App, check)
import { translate, type Lang } from './i18n';

export type PaymentInfo = { zelle?: string; venmo?: string; cashapp?: string; check_to?: string; check_address?: string; note?: string };
export type PdfInvoice = {
  number: string; issued_on: string | null; due_on: string | null; total_cents: number; paid_cents: number;
  lines: { description: string; quantity: number; unit_cents: number; amount_cents: number }[];
};

const money = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill="#D4F1E9"/><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F"/><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35"/><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" stroke-width="7" stroke-linecap="round"/></g></svg>`;

/** The Tidyo mark as a PNG data URL (null where canvas is unavailable) */
async function logoPng(): Promise<string | null> {
  try {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVG);
    await img.decode();
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d'); if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 256, 256);
    return c.toDataURL('image/png');
  } catch { return null; }
}

export async function invoicePdf(o: { company: { name: string; address?: string | null; phone?: string | null }; client: { name: string; address?: string; email?: string | null }; inv: PdfInvoice; pay: PaymentInfo; lang: Lang }) {
  const { jsPDF } = await import('jspdf');
  const logo = await logoPng();
  const t = (k: string, p?: Record<string, string | number>) => translate(o.lang, k, p);
  const fmtDate = (d: string | null) => (d ? new Date(d + 'T12:00').toLocaleDateString(o.lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const INK: [number, number, number] = [15, 31, 28], MUTED: [number, number, number] = [86, 105, 101], ACCENT: [number, number, number] = [11, 124, 110];
  const ink = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (w: 'bold' | 'normal', size: number) => { doc.setFont('helvetica', w); doc.setFontSize(size); };
  const balance = Math.max(0, o.inv.total_cents - o.inv.paid_cents);

  // ── brand band: Tidyo mark + wordmark on the left, INVOICE + number on the right
  doc.setFillColor(10, 61, 53); doc.rect(0, 0, W, 76, 'F');
  if (logo) doc.addImage(logo, 'PNG', M, 20, 36, 36);
  font('bold', 20); doc.setTextColor(255, 255, 255);
  doc.text('Tidyo', M + (logo ? 46 : 0), 44);
  font('bold', 22); doc.setTextColor(95, 212, 193);
  doc.text(t('pdf.invoice').toUpperCase(), W - M, 40, { align: 'right' });
  font('normal', 10); doc.setTextColor(200, 226, 220);
  doc.text(o.inv.number, W - M, 56, { align: 'right' });

  // ── from (company) on the left · meta box on the right
  let y = 112;
  const metaW = 210, metaX = W - M - metaW;
  const leftW = metaX - M - 24;
  font('bold', 9); ink(MUTED); doc.text(t('pdf.from').toUpperCase(), M, y);
  y += 16; font('bold', 14); ink(INK);
  const cname = doc.splitTextToSize(o.company.name, leftW); doc.text(cname, M, y); y += 16 * cname.length;
  font('normal', 10); ink(MUTED);
  for (const l of [o.company.address, o.company.phone].filter(Boolean) as string[]) { const s2 = doc.splitTextToSize(l, leftW); doc.text(s2, M, y); y += 13 * s2.length; }

  const meta: [string, string, boolean][] = [[t('pdf.issued'), fmtDate(o.inv.issued_on), false], [t('pdf.due'), fmtDate(o.inv.due_on), false], [t('pdf.balance'), money(balance), true]];
  const metaTop = 100, rowH = 24;
  doc.setFillColor(244, 247, 246); doc.roundedRect(metaX, metaTop, metaW, rowH * meta.length + 12, 8, 8, 'F');
  meta.forEach(([k, v, strong], i) => {
    const ry = metaTop + 22 + i * rowH;
    font('bold', 9); ink(MUTED); doc.text(k.toUpperCase(), metaX + 12, ry);
    font('bold', strong ? 13 : 10.5); ink(strong ? ACCENT : INK); doc.text(v, metaX + metaW - 12, ry, { align: 'right' });
  });
  y = Math.max(y, metaTop + rowH * meta.length + 12) + 22;

  // ── bill to
  font('bold', 9); ink(MUTED); doc.text(t('pdf.billTo').toUpperCase(), M, y);
  y += 16; font('bold', 12); ink(INK); doc.text(doc.splitTextToSize(o.client.name, W - 2 * M), M, y); y += 15;
  font('normal', 10); ink(MUTED);
  if (o.client.address) { const s2 = doc.splitTextToSize(o.client.address, W - 2 * M); doc.text(s2, M, y); y += 13 * s2.length; }
  if (o.client.email) { doc.text(o.client.email, M, y); y += 13; }
  y += 20;

  // ── lines: description | qty | amount (fixed right columns, wrapped description)
  const amtX = W - M - 12, qtyX = W - M - 120, descW = qtyX - 40 - (M + 12);
  const header = () => {
    doc.setFillColor(10, 61, 53); doc.roundedRect(M, y - 15, W - 2 * M, 24, 6, 6, 'F');
    font('bold', 8.5); doc.setTextColor(255, 255, 255);
    doc.text(t('pdf.description').toUpperCase(), M + 12, y + 1);
    doc.text(t('pdf.qty').toUpperCase(), qtyX, y + 1, { align: 'right' });
    doc.text(t('pdf.amount').toUpperCase(), amtX, y + 1, { align: 'right' });
    y += 30;
  };
  header();
  for (const l of o.inv.lines) {
    font('normal', 10.5);
    const desc = doc.splitTextToSize(l.description, descW) as string[];
    const h = 14 * desc.length + 12;
    if (y + h > H - 120) { doc.addPage(); y = 64; header(); }
    ink(INK); font('normal', 10.5); doc.text(desc, M + 12, y);
    ink(MUTED); doc.text(String(Number(l.quantity)), qtyX, y, { align: 'right' });
    font('bold', 10.5); ink(INK); doc.text(money(l.amount_cents), amtX, y, { align: 'right' });
    y += h;
    doc.setDrawColor(223, 231, 229); doc.setLineWidth(0.6); doc.line(M, y - 14, W - M, y - 14);
  }

  // ── totals (right block)
  y += 4;
  const totX = W - M - 220;
  const row = (label: string, v: string, strong = false, color: [number, number, number] = INK) => {
    font(strong ? 'bold' : 'normal', strong ? 13 : 10.5); ink(strong ? color : MUTED); doc.text(label, totX, y);
    ink(color); font('bold', strong ? 13 : 10.5); doc.text(v, amtX, y, { align: 'right' }); y += strong ? 22 : 17;
  };
  row(t('pdf.total'), money(o.inv.total_cents));
  if (o.inv.paid_cents > 0) row(t('pdf.paid'), `- ${money(o.inv.paid_cents)}`, false, [11, 107, 95]);
  doc.setDrawColor(10, 61, 53); doc.setLineWidth(1); doc.line(totX, y - 9, W - M, y - 9); y += 6;
  row(t('pdf.balance'), money(balance), true, ACCENT);

  // ── how to pay
  const ways: [string, string][] = [];
  if (o.pay.zelle) ways.push(['Zelle', o.pay.zelle]);
  if (o.pay.venmo) ways.push(['Venmo', o.pay.venmo]);
  if (o.pay.cashapp) ways.push(['Cash App', o.pay.cashapp]);
  if (o.pay.check_to) ways.push([t('pdf.check'), `${t('pdf.payableTo')} ${o.pay.check_to}${o.pay.check_address ? ` · ${o.pay.check_address}` : ''}`]);
  if (ways.length || o.pay.note) {
    font('normal', 10.5);
    const valW = W - 2 * M - 28 - 96;
    const wrapped = ways.map(([k, v]) => [k, doc.splitTextToSize(v, valW) as string[]] as const);
    font('normal', 9.5);
    const note = o.pay.note ? (doc.splitTextToSize(o.pay.note, W - 2 * M - 28) as string[]) : [];
    const h = 44 + wrapped.reduce((s, [, v]) => s + 15 * v.length + 4, 0) + (note.length ? 13 * note.length + 8 : 0) + 18;
    y += 16;
    if (y + h > H - 60) { doc.addPage(); y = 64; }
    doc.setFillColor(227, 241, 238); doc.roundedRect(M, y, W - 2 * M, h, 10, 10, 'F');
    let py = y + 24;
    font('bold', 11); doc.setTextColor(11, 107, 95); doc.text(t('pdf.howToPay'), M + 14, py); py += 20;
    for (const [k, v] of wrapped) {
      font('bold', 10.5); ink(INK); doc.text(k, M + 14, py);
      font('normal', 10.5); doc.text(v, M + 14 + 96, py); py += 15 * v.length + 4;
    }
    if (note.length) { font('normal', 9.5); doc.setTextColor(62, 79, 76); doc.text(note, M + 14, py + 2); py += 13 * note.length + 8; }
    font('normal', 9); doc.setTextColor(62, 79, 76); doc.text(t('pdf.reference', { n: o.inv.number }), M + 14, py + 2);
    y += h;
  }

  // ── footer on every page: thanks + "sent with Tidyo"
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(223, 231, 229); doc.setLineWidth(0.6); doc.line(M, H - 50, W - M, H - 50);
    font('normal', 9); doc.setTextColor(120, 138, 134);
    doc.text(t('pdf.thanks'), M, H - 32);
    font('bold', 9); doc.setTextColor(10, 61, 53); doc.text('Tidyo', W - M, H - 32, { align: 'right' });
    if (logo) doc.addImage(logo, 'PNG', W - M - doc.getTextWidth('Tidyo') - 18, H - 43, 14, 14);
    if (pages > 1) { font('normal', 8); doc.setTextColor(150, 165, 160); doc.text(`${i}/${pages}`, W / 2, H - 32, { align: 'center' }); }
  }
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
