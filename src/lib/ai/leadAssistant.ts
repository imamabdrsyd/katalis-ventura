/**
 * AI assistant untuk Leads Hub — generate balasan chat customer.
 *
 * Dipakai oleh:
 * - WhatsApp webhook (ai_mode='auto'): balasan langsung dikirim
 * - Generic inbound webhook OTA (ai_mode='draft'): disimpan sebagai draft,
 *   manager approve manual sebelum kirim
 *
 * Reuse provider.ts generateText() (chain Gemini → Groq) — keduanya dipaksa
 * JSON mode oleh provider, jadi system prompt minta output {"reply": "..."}
 * dan hasilnya di-parse dengan fallback ke raw text.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateText, type AIMessage } from './provider';
import { groupIntoRanges } from '@/lib/rates';
import type { ChannelIntegration, Lead } from '@/types';

export interface LeadReplyResult {
  reply: string;
  images?: string[];
  provider: string;
  model: string;
}

interface CatalogItemSummary {
  name: string;
  default_price: number;
  unit: string | null;
  description: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  instagram: 'Instagram',
  shopee: 'Shopee',
  tokopedia: 'Tokopedia',
  tiktok_shop: 'TikTok Shop',
};

function formatPrice(price: number): string {
  return `Rp ${price.toLocaleString('id-ID')}`;
}

/**
 * Gabungkan field terstruktur (hours/location/policies/faq) + catatan bebas
 * jadi satu blok teks berlabel Indonesia untuk system prompt. Return null kalau
 * semua kosong → section "INFORMASI BISNIS" di-skip.
 */
function formatBusinessKnowledge(
  fields: {
    hours?: string;
    location?: string;
    policies?: string;
    faq?: string;
    images?: { url: string; title: string }[];
  } | null,
  content: string | null
): string | null {
  const lines: string[] = [];
  if (fields?.hours?.trim()) lines.push(`Jam buka: ${fields.hours.trim()}`);
  if (fields?.location?.trim()) lines.push(`Lokasi: ${fields.location.trim()}`);
  if (fields?.policies?.trim()) lines.push(`Kebijakan: ${fields.policies.trim()}`);
  if (fields?.faq?.trim()) lines.push(`FAQ: ${fields.faq.trim()}`);
  if (fields?.images && fields.images.length > 0) {
    lines.push('Gambar/Foto Bisnis pendukung:');
    fields.images.forEach((img) => {
      lines.push(`- ${img.title}: ${img.url}`);
    });
  }
  if (content?.trim()) lines.push(content.trim());
  return lines.length > 0 ? lines.join('\n') : null;
}

interface BookingAvailabilityRow {
  check_in: string;
  check_out: string;
  unit: { name: string | null } | { name: string | null }[] | null;
}

/**
 * Rangkum tanggal menginap yang SUDAH TERISI (booking non-cancelled ke depan)
 * agar concierge bisa menjawab pertanyaan ketersediaan ("kosong ga tgl X?").
 * Return null bila tak ada booking mendatang.
 */
function formatAvailability(rows: BookingAvailabilityRow[] | null): string | null {
  if (!rows || rows.length === 0) return null;
  const lines: string[] = [
    'KETERSEDIAAN MENGINAP — tanggal berikut SUDAH TERISI (di luar ini kemungkinan masih kosong):',
  ];
  for (const r of rows) {
    const u = Array.isArray(r.unit) ? r.unit[0] : r.unit;
    const unitLabel = u?.name ? `${u.name}: ` : '';
    lines.push(`- ${unitLabel}${r.check_in} s/d ${r.check_out} (check-out ${r.check_out} sudah kosong lagi)`);
  }
  lines.push(
    'Jika pelanggan menanyakan tanggal yang tidak tercantum di atas, tawarkan bahwa kemungkinan tersedia dan minta konfirmasi. Jangan menjanjikan tanggal yang sudah terisi.'
  );
  return lines.join('\n');
}

interface RateInfo {
  unitName: string;
  itemName: string;
  defaultPrice: number;
  overrides: { date: string; price: number }[];
}

