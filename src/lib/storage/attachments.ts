import { createClient } from '@/lib/supabase';
import type { TransactionAttachment } from '@/types';

const BUCKET = 'transaction-attachments';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

  const supabase = createClient();
  const ext = getExtension(file.name);
  const path = `${businessId}/${generateId()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '31536000', // 1 year cache
      upsert: false,
    });

  if (error) throw new Error(`Gagal mengupload file: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return {
    path,
    url: publicUrl,
    filename: file.name,
    size: file.size,
    mime_type: file.type || `image/${ext}`,
    uploaded_at: new Date().toISOString(),
  };
}

export async function deleteAttachment(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error('Failed to delete attachment:', error);
  }
}
