import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadOcrSource,
  OCR_DOWNLOAD_MAX_BYTES,
  OcrDownloadError,
  parseAndValidateOcrSourceUrl,
} from '@/lib/ocr/download';

const BUSINESS_ID = '11111111-1111-4111-8111-111111111111';
const CLOUDINARY_URL =
  `https://res.cloudinary.com/du0yzzbwf/image/upload/v123/axion/attachments/${BUSINESS_ID}/receipt.jpg`;

describe('parseAndValidateOcrSourceUrl', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'du0yzzbwf');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://vrtubmgeipellkfsfdbc.supabase.co');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows Cloudinary attachment URLs for the same business folder', () => {
    const url = parseAndValidateOcrSourceUrl(CLOUDINARY_URL, BUSINESS_ID);

    expect(url.href).toBe(CLOUDINARY_URL);
  });

  it('allows Supabase Storage public and signed URLs for the configured project', () => {
    expect(() =>
      parseAndValidateOcrSourceUrl(
        'https://vrtubmgeipellkfsfdbc.supabase.co/storage/v1/object/public/receipts/a.jpg',
        BUSINESS_ID
      )
    ).not.toThrow();

    expect(() =>
      parseAndValidateOcrSourceUrl(
        'https://vrtubmgeipellkfsfdbc.supabase.co/storage/v1/object/sign/receipts/a.jpg?token=abc',
        BUSINESS_ID
      )
    ).not.toThrow();
  });

  it('rejects arbitrary HTTPS hosts', () => {
    expect(() =>
      parseAndValidateOcrSourceUrl('https://example.com/receipt.jpg', BUSINESS_ID)
    ).toThrow(OcrDownloadError);
  });

  it('rejects local and private network hosts', () => {
    expect(() =>
      parseAndValidateOcrSourceUrl('https://localhost/receipt.jpg', BUSINESS_ID)
    ).toThrow(OcrDownloadError);

    expect(() =>
      parseAndValidateOcrSourceUrl('https://192.168.1.5/receipt.jpg', BUSINESS_ID)
    ).toThrow(OcrDownloadError);
  });

  it('rejects Cloudinary attachment URLs from another business folder', () => {
    expect(() =>
      parseAndValidateOcrSourceUrl(
        'https://res.cloudinary.com/du0yzzbwf/image/upload/v123/axion/attachments/22222222-2222-4222-8222-222222222222/receipt.jpg',
        BUSINESS_ID
      )
    ).toThrow(OcrDownloadError);
  });
});

describe('downloadOcrSource', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'du0yzzbwf');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://vrtubmgeipellkfsfdbc.supabase.co');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('downloads an allowed image response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (
        new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            'content-length': '3',
            'content-type': 'image/jpeg',
          },
        })
      ))
    );

    const result = await downloadOcrSource(CLOUDINARY_URL, BUSINESS_ID);

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.buffer).toEqual(Buffer.from([1, 2, 3]));
  });

  it('rejects responses whose declared size exceeds the OCR limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (
        new Response(null, {
          headers: {
            'content-length': String(OCR_DOWNLOAD_MAX_BYTES + 1),
            'content-type': 'image/jpeg',
          },
        })
      ))
    );

    await expect(downloadOcrSource(CLOUDINARY_URL, BUSINESS_ID)).rejects.toMatchObject({
      status: 413,
    });
  });

  it('stops reading streams that exceed the OCR limit without content-length', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (
        new Response(stream, {
          headers: {
            'content-type': 'image/png',
          },
        })
      ))
    );

    await expect(downloadOcrSource(CLOUDINARY_URL, BUSINESS_ID)).rejects.toMatchObject({
      status: 413,
    });
  });
});
