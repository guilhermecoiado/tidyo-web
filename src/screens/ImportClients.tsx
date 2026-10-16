// Importar planilha: CSV exported from Excel, Google Sheets or another app
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { C } from '../components/kit';

type Row = { name: string; email: string; phone: string; street: string; city: string; state: string; zip: string; kind: 'residential' | 'commercial' };

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const KEYS: Record<keyof Row, RegExp> = {
  name: /^(name|nome|nombre|client|cliente|customer)/i, email: /e-?mail|correo/i, phone: /phone|telefone|tel[eé]fono|celular|whats/i,
  street: /address|endere|direcci|street|rua|calle/i, city: /city|cidade|ciudad/i, state: /^(state|estado|uf)/i, zip: /zip|cep|postal/i, kind: /type|tipo|kind/i,
};

function toRows(table: string[][]): Row[] {
  const [head, ...body] = table;
  const idx = Object.fromEntries(Object.entries(KEYS).map(([k, re]) => [k, head.findIndex((h) => re.test(h.trim()))])) as Record<keyof Row, number>;
  return body.map((r) => {
    const g = (k: keyof Row) => (idx[k] >= 0 ? (r[idx[k]] || '').trim() : '');
    let street = g('street'), city = g('city'), state = g('state'), zip = g('zip');
    // "12 Elm St, Waterbury, CT 06702" in one column
    const m = !city && street.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\s*(\d{5})?/);
    if (m) { street = m[1]; city = m[2]; state = m[3].toUpperCase(); zip = m[4] || zip; }
    return { name: g('name'), email: g('email'), phone: g('phone'), street, city, state: state.toUpperCase().slice(0, 2), zip, kind: /com|offic|empres|negoc/i.test(g('kind')) ? 'commercial' : 'residential' } as Row;
  }).filter((r) => r.name);
}

export function ImportSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t, tErr, company, toast } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const read = async (f: File) => {
    setErr('');
    try {
      const r = toRows(parseCsv(await f.text()));
      if (!r.length) setErr(t('imp.noRows')); else setRows(r);
    } catch { setErr(t('imp.bad')); }
  };
  const go = async () => {
    if (!company || !rows) return;
    setBusy(true);
    const { data, error } = await supabase.from('clients').insert(rows.map((r) => ({ company_id: company.id, kind: r.kind, name: r.name, email: r.email || null, phone: r.phone || null, language: company.default_language }))).select('id');
    if (error) { setBusy(false); setErr(tErr(error.message)); return; }
    const props = (data || []).map((c: { id: string }, i: number) => ({ c, r: rows[i] })).filter(({ r }) => r.street && r.city && r.state && r.zip)
      .map(({ c, r }) => ({ company_id: company.id, client_id: c.id, address_line1: r.street, city: r.city, state: r.state, zip: r.zip }));
    if (props.length) {
      const { data: pd } = await supabase.from('properties').insert(props).select('id');
      if (pd?.length) supabase.functions.invoke('geocode', { body: { table: 'properties', ids: pd.map((p: { id: string }) => p.id) } }).then(() => undefined);
    }
    setBusy(false);
    toast(t('imp.done', { n: rows.length }));
    onDone();
  };
  const sample = 'name,email,phone,address,city,state,zip,type\nPatel Family,priya@email.com,(203) 555-0101,31 Ridge Rd,Hamden,CT,06517,residential\n';
  return (
    <Sheet title={t('cl.import')} onClose={onClose}>
      <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{t('imp.text')}</span>
      {!rows ? (
        <>
          <label className="k-btn k-btn-line" style={{ borderStyle: 'dashed', minHeight: 76, flexDirection: 'column', gap: 2, color: C.accent }}>
            {t('imp.pick')}<span style={{ fontSize: 11.5, fontWeight: 600, color: C.muted }}>CSV · Excel › {t('imp.saveAs')} CSV</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
          </label>
          <a className="k-link" style={{ alignSelf: 'flex-start' }} download="tidyo-clients.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`}>{t('imp.template')}</a>
        </>
      ) : (
        <>
          <div className="k-kv">
            <div><span>{t('imp.found')}</span><span>{rows.length}</span></div>
            <div><span>{t('imp.withAddr')}</span><span>{rows.filter((r) => r.street && r.city && r.zip).length}</span></div>
            <div><span>{t('cl.comPl')}</span><span>{rows.filter((r) => r.kind === 'commercial').length}</span></div>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 14, padding: '0 12px' }}>
            {rows.slice(0, 50).map((r, i) => <div key={i} className="k-ell" style={{ minHeight: 40, display: 'flex', alignItems: 'center', borderTop: i ? `1px solid ${C.soft}` : 0, fontSize: 13 }}><b style={{ marginRight: 6 }}>{r.name}</b><span className="k-muted">{[r.street, r.city].filter(Boolean).join(', ')}</span></div>)}
          </div>
        </>
      )}
      {err && <span className="k-err" role="alert">{err}</span>}
      {rows && <div className="k-pair"><button className="k-btn k-btn-line" onClick={() => setRows(null)}>{t('c.back')}</button><button className="k-btn k-btn-fill" disabled={busy} onClick={go}>{t('imp.go', { n: rows.length })}</button></div>}
    </Sheet>
  );
}
