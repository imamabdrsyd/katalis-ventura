import type { TransactionAttachment } from '@/types';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 3;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

export { MAX_FILES };

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || 'file';
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE) {
    return `File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)}MB). Maksimal 5MB.`;
  }
  const ext = getExtension(file.name);
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.';
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Unduh file lampiran ke perangkat (memicu download, BUKAN buka di tab browser).
 * Ambil sebagai blob lalu trigger anchor download — bekerja lintas-origin
 * (Cloudinary mengirim CORS permisif) dan tetap kompatibel saat URL sudah signed.
 * `url` harus URL yang siap pakai (sudah di-resolve/sign bila perlu).
 */
export async function downloadAttachment(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal mengunduh file');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'lampiran';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Buat entry attachment "pending" — file masih di memori, BELUM diupload ke
 * Cloudinary. Dipakai mode defer upload: file baru naik ke Cloudinary hanya saat
 * transaksi benar-benar disimpan (lihat uploadPendingAttachments). Kalau user
 * cancel, entry ini dibuang tanpa pernah menyentuh Cloudinary.
 *
 * `url` diisi object URL lokal (URL.createObjectURL) untuk preview; pemanggil
 * wajib URL.revokeObjectURL saat entry dihapus / komponen unmount.
 */
export function makePendingAttachment(
  file: File,
  source: 'manual' | 'ocr' = 'manual'
): TransactionAttachment {
  return {
    path: '',
    url: URL.createObjectURL(file),
    filename: file.name,
    size: file.size,
    mime_type: file.type || `image/${getExtension(file.name)}`,
    uploaded_at: new Date().toISOString(),
    resource_type: file.type === 'application/pdf' ? 'raw' : 'image',
    source,
    pendingFile: file,
  };
}

export function isPendingAttachment(att: TransactionAttachment): boolean {
  return !!att.pendingFile;
}

/**
 * Upload semua attachment pending ke Cloudinary lalu kembalikan list bersih
 * (siap dipersist): entry pending diganti hasil upload, entry yang sudah ber-URL
 * dilewatkan apa adanya dengan field transient `pendingFile` dibuang.
 */
export async function uploadPendingAttachments(
  businessId: string,
  list: TransactionAttachment[]
): Promise<TransactionAttachment[]> {
  const out: TransactionAttachment[] = [];
  for (const att of list) {
    if (att.pendingFile) {
      out.push(await uploadAttachment(businessId, att.pendingFile, att.source ?? 'manual'));
    } else {
      const { pendingFile: _drop, ...rest } = att;
      out.push(rest);
    }
  }
  return out;
}

export async function uploadAttachment(
  businessId: string,
  file: File,
  source: 'manual' | 'ocr' = 'manual'
): Promise<TransactionAttachment> {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  // Signed upload: server menandatangani param dengan type=authenticated supaya
  // lampiran langsung private (tidak bisa diakses tanpa signed URL). Berbeda dari
  // galeri link-in-bio yang tetap pakai preset unsigned publik.
  const signRes = await fetch(
    `/api/transactions/attachments/upload-sign?businessId=${encodeURIComponent(businessId)}`,
    { credentials: 'include' }
  );
  if (!signRes.ok) throw new Error('Gagal menyiapkan upload lampiran');
  const { data: sign } = await signRes.json();
  const { cloudName, apiKey, timestamp, folder, type, signature } = sign;

  // Cloudinary memisahkan PDF (resource_type=raw) dan gambar (resource_type=image).
  // Pakai /auto/upload supaya Cloudinary auto-detect: PDF jadi raw, image jadi image.
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('folder', folder);
  formData.append('type', type);
  formData.append('signature', signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Gagal upload ke Cloudinary');
  }
  const { secure_url, public_id, resource_type } = await res.json();

  return {
    path: public_id,
    url: secure_url,
    filename: file.name,
    size: file.size,
    mime_type: file.type || `image/${getExtension(file.name)}`,
    uploaded_at: new Date().toISOString(),
    resource_type: resource_type || 'image',
    source,
  };
}

export async function deleteAttachment(
  publicId: string,
  businessId: string,
  resourceType: 'image' | 'raw' | 'video' = 'image'
): Promise<void> {
  await fetch(
    `/api/transactions/attachments?public_id=${encodeURIComponent(publicId)}&businessId=${encodeURIComponent(businessId)}&resource_type=${encodeURIComponent(resourceType)}`,
    { method: 'DELETE' }
  ).catch(() => {});
}
