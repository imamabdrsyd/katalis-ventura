import { isIP } from 'net';

export const OCR_DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;
const OCR_DOWNLOAD_TIMEOUT_MS = 15_000;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export class OcrDownloadError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'OcrDownloadError';
  }
}

export async function downloadOcrSource(
  imageUrl: string,
  businessId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const url = parseAndValidateOcrSourceUrl(imageUrl, businessId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_DOWNLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'image/jpeg,image/png,image/webp,application/pdf',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      throw new OcrDownloadError('Redirect URL gambar tidak diizinkan', 400);
    }

    if (!res.ok) {
      throw new OcrDownloadError(`Gagal mengunduh gambar (HTTP ${res.status})`, 400);
    }

    const contentLength = parseContentLength(res.headers.get('content-length'));
    if (contentLength !== null && contentLength > OCR_DOWNLOAD_MAX_BYTES) {
      throw new OcrDownloadError('Ukuran gambar melebihi 10MB', 413);
    }

    const mimeType = normalizeMimeType(res.headers.get('content-type'));
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new OcrDownloadError('Format file OCR tidak didukung', 415);
    }

    const buffer = await readBodyWithLimit(res, OCR_DOWNLOAD_MAX_BYTES);
    return { buffer, mimeType };
  } catch (err) {
    if (err instanceof OcrDownloadError) throw err;

    if (err instanceof Error && err.name === 'AbortError') {
      throw new OcrDownloadError('Waktu mengunduh gambar habis', 408);
    }

    throw new OcrDownloadError('Gagal mengunduh gambar', 400);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseAndValidateOcrSourceUrl(imageUrl: string, businessId: string): URL {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new OcrDownloadError('image_url harus URL valid', 400);
  }

  if (url.protocol !== 'https:') {
    throw new OcrDownloadError('image_url harus https', 400);
  }

  if (isInternalHostname(url.hostname)) {
    throw new OcrDownloadError('Host image_url tidak diizinkan', 400);
  }

  if (isAllowedCloudinaryAttachmentUrl(url, businessId)) {
    return url;
  }

  if (isAllowedSupabaseStorageUrl(url)) {
    return url;
  }

  throw new OcrDownloadError('Host image_url tidak diizinkan', 400);
}

async function readBodyWithLimit(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new OcrDownloadError('Body gambar tidak dapat dibaca', 400);
  }

  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new OcrDownloadError('Ukuran gambar melebihi 10MB', 413);
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
}

function isAllowedCloudinaryAttachmentUrl(url: URL, businessId: string): boolean {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName || url.hostname !== 'res.cloudinary.com') return false;

  const pattern = new RegExp(
    [
      '^',
      '/',
      escapeRegExp(cloudName),
      '/(?:image|raw)/upload/',
      '(?:v\\d+/)?',
      'axion/attachments/',
      escapeRegExp(businessId),
      '/.+',
      '$',
    ].join('')
  );

  return pattern.test(url.pathname);
}

function isAllowedSupabaseStorageUrl(url: URL): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;

  let expected: URL;
  try {
    expected = new URL(supabaseUrl);
  } catch {
    return false;
  }

  if (url.origin !== expected.origin) return false;

  return (
    url.pathname.startsWith('/storage/v1/object/public/') ||
    url.pathname.startsWith('/storage/v1/object/sign/')
  );
}

function normalizeMimeType(contentType: string | null): string | null {
  const mime = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (!mime) return null;
  if (mime === 'image/jpg') return 'image/jpeg';
  return mime;
}

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function isInternalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateIpv4(host);
  if (ipVersion === 6) return isPrivateIpv6(host);

  return false;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(host: string): boolean {
  return (
    host === '::' ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:')
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
