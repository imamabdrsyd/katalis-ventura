import { OcrProviderError } from './types';

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';

type OcrSpaceResponse = {
  ParsedResults?: Array<{ ParsedText: string; ErrorMessage?: string }>;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
};

/**
 * Call OCR.space API (engine 2, language Indonesian).
 * Returns raw text from receipt image.
 */
export async function ocrSpaceOcr(
  imageBuffer: Buffer,
  mimeType = 'image/jpeg'
): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    throw new OcrProviderError('ocr_space', 'OCR_SPACE_API_KEY not set');
  }

  // Tentukan extension dari mimeType supaya OCR.space bisa deteksi file type
  const extension = mimeTypeToExtension(mimeType);
  const filetype = extension.toUpperCase(); // JPG | PNG | PDF | GIF | TIFF

  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  form.append('file', blob, `receipt.${extension}`);
  // OCR.space free tier engine 2 tidak support 'ind' — pakai default 'eng'.
  // Angka & nama vendor masih terbaca dengan baik karena numbers/Latin script universal.
  form.append('language', 'eng');
  form.append('filetype', filetype);
  form.append('OCREngine', '2');
  form.append('isOverlayRequired', 'false');
  form.append('scale', 'true');
  form.append('detectOrientation', 'true');

  const res = await fetch(OCR_SPACE_ENDPOINT, {
    method: 'POST',
    headers: { apikey: apiKey },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new OcrProviderError(
      'ocr_space',
      `HTTP ${res.status}: ${text.slice(0, 200)}`,
      res.status
    );
  }

  const json = (await res.json()) as OcrSpaceResponse;

  if (json.IsErroredOnProcessing) {
    const errMsg = Array.isArray(json.ErrorMessage)
      ? json.ErrorMessage.join('; ')
      : json.ErrorMessage ?? 'OCR.space processing error';
    throw new OcrProviderError('ocr_space', errMsg);
  }

  const parsed = json.ParsedResults?.[0];
  if (!parsed) {
    throw new OcrProviderError('ocr_space', 'No parsed result returned');
  }

  return parsed.ParsedText ?? '';
}

function mimeTypeToExtension(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('png')) return 'png';
  if (lower.includes('gif')) return 'gif';
  if (lower.includes('tiff')) return 'tif';
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('webp')) return 'jpg'; // OCR.space tidak support webp, fallback ke jpg (akan di-convert oleh server)
  return 'jpg';
}
