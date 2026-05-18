import { OcrProviderError } from './types';

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

type VisionResponse = {
  responses: Array<{
    fullTextAnnotation?: { text: string };
    textAnnotations?: Array<{ description: string }>;
    error?: { code: number; message: string };
  }>;
};

/**
 * Call Google Cloud Vision API DOCUMENT_TEXT_DETECTION.
 * Returns raw text from receipt image.
 */
export async function googleVisionOcr(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new OcrProviderError(
      'google_vision',
      'GOOGLE_VISION_API_KEY not set'
    );
  }

  const base64 = imageBuffer.toString('base64');

  const res = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['id', 'en'] },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new OcrProviderError(
      'google_vision',
      `HTTP ${res.status}: ${text.slice(0, 200)}`,
      res.status
    );
  }

  const json = (await res.json()) as VisionResponse;
  const first = json.responses?.[0];

  if (first?.error) {
    throw new OcrProviderError(
      'google_vision',
      first.error.message,
      first.error.code
    );
  }

  const text = first?.fullTextAnnotation?.text ?? first?.textAnnotations?.[0]?.description ?? '';
  return text;
}
