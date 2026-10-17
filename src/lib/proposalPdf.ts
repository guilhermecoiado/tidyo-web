// Commercial proposal PDF in the client's language: scope, schedule, monthly price, term and how to accept
import { translate, type Lang } from './i18n';
import { logoPng } from './invoicePdf';

export type ProposalData = {
  company: { name: string; phone?: string | null };
  client: { name: string };
  address?: string | null;
  monthly_cents: number;
  hours_per_week?: number | null;
  starts_on?: string | null;
  renews_on?: string | null;
  walkthrough?: { weekdays?: number[]; after?: string; sqft?: number; rooms?: number; baths?: number; per_visit_cents?: number } | null;
  lang: Lang;
};

const money = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export async function proposalPdf(o: ProposalData) {
  const { jsPDF } = await import('jspdf');
  const logo = await logoPng();
  const t = (k: string, p?: Record<string, string | number>) => translate(o.lang, k, p);
  const fmt = (d: string | null | undefined) => (d ? new Date(d + 'T12:00').toLocaleDateString(o.lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48;
  const INK: [number, number, number] = [15, 31, 28], MUTED: [number, number, number] = [86, 105, 101], ACCENT: [number, number, number] = [11, 124, 110];
  const ink = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (w: 'bold' | 'normal', size: number) => { doc.setFont('helvetica', w); doc.setFontSize(size); };
  const w = o.walkthrough || {};

  // band
  doc.setFillColor(10, 61, 53); doc.rect(0, 0, W, 76, 'F');
  if (logo) doc.addImage(logo, 'PNG', M, 20, 36, 36);
  font('bold', 18); doc.setTextColor(255, 255, 255);
  doc.text(doc.splitTextToSize(o.company.name, W / 2 - M) as string[], M + (logo ? 46 : 0), 44);
  font('bold', 22); doc.setTextColor(95, 212, 193); doc.text(t('pp.title').toUpperCase(), W - M, 40, { align: 'right' });
  font('normal', 10); doc.setTextColor(200, 226, 220); doc.text(t('pp.date', { d: fmt(new Date().toISOString().slice(0, 10)) }), W - M, 56, { align: 'right' });

  let y = 116;
  font('bold', 9); ink(MUTED); doc.text(t('pp.for').toUpperCase(), M, y);
  y += 18; font('bold', 16); ink(INK); doc.text(doc.splitTextToSize(o.client.name, W - 2 * M) as string[], M, y); y += 16;
  if (o.address) { font('normal', 10.5); ink(MUTED); doc.text(doc.splitTextToSize(o.address, W - 2 * M) as string[], M, y); y += 14; }
  y += 18;

  // price box
  doc.setFillColor(227, 241, 238); doc.roundedRect(M, y, W - 2 * M, 74, 10, 10, 'F');
  font('bold', 10); doc.setTextColor(11, 107, 95); doc.text(t('pp.investment').toUpperCase(), M + 16, y + 24);
  font('bold', 26); ink(ACCENT); doc.text(`${money(o.monthly_cents)}${t('pp.perMonth')}`, M + 16, y + 56);
  if (w.per_visit_cents) { font('normal', 10.5); ink(MUTED); doc.text(t('pp.perVisit', { v: money(w.per_visit_cents) }), W - M - 16, y + 56, { align: 'right' }); }
  y += 74 + 28;

  // scope rows
  const days = (w.weekdays || []).map((d) => new Date(2023, 0, 1 + d).toLocaleDateString(o.lang, { weekday: 'long' })).join(', ');
  const after = w.after ? new Date(`2023-01-01T${w.after}`).toLocaleTimeString(o.lang, { hour: 'numeric', minute: '2-digit' }) : '';
  const rows: [string, string][] = ([
    [t('pp.schedule'), [days, after ? t('pp.after', { t: after }) : ''].filter(Boolean).join(' · ')],
    [t('pp.space'), [w.sqft ? `${w.sqft.toLocaleString('en-US')} sq ft` : '', w.rooms ? t('pp.rooms', { n: w.rooms }) : '', w.baths ? t('pp.baths', { n: w.baths }) : ''].filter(Boolean).join(' · ')],
    [t('pp.hours'), o.hours_per_week ? t('pp.hoursV', { n: o.hours_per_week }) : ''],
    [t('pp.term'), [fmt(o.starts_on), fmt(o.renews_on)].filter(Boolean).join(' – ')],
  ] as [string, string][]).filter(([, v]) => v);
  font('bold', 12); ink(INK); doc.text(t('pp.scope'), M, y); y += 14;
  for (const [k, v] of rows) {
    doc.setDrawColor(223, 231, 229); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 20;
    font('normal', 10); ink(MUTED); doc.text(k, M, y);
    font('bold', 10.5); ink(INK); const lines = doc.splitTextToSize(v, W - 2 * M - 150) as string[]; doc.text(lines, M + 150, y); y += 14 * lines.length + 2;
  }
  y += 18;

  // included
  font('bold', 12); ink(INK); doc.text(t('pp.included'), M, y); y += 18;
  for (const k of ['pp.i1', 'pp.i2', 'pp.i3', 'pp.i4', 'pp.i5']) {
    font('normal', 10.5); ink(INK);
    const lines = doc.splitTextToSize(t(k), W - 2 * M - 18) as string[];
    doc.setFillColor(11, 124, 110); doc.circle(M + 4, y - 3.5, 2.6, 'F');
    doc.text(lines, M + 16, y); y += 15 * lines.length + 3;
  }
  y += 16;

  // how to accept
  if (y > H - 150) { doc.addPage(); y = 64; }
  doc.setFillColor(244, 247, 246); doc.roundedRect(M, y, W - 2 * M, 64, 10, 10, 'F');
  font('bold', 11); ink(INK); doc.text(t('pp.accept'), M + 14, y + 24);
  font('normal', 10); ink(MUTED); doc.text(doc.splitTextToSize(t('pp.acceptText', { company: o.company.name }), W - 2 * M - 28) as string[], M + 14, y + 42);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(223, 231, 229); doc.setLineWidth(0.6); doc.line(M, H - 50, W - M, H - 50);
    font('normal', 9); doc.setTextColor(120, 138, 134); doc.text(t('pp.valid'), M, H - 32);
    font('bold', 9); doc.setTextColor(10, 61, 53); doc.text('Tidyo by YEHI', W - M, H - 32, { align: 'right' });
  }
  return doc.output('blob') as Blob;
}
