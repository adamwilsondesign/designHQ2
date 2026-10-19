import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { functions, storage } from '../lib/firebase';

export async function callFunction<Req, Res>(name: string, data: Req): Promise<Res> {
  try {
    const res = await httpsCallable<Req, Res>(functions, name)(data);
    return res.data;
  } catch (err: any) {
    // Callable errors carry a readable message from HttpsError.
    throw new Error(err?.message || String(err));
  }
}

export function uploadFile(path: string, file: File | Blob, onProgress?: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on(
      'state_changed',
      snap => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve(path),
    );
  });
}

export const downloadUrl = (path: string) => getDownloadURL(ref(storage, path));

export const safeFileName = (name: string) => name.replace(/[^a-z0-9._-]+/gi, '_');

export const nowIso = () => new Date().toISOString();

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Starts a browser download. Used after async work, where window.open would be
// treated as a popup and blocked.
export function triggerDownload(url: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = url;
  if (fileName) a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
