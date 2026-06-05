/**
 * Provider abstraction untuk AXION Agent.
 *
 * Chain: beberapa model Gemini → Groq → null (rule-based fallback di caller)
 *
 * Kenapa chain ini:
 * - Gemini: kualitas terbaik, JSON native, tapi free tier RPD sangat ketat (~20-500/hari)
 * - Groq: OpenAI-compatible, gratis dengan rate limit lebih longgar
 *
 * Dua Groq model dengan peran berbeda:
 * - GROQ_CHAT_MODEL  = deepseek-r1-distill-llama-70b — untuk chat analitik (mode Tanya).
 *   Model reasoning: lebih teliti untuk analisis keuangan, audit laporan, proyeksi.
 *   Thinking tokens (<think>...</think>) difilter sebelum dikirim ke user.
 * - GROQ_PARSE_MODEL = llama-3.3-70b-versatile — untuk parse transaksi & smart import.
 *   Cepat, hemat token, tidak butuh chain-of-thought untuk klasifikasi singkat.
 *
 * Kuota Gemini free tier dihitung per model. Kalau satu model kena rate limit,
 * request otomatis lanjut ke model Gemini berikutnya sebelum fallback ke Groq.
 */

export type AIProvider = 'gemini' | 'groq';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateResult {
  text: string;
  provider: AIProvider;
  model: string;
}

export interface StreamChunk {
  text: string;
}

export interface StreamResult {
  stream: ReadableStream<StreamChunk>;
  provider: AIProvider;
  model: string;
}

// Label yang ditampilkan di UI
export const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
};

export const MODEL_LABELS: Record<string, string> = {
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'deepseek-r1-distill-llama-70b': 'DeepSeek R1 70B',
};

export const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

// ─── Gemini helpers ──────────────────────────────────────────────────────────

function extractGeminiText(parts?: Array<{ text?: string; thought?: boolean }>): string {
  return parts
    ?.filter(part => !part.thought && part.text)
    .map(part => part.text)
    .join('') ?? '';
}

async function geminiGenerate(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: opts.temperature ?? 0,
            maxOutputTokens: opts.maxTokens ?? 1024,
            responseMimeType: 'application/json',
          },
        }),
      }
    );
    if (!res.ok) {
      console.warn(`[ai/provider] ${model} generate failed:`, res.status);
      return null;
    }
    const json = await res.json();
    return extractGeminiText(json.candidates?.[0]?.content?.parts) || null;
  } catch (err) {
    console.warn(`[ai/provider] ${model} generate error:`, err);
    return null;
  }
}

async function geminiStream(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<Response | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: opts.temperature ?? 0.7,
            maxOutputTokens: opts.maxTokens ?? 1024,
          },
        }),
      }
    );
    if (!res.ok) {
      console.warn(`[ai/provider] ${model} stream failed:`, res.status);
      return null;
    }
    return res;
  } catch (err) {
    console.warn(`[ai/provider] ${model} stream error:`, err);
    return null;
  }
}

// ─── Groq helpers (OpenAI-compatible) ────────────────────────────────────────

// Parse transaksi & smart import: cepat, tidak butuh reasoning
const GROQ_PARSE_MODEL = 'llama-3.3-70b-versatile';
// Chat analitik: reasoning lebih dalam untuk analisis keuangan
const GROQ_CHAT_MODEL = 'deepseek-r1-distill-llama-70b';

async function groqGenerate(
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const oaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_PARSE_MODEL,
        messages: oaiMessages,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 1024,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      console.warn('[ai/provider] Groq generate failed:', res.status);
      return null;
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn('[ai/provider] Groq generate error:', err);
    return null;
  }
}

