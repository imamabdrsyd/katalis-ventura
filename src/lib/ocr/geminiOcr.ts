import { OcrProviderError } from './types';
import type { OcrParsed } from './types';
import {
  extractKeywords,
  extractFallbackKeywords,
  extractLineItemKeywords,
} from './parser';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: { code: number; message: string; status: string };
};

const SYSTEM_PROMPT = `Kamu adalah parser struk belanja untuk aplikasi akuntansi UKM Indonesia.
Tugasmu: ekstrak data dari gambar struk dan return JSON SAJA, tanpa teks lain, tanpa markdown code block.

JSON harus mengikuti schema ini persis:
{
  "date": "YYYY-MM-DD atau null",
  "total": number atau null,
  "currency_code": "IDR/USD/SGD/dll atau null",
  "vendor": "nama toko/merchant atau null",
  "category": "EARN/OPEX/VAR/CAPEX/TAX/FIN atau null",
  "keywords": ["array", "kata", "kunci"] atau [],
  "line_items": [
    {
      "description": "nama item",
      "amount": number,
      "quantity": number atau null,
      "unit_price": number atau null
    }
  ] atau [],
  "charges": [
    {
      "type": "tax/service/discount/other",
      "label": "label asli di struk",
      "amount": number (negatif untuk diskon)
    }
  ] atau []
}

Aturan category:
- EARN: pendapatan/penjualan masuk
- OPEX: beban operasional (listrik, internet, gaji, konsumsi, transport)
- VAR: HPP/bahan baku/persediaan
- CAPEX: pembelian aset tetap (peralatan, mesin)
- TAX: pajak
- FIN: pinjaman/modal/cicilan

Aturan penting:
- total = jumlah FINAL yang dibayar (setelah pajak/diskon)
- amount di line_items = subtotal per item (qty × harga satuan)
- amount charges: positif untuk pajak/biaya, NEGATIF untuk diskon
- date harus ISO format YYYY-MM-DD
- Kalau tidak yakin dengan suatu field, gunakan null
- keywords: 2-5 kata kunci bahasa Indonesia tentang jenis transaksi ini (mis. ["internet","indihome","telkom"])
- Jangan sertakan tanda titik/koma pada angka — gunakan bilangan bulat atau desimal standar`;

/**
 * Panggil Gemini Vision untuk parse struk langsung ke OcrParsed JSON.
 * Tidak perlu regex parser — Gemini memahami konteks dan bahasa Indonesia.
 */
export async function geminiOcr(imageBuffer: Buffer, mimeType = 'image/jpeg'): Promise<{
  raw_text: string;
  parsed: OcrParsed;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new OcrProviderError('gemini', 'GEMINI_API_KEY not set');
  }

  const base64 = imageBuffer.toString('base64');

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
            {
              text: 'Parse struk ini dan return JSON sesuai schema.',
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new OcrProviderError(
      'gemini',
      `HTTP ${res.status}: ${text.slice(0, 300)}`,
      res.status
    );
  }

  const json = (await res.json()) as GeminiResponse;

  if (json.error) {
    throw new OcrProviderError(
      'gemini',
      json.error.message,
      json.error.code
    );
  }

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!rawText) {
    throw new OcrProviderError('gemini', 'Gemini tidak menghasilkan output');
  }

  return { raw_text: rawText, parsed: parseGeminiJson(rawText) };
}

/**
 * Parse JSON output Gemini (raw_text) jadi OcrParsed, lengkap dengan enrichment
 * keyword dari parser rule-based supaya matcher CoA tetap bekerja.
 *
 * Dipisah dari geminiOcr() supaya cache hit (raw_text = JSON Gemini) bisa
 * re-parse tanpa panggil API lagi — konsisten dengan provider lain di runOcr().
 */
export function parseGeminiJson(rawText: string): OcrParsed {
  try {
    // Strip markdown code block kalau Gemini tetap kirim meski sudah diminta tidak
    const cleanJson = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const raw = JSON.parse(cleanJson) as Record<string, unknown>;

    const vendor =
      typeof raw.vendor === 'string' && raw.vendor !== 'null' ? raw.vendor : undefined;
    const geminiKeywords = Array.isArray(raw.keywords)
      ? (raw.keywords as string[]).filter((k) => typeof k === 'string' && k.length > 0)
      : [];

    // Keywords dari Gemini + keywords topical dari parser (rule-based), digabung & dedup.
    // Ini supaya matcher CoA tetap dapat sinyal yang sama seperti path Vision lama.
    const ruleKeywords = extractKeywords(vendor, rawText);
    const keywords = Array.from(new Set([...geminiKeywords, ...ruleKeywords]));
    const fallback_keywords = extractFallbackKeywords(vendor, rawText);

    return {
      date: typeof raw.date === 'string' && raw.date !== 'null' ? raw.date : undefined,
      total: typeof raw.total === 'number' ? raw.total : undefined,
      currency_code:
        typeof raw.currency_code === 'string' && raw.currency_code !== 'null'
          ? raw.currency_code
          : undefined,
      vendor,
      category: isValidCategory(raw.category) ? raw.category : undefined,
      keywords,
      fallback_keywords,
      line_items: Array.isArray(raw.line_items) && raw.line_items.length > 0
        ? (raw.line_items as Array<Record<string, unknown>>)
            .map((item) => {
              const description = String(item.description ?? '');
              return {
                description,
                amount: Number(item.amount ?? 0),
                quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
                unit_price: typeof item.unit_price === 'number' ? item.unit_price : undefined,
                // Keyword per-item dari parser supaya matcher bisa saran akun per baris.
                keywords: extractLineItemKeywords(description),
              };
            })
            .filter((item) => item.description && item.amount > 0)
        : undefined,
      charges: Array.isArray(raw.charges) && raw.charges.length > 0
        ? (raw.charges as Array<Record<string, unknown>>)
            .map((c) => {
              const type = isValidChargeType(c.type) ? c.type : ('other' as const);
              return {
                type,
                label: String(c.label ?? ''),
                amount: Number(c.amount ?? 0),
                keywords: CHARGE_TYPE_KEYWORDS[type],
              };
            })
            .filter((c) => c.label && c.amount !== 0)
        : undefined,
    };
  } catch {
    throw new OcrProviderError('gemini', `Gagal parse JSON dari Gemini: ${rawText.slice(0, 200)}`);
  }
}

/**
 * Keyword default per tipe charge — supaya matcher CoA bisa cari akun pajak/diskon/service.
 * Selaras dengan CHARGE_PATTERNS di parser.ts.
 */
const CHARGE_TYPE_KEYWORDS: Record<'tax' | 'service' | 'discount' | 'other', string[]> = {
  tax: ['pajak', 'ppn', 'tax'],
  service: ['biaya layanan', 'service'],
  discount: ['diskon', 'potongan'],
  other: [],
};

function isValidCategory(val: unknown): val is OcrParsed['category'] {
  return typeof val === 'string' && ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'].includes(val);
}

function isValidChargeType(val: unknown): val is 'tax' | 'service' | 'discount' | 'other' {
  return typeof val === 'string' && ['tax', 'service', 'discount', 'other'].includes(val);
}
