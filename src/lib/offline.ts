// Offline support for the field app: cached reads and a queue of writes that replays when the signal returns.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// ── cached reads (small JSON) ──
export function cacheSet(key: string, value: unknown) { try { localStorage.setItem(`tidyo.cache.${key}`, JSON.stringify(value)); } catch { /* full or blocked */ } }
export function cacheGet<T>(key: string): T | null { try { const v = localStorage.getItem(`tidyo.cache.${key}`); return v ? JSON.parse(v) as T : null; } catch { return null; } }

// ── write queue in IndexedDB (photos included) ──
export type Op =
  | { kind: 'rpc'; fn: string; args: Record<string, unknown> }
  | { kind: 'insert'; table: string; row: Record<string, unknown> }
  | { kind: 'update'; table: string; id: string; patch: Record<string, unknown> }
  | { kind: 'upload'; bucket: string; path: string; blob: Blob; table: string; row: Record<string, unknown> };
type Stored = { id?: number; op: Op; at: number; tries: number };

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('tidyo-offline', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('ops', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const req = fn(d.transaction('ops', mode).objectStore('ops')); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

export async function pendingCount() { try { return await tx<number>('readonly', (s) => s.count()); } catch { return 0; } }

export const isNetworkError = (e: unknown) => {
  const m = String((e as { message?: string })?.message || e || '');
  return !navigator.onLine || /fetch|network|load failed|timeout/i.test(m);
};

async function run(op: Op) {
  if (op.kind === 'rpc') { const { error } = await supabase.rpc(op.fn, op.args); if (error) throw error; }
  else if (op.kind === 'insert') { const { error } = await supabase.from(op.table).upsert(op.row, { onConflict: 'id', ignoreDuplicates: true }); if (error) throw error; }
  else if (op.kind === 'update') { const { error } = await supabase.from(op.table).update(op.patch).eq('id', op.id); if (error) throw error; }
  else {
    const up = await supabase.storage.from(op.bucket).upload(op.path, op.blob, { contentType: op.blob.type || 'image/jpeg', upsert: true });
    if (up.error && !/exists/i.test(up.error.message)) throw up.error;
    const { error } = await supabase.from(op.table).upsert(op.row, { onConflict: 'id', ignoreDuplicates: true }); if (error) throw error;
  }
}

// Try now; if there is no signal, keep it for later. Business errors (permissions, rules) are returned.
export async function perform(op: Op): Promise<{ queued: boolean; error?: string }> {
  if (navigator.onLine) {
    try { await run(op); return { queued: false }; }
    catch (e) { if (!isNetworkError(e)) return { queued: false, error: (e as Error).message }; }
  }
  await tx('readwrite', (s) => s.add({ op, at: Date.now(), tries: 0 } as Stored));
  changed();
  return { queued: true };
}

let flushing = false;
export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const all = await tx<Stored[]>('readonly', (s) => s.getAll() as IDBRequest<Stored[]>);
    for (const item of all) {
      try { await run(item.op); await tx('readwrite', (s) => s.delete(item.id!)); }
      catch (e) {
        if (isNetworkError(e)) break;
        // rule rejected it (e.g. job already finished by someone else): drop after 3 tries
        if (item.tries >= 2) await tx('readwrite', (s) => s.delete(item.id!));
        else await tx('readwrite', (s) => s.put({ ...item, tries: item.tries + 1 }));
      }
    }
  } finally { flushing = false; changed(); }
}

export function useOffline() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const refresh = () => { pendingCount().then(setPending); };
    const on = () => { setOnline(true); flush(); };
    const off = () => setOnline(false);
    listeners.add(refresh);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    refresh(); flush();
    const i = window.setInterval(() => flush(), 30000);
    return () => { listeners.delete(refresh); window.removeEventListener('online', on); window.removeEventListener('offline', off); window.clearInterval(i); };
  }, []);
  return { online, pending };
}