async function groqStream(
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<Response | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const oaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: oaiMessages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        stream: true,
      }),
    });
    if (!res.ok) {
      console.warn('[ai/provider] Groq stream failed:', res.status);
      return null;
    }
    return res;
  } catch (err) {
    console.warn('[ai/provider] Groq stream error:', err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate teks (non-streaming) — untuk parser transaksi & smart import assist.
 * Coba tiap model Gemini, fallback ke Groq, return null kalau semuanya gagal.
 */
export async function generateText(
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<GenerateResult | null> {
  for (const model of GEMINI_MODELS) {
    const geminiText = await geminiGenerate(model, systemPrompt, messages, opts);
    if (geminiText !== null) {
      return { text: geminiText, provider: 'gemini', model };
    }
  }

  // Fallback: Groq (parse model — cepat, tidak perlu reasoning)
  const groqText = await groqGenerate(systemPrompt, messages, opts);
  if (groqText !== null) {
    return { text: groqText, provider: 'groq', model: GROQ_PARSE_MODEL };
  }

  return null;
}

/**
 * Stream teks SSE — untuk chat analitik.
 * Coba tiap model Gemini, fallback ke Groq.
 * Format SSE output dinormalisasi: `data: {"text":"..."}\n\n` untuk keduanya.
 */
export async function streamText(
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<StreamResult | null> {
  for (const model of GEMINI_MODELS) {
    const geminiRes = await geminiStream(model, systemPrompt, messages, opts);
    if (geminiRes) {
      return {
        stream: buildGeminiStream(geminiRes),
        provider: 'gemini',
        model,
      };
    }
  }

  // Fallback: Groq (chat model — DeepSeek R1 untuk analitik lebih dalam)
  const groqRes = await groqStream(systemPrompt, messages, opts);
  if (groqRes) {
    return {
      stream: buildGroqStream(groqRes),
      provider: 'groq',
      model: GROQ_CHAT_MODEL,
    };
  }

  return null;
}

// ─── SSE stream builders ──────────────────────────────────────────────────────

/**
 * Konversi Gemini SSE response → ReadableStream<StreamChunk>.
 * Gemini format: `data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}`
 */
function buildGeminiStream(res: Response): ReadableStream<StreamChunk> {
  return new ReadableStream({
    async start(controller) {
      const reader = res.body?.getReader();
      if (!reader) { controller.close(); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const text = extractGeminiText(json.candidates?.[0]?.content?.parts);
              if (text) controller.enqueue({ text });
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

/**
 * Konversi Groq OpenAI SSE response → ReadableStream<StreamChunk>.
 * Groq format: `data: {"choices":[{"delta":{"content":"..."}}]}`
 *
 * Filter <think>...</think> dari DeepSeek R1: thinking tokens ditulis sebelum
 * jawaban asli — user tidak perlu lihat proses berpikir internalnya.
 * State machine sederhana: track apakah kita sedang di dalam blok <think>.
 */
function buildGroqStream(res: Response): ReadableStream<StreamChunk> {
  return new ReadableStream({
    async start(controller) {
      const reader = res.body?.getReader();
      if (!reader) { controller.close(); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      // Buffer untuk akumulasi teks mentah sebelum filter <think>
      let rawAccum = '';
      let inThink = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const chunk: string = json.choices?.[0]?.delta?.content ?? '';
              if (!chunk) continue;
              rawAccum += chunk;
              // Proses rawAccum: buang semua <think>…</think> blocks
              let out = '';
              let remaining = rawAccum;
              while (remaining.length > 0) {
                if (inThink) {
                  const closeIdx = remaining.indexOf('</think>');
                  if (closeIdx === -1) {
                    // Masih di dalam think block, tunggu token berikutnya
                    remaining = '';
                  } else {
                    inThink = false;
                    remaining = remaining.slice(closeIdx + '</think>'.length);
                  }
                } else {
                  const openIdx = remaining.indexOf('<think>');
                  if (openIdx === -1) {
                    out += remaining;
                    remaining = '';
                  } else {
                    out += remaining.slice(0, openIdx);
                    inThink = true;
                    remaining = remaining.slice(openIdx + '<think>'.length);
                  }
                }
              }
              rawAccum = inThink ? rawAccum.slice(rawAccum.lastIndexOf('<think>')) : '';
              if (out) controller.enqueue({ text: out });
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}
