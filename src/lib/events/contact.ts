/**
 * Normalisasi kontak pendaftar event — CERMIN dari logika di dalam
 * `register_event_slot` (migr 136). DB tetap satu-satunya otoritas; salinan
 * TypeScript ini dipakai untuk (a) validasi ringan di form publik sebelum
 * submit, dan (b) hitung batas anti-spam di route sebelum memanggil RPC.
 *
 * Bentuk targetnya sengaja disamakan dengan `wa_id` webhook WhatsApp (digit
 * saja, prefix 62) supaya pendaftar event menyatu ke thread lead yang sudah
 * ada, bukan bikin lead kembar.
 */

import type { EventContactMethod } from '@/types';

export interface NormalizedContact {
  /** Nilai siap simpan; null bila tidak valid. */
  value: string | null;
  /** Pesan error ramah (Bahasa Indonesia) bila tidak valid. */
  error: string | null;
}

export function normalizeEventContact(method: EventContactMethod, raw: string): NormalizedContact {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return {
      value: null,
      error: method === 'whatsapp' ? 'Nomor WhatsApp wajib diisi' : 'Username Instagram wajib diisi',
    };
  }

  if (method === 'whatsapp') {
    let digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
    else if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length < 8 || digits.length > 20) {
      return { value: null, error: 'Nomor WhatsApp tidak valid' };
    }
    return { value: digits, error: null };
  }

  const handle = trimmed.replace(/^[@\s]+/, '').replace(/[@\s]+$/, '').toLowerCase();
  if (handle.length < 2 || handle.length > 40) {
    return { value: null, error: 'Username Instagram tidak valid' };
  }
  return { value: handle, error: null };
}

/** Label field kontak di form publik, mengikuti contact_method sesi. */
export function contactFieldLabel(method: EventContactMethod): string {
  return method === 'whatsapp' ? 'Nomor WhatsApp' : 'Username Instagram';
}

export function contactFieldHint(method: EventContactMethod): string {
  return method === 'whatsapp' ? 'contoh: 0812 3456 7890' : 'contoh: namakamu (tanpa @)';
}
