import { supabase } from './supabase';

export type Photo = { id: string; kind: 'before' | 'after' | 'issue' | 'inspection'; storage_path: string; taken_at: string; url?: string };
export type CheckItem = { id: string; room: string; task: string; position: number; done_at: string | null };

// Phone photos are large; shrink to 1600px JPEG before upload.
export async function compressImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b || file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}

export async function uploadJobPhoto(companyId: string, jobId: string, membershipId: string | null, kind: 'before' | 'after', file: File) {
  const blob = await compressImage(file);
  const path = `${companyId}/${jobId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('job-photos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { error: e2 } = await supabase.from('job_photos').insert({ job_id: jobId, company_id: companyId, kind, storage_path: path, uploaded_by: membershipId });
  if (e2) throw e2;
}

export async function getJobPhotos(jobId: string): Promise<Photo[]> {
  const { data } = await supabase.from('job_photos').select('id, kind, storage_path, taken_at').eq('job_id', jobId).order('taken_at');
  const list = (data || []) as Photo[];
  if (!list.length) return list;
  const { data: signed } = await supabase.storage.from('job-photos').createSignedUrls(list.map((p) => p.storage_path), 3600);
  const map = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
  return list.map((p) => ({ ...p, url: map.get(p.storage_path) || undefined }));
}

export async function getChecklist(jobId: string): Promise<CheckItem[]> {
  const { data, error } = await supabase.rpc('job_checklist', { p_job: jobId });
  if (error) throw error;
  return (data || []) as CheckItem[];
}