/**
 * Rangkum kalender harga PER UNIT (bisnis bisa punya >1 unit fisik, tiap unit
 * kalender harganya sendiri) supaya concierge bisa quote harga per tanggal yang
 * benar — bukan cuma harga default. Override berurutan berharga sama diringkas
 * jadi rentang. Nama unit disertakan hanya bila bisnis punya >1 unit berharga.
 */
function formatRates(infos: RateInfo[]): string | null {
  if (infos.length === 0) return null;
  const showUnitName = infos.length > 1;

  const blocks = infos.map((info) => {
    const lines: string[] = [
      showUnitName
        ? `HARGA MENGINAP PER MALAM — Unit ${info.unitName} (${info.itemName}): normal ${formatPrice(info.defaultPrice)}.`
        : `HARGA MENGINAP PER MALAM (${info.itemName}): normal ${formatPrice(info.defaultPrice)}.`,
    ];
    if (info.overrides.length > 0) {
      const ranges = groupIntoRanges(
        info.overrides.map((o) => ({ date: o.date, price: o.price, overridden: true }))
      );
      lines.push('Harga khusus tanggal tertentu:');
      for (const r of ranges) {
        lines.push(
          r.start === r.end
            ? `- ${r.start}: ${formatPrice(r.price)}`
            : `- ${r.start} s/d ${r.end}: ${formatPrice(r.price)}/malam`
        );
      }
    }
    return lines.join('\n');
  });

  blocks.push(
    'Total menginap = jumlah harga per malam sesuai tanggalnya (malam check-out tidak dihitung). Tanggal di luar daftar harga khusus memakai harga normal.'
  );
  return blocks.join('\n\n');
}

function buildSystemPrompt(
  businessName: string,
  businessSector: string | null,
  channel: string,
  aiPersona: string | null,
  catalogItems: CatalogItemSummary[],
  businessKnowledge: string | null,
  availability: string | null,
  rates: string | null
): string {
  const lines: string[] = [
    `Kamu adalah customer service untuk bisnis "${businessName}"${businessSector ? ` (sektor: ${businessSector})` : ''}.`,
    `Kamu membalas pesan customer yang masuk lewat ${CHANNEL_LABELS[channel] ?? channel}.`,
    '',
    'Aturan:',
    '- Balas dalam Bahasa Indonesia yang ramah, sopan, dan singkat (maksimal 3-4 kalimat).',
    '- Jawab hanya berdasarkan informasi yang kamu punya. Kalau tidak tahu, bilang akan dicek dulu oleh tim dan jangan mengarang.',
    '- Jangan menjanjikan harga/diskon/ketersediaan di luar daftar produk di bawah.',
    '- Jangan menyebut bahwa kamu AI kecuali ditanya langsung.',
    '- JIKA pelanggan meminta gambar, foto, brosur, atau ratecard, kamu WAJIB menyertakan link gambar pendukung (https://res.cloudinary.com/...) dari informasi di bawah ke dalam teks balasanmu.',
  ];

  if (catalogItems.length > 0) {
    lines.push('', 'Daftar produk/layanan:');
    for (const item of catalogItems) {
      const unit = item.unit ? `/${item.unit}` : '';
      const desc = item.description ? ` — ${item.description}` : '';
      lines.push(`- ${item.name}: ${formatPrice(item.default_price)}${unit}${desc}`);
    }
  }

  if (businessKnowledge && businessKnowledge.trim()) {
    lines.push('', 'INFORMASI BISNIS (dari pemilik — pakai sebagai fakta saat menjawab):', businessKnowledge.trim());
  }

  if (availability && availability.trim()) {
    lines.push('', availability.trim());
  }

  if (rates && rates.trim()) {
    lines.push('', rates.trim());
  }

  if (aiPersona && aiPersona.trim()) {
    lines.push('', 'Instruksi tambahan dari pemilik bisnis:', aiPersona.trim());
  }

  lines.push(
    '',
    'WAJIB: balas HANYA dengan JSON valid berformat {"reply": "isi balasanmu", "images": ["link1", "link2"]} tanpa teks lain. Jika ingin memberikan gambar/brosur pendukung, masukkan linknya ke array "images".'
  );

  return lines.join('\n');
}

