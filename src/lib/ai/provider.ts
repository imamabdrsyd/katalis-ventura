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
  /** 'thinking' = proses berpikir model (reasoning), 'answer' = jawaban final */
  kind: 'thinking' | 'answer';
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
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'deepseek-r1-distill-llama-70b': 'DeepSeek R1 70B',
  'qwen-qwq-32b': 'Qwen QwQ 32B',
};

export const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

// Urutan khusus untuk CHAT (mode Tanya). Berbeda dari GEMINI_MODELS yang dipakai
// parser transaksi. Tujuannya konsistensi: satu model utama dipakai untuk SEMUA
// pesan dalam percakapan supaya gaya jawaban tidak gonta-ganti antar pesan
// (penyebab chat terasa "ngadat"). Sisanya hanya fallback bila yang utama
// kena rate limit. Gemini 2.5 Flash dipilih sbg utama: stabil, dukung thinking,
// kuota lebih longgar dari 3.5.
export const GEMINI_CHAT_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
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
            // Thinking tokens: hanya model 2.5 yang mendukung
            ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { includeThoughts: true } } : {}),
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
const GROQ_CHAT_MODEL = 'qwen-qwq-32b';

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
 * Format SSE output dinormalisasi: `data: {"text":"...","kind":"..."}\n\n` untuk keduanya.
 *
 * `preferReasoning: true` → Groq DeepSeek R1 dicoba DULU (analisis/audit/proyeksi
 * yang butuh nalar lebih dalam), Gemini jadi fallback. Default false = Gemini dulu
 * (cepat & murah kuotanya, cukup untuk pertanyaan analitik biasa).
 */
export async function streamText(
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number; preferReasoning?: boolean } = {}
): Promise<StreamResult | null> {
  const tryGemini = async (): Promise<StreamResult | null> => {
    // Chat pakai urutan konsisten (2.5 Flash utama) — beda dari parser transaksi.
    for (const model of GEMINI_CHAT_MODELS) {
      const res = await geminiStream(model, systemPrompt, messages, opts);
      if (res) return { stream: buildGeminiStream(res), provider: 'gemini', model };
    }
    return null;
  };

  const tryGroq = async (): Promise<StreamResult | null> => {
    const res = await groqStream(systemPrompt, messages, opts);
    if (res) return { stream: buildGroqStream(res), provider: 'groq', model: GROQ_CHAT_MODEL };
    return null;
  };

  // Audit/proyeksi → R1 dulu; selainnya → Gemini dulu
  const chain = opts.preferReasoning ? [tryGroq, tryGemini] : [tryGemini, tryGroq];
  for (const attempt of chain) {
    const result = await attempt();
    if (result) return result;
  }

  return null;
}

// ─── SSE stream builders ──────────────────────────────────────────────────────

/**
 * Konversi Gemini SSE response → ReadableStream<StreamChunk>.
 * Gemini format: `data: {"candidates":[{"content":{"parts":[{"text":"...","thought":bool}]}}]}`
 *
 * Parts dgn `thought:true` di-emit sebagai kind 'thinking' (reasoning), sisanya 'answer'.
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
              const parts: Array<{ text?: string; thought?: boolean }> =
                json.candidates?.[0]?.content?.parts ?? [];
              for (const part of parts) {
                if (!part.text) continue;
                controller.enqueue({ text: part.text, kind: part.thought ? 'thinking' : 'answer' });
              }
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
 * DeepSeek R1 menulis reasoning di dalam <think>...</think> sebelum jawaban asli.
 * Teks di dalam <think> di-emit sebagai kind 'thinking', sisanya 'answer'.
 * State machine: track apakah kita sedang di dalam blok <think>, dan tahan
 * partial tag (mis. "<thi") sampai tag lengkap supaya tidak bocor ke output.
 */
function buildGroqStream(res: Response): ReadableStream<StreamChunk> {
  return new ReadableStream({
    async start(controller) {
      const reader = res.body?.getReader();
      if (!reader) { controller.close(); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let pending = ''; // teks yang belum diproses (bisa ada partial tag di ujung)
      let inThink = false;

      // Apakah `s` mungkin awalan dari tag yang sedang dicari? (tahan kalau iya)
      const couldBeTagPrefix = (s: string, tag: string) => {
        for (let i = 1; i < tag.length; i++) {
          if (s.endsWith(tag.slice(0, i))) return true;
        }
        return false;
      };

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
              pending += chunk;

              // Drain pending sejauh tag berikutnya bisa dipastikan.
              while (pending.length > 0) {
                const tag = inThink ? '</think>' : '<think>';
                const idx = pending.indexOf(tag);
                if (idx !== -1) {
                  const before = pending.slice(0, idx);
                  if (before) controller.enqueue({ text: before, kind: inThink ? 'thinking' : 'answer' });
                  pending = pending.slice(idx + tag.length);
                  inThink = !inThink;
                  continue;
                }
                // Tag belum lengkap — emit yang aman, tahan kemungkinan partial tag di ujung
                if (couldBeTagPrefix(pending, tag)) {
                  // cari titik aman terakhir: emit semua kecuali ekor yang bisa jadi prefix
                  let safeLen = pending.length;
                  for (let i = 1; i < tag.length; i++) {
                    if (pending.endsWith(tag.slice(0, i))) { safeLen = pending.length - i; break; }
                  }
                  const safe = pending.slice(0, safeLen);
                  if (safe) controller.enqueue({ text: safe, kind: inThink ? 'thinking' : 'answer' });
                  pending = pending.slice(safeLen);
                  break;
                }
                controller.enqueue({ text: pending, kind: inThink ? 'thinking' : 'answer' });
                pending = '';
              }
            } catch { /* skip malformed */ }
          }
        }
        // Flush sisa
        if (pending) controller.enqueue({ text: pending, kind: inThink ? 'thinking' : 'answer' });
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}
