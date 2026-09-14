import { describe, expect, it } from 'vitest';
import { getAttachmentKind } from '@/hooks/useAttachmentGallery';
import { MAX_FILES } from '@/lib/storage/attachments';
import type { TransactionAttachment } from '@/types';

function att(overrides: Partial<TransactionAttachment>): TransactionAttachment {
  return {
    path: 'axion/attachments/biz/file',
    url: 'https://res.cloudinary.com/demo/image/authenticated/axion/attachments/biz/file',
    filename: 'file.bin',
    size: 1024,
    mime_type: '',
    uploaded_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getAttachmentKind', () => {
  it('memisahkan gambar dari PDF berdasarkan mime_type', () => {
    expect(getAttachmentKind(att({ mime_type: 'image/jpeg', filename: 'nota.jpg' }))).toBe('image');
    expect(getAttachmentKind(att({ mime_type: 'image/png', filename: 'bukti.png' }))).toBe('image');
    expect(getAttachmentKind(att({ mime_type: 'image/webp', filename: 'struk.webp' }))).toBe('image');
    expect(getAttachmentKind(att({ mime_type: 'application/pdf', filename: 'faktur.pdf' }))).toBe('file');
  });

  it('tetap menganggap PDF sebagai file walau resource_type-nya "image"', () => {
    // Kasus nyata di data produksi: lampiran PDF lama tersimpan dengan
    // resource_type 'image' (upload sebelum /auto/upload dipakai). mime_type
    // harus menang atas resource_type.
    expect(
      getAttachmentKind(
        att({ mime_type: 'application/pdf', resource_type: 'image', filename: 'invoice.pdf' })
      )
    ).toBe('file');
  });

  it('jatuh ke ekstensi nama file saat mime_type kosong', () => {
    expect(getAttachmentKind(att({ mime_type: '', filename: 'scan.JPEG' }))).toBe('image');
    expect(getAttachmentKind(att({ mime_type: '', filename: 'kontrak.pdf' }))).toBe('file');
  });

  it('memakai resource_type sebagai cadangan terakhir', () => {
    expect(getAttachmentKind(att({ mime_type: '', filename: 'tanpa-ekstensi', resource_type: 'image' }))).toBe('image');
    expect(getAttachmentKind(att({ mime_type: '', filename: 'tanpa-ekstensi', resource_type: 'raw' }))).toBe('file');
  });

  it('tidak pernah melempar untuk lampiran cacat', () => {
    expect(getAttachmentKind(att({ mime_type: undefined as never, filename: undefined as never }))).toBe('file');
  });
});

describe('MAX_FILES', () => {
  it('membatasi lampiran manual di 5 file per transaksi', () => {
    expect(MAX_FILES).toBe(5);
  });
});