/** Parse output model: JSON {"reply": ..., "images": [...]} dengan fallback ke raw text. */
export function parseReply(raw: string): { reply: string; images?: string[] } | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as { reply?: unknown; images?: unknown };
    if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
      return {
        reply: parsed.reply.trim(),
        images: Array.isArray(parsed.images) ? parsed.images.filter(i => typeof i === 'string') : undefined,
      };
    }
  } catch {
    // bukan JSON — pakai raw text apa adanya
  }
  return cleaned ? { reply: cleaned } : null;
}

/**
 * Generate balasan AI untuk lead. Mengambil info bisnis + katalog produk
 * sebagai context, lalu kirim riwayat percakapan ke provider.
 *
 * `history` harus diakhiri pesan customer terbaru (role 'user').
 * Return null kalau semua provider gagal — caller skip balasan (jangan crash).
 */
export async function generateLeadReply(
  supabase: SupabaseClient,
  integration: ChannelIntegration,
  lead: Lead,
  history: AIMessage[]
): Promise<LeadReplyResult | null> {
  if (history.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: business }, { data: catalog }, { data: knowledge }, { data: bookings }, { data: unitsWithRate }] =
    await Promise.all([
      supabase
        .from('businesses')
        .select('business_name, business_sector')
        .eq('id', integration.business_id)
        .maybeSingle(),
      supabase
        .from('catalog_items')
        .select('name, default_price, unit, description')
        .eq('business_id', integration.business_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .limit(30),
      supabase
        .from('business_ai_knowledge')
        .select('content, fields')
        .eq('business_id', integration.business_id)
        .maybeSingle(),
      // Booking mendatang untuk fitur "AI availability" — hanya yang belum lewat & aktif.
      supabase
        .from('bookings')
        .select('check_in, check_out, unit:business_units(name)')
        .eq('business_id', integration.business_id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('check_out', today)
        .order('check_in', { ascending: true })
        .limit(40),
      // Unit fisik aktif yang sudah punya sumber harga terpasang (bisa >1 unit).
      supabase
        .from('business_units')
        .select('id, name, rate_item:catalog_items!business_units_rate_item_id_fkey(name, default_price)')
        .eq('business_id', integration.business_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .not('rate_item_id', 'is', null),
    ]);

  // Kalender harga per unit: override 60 hari ke depan (bila dikonfigurasi).
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 60);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const rateInfos: RateInfo[] = await Promise.all(
    (unitsWithRate ?? []).map(async (u) => {
      const rateItem = Array.isArray(u.rate_item) ? u.rate_item[0] : u.rate_item;
      const { data: rateRows } = await supabase
        .from('unit_daily_rates')
        .select('date, price')
        .eq('unit_id', u.id)
        .gte('date', today)
        .lte('date', horizonStr)
        .order('date', { ascending: true });
      return {
        unitName: u.name as string,
        itemName: (rateItem?.name as string | undefined) ?? 'Tarif',
        defaultPrice: Number(rateItem?.default_price ?? 0),
        overrides: (rateRows ?? []).map((r) => ({ date: r.date as string, price: Number(r.price) })),
      };
    })
  );

  const systemPrompt = buildSystemPrompt(
    business?.business_name ?? 'bisnis kami',
    business?.business_sector ?? null,
    lead.channel,
    integration.ai_persona ?? null,
    (catalog ?? []) as CatalogItemSummary[],
    formatBusinessKnowledge(knowledge?.fields ?? null, knowledge?.content ?? null),
    formatAvailability((bookings ?? []) as BookingAvailabilityRow[]),
    formatRates(rateInfos)
  );

  const result = await generateText(systemPrompt, history, {
    temperature: 0.4,
    maxTokens: 1024,
  });

  if (!result) {
    console.warn('[ai/leadAssistant] semua provider gagal — skip balasan');
    return null;
  }

  const parsed = parseReply(result.text);
  if (!parsed) return null;

  return { reply: parsed.reply, images: parsed.images, provider: result.provider, model: result.model };
}
