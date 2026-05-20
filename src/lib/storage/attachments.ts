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

export async function uploadAttachment(
  businessId: string,
  file: File
): Promise<TransactionAttachment> {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  // Cloudinary memisahkan PDF (resource_type=raw) dan gambar (resource_type=image).
  // PDF yang di-upload ke /image/upload tidak bisa di-deliver tanpa add-on PDF.
  // Pakai /auto/upload supaya Cloudinary auto-detect: PDF jadi raw, image jadi image.
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', `axion/attachments/${businessId}`);

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
