/**
 * Provider abstraction untuk AXION Agent.
 *
 * Chain default (AXION Auto): Gemini → Groq
 * Provider opsional: Claude via Vertex AI (pilihan user di UI)
 *
 * - Gemini: kualitas terbaik, JSON native, tapi free tier RPD sangat ketat
 * - Groq: OpenAI-compatible, gratis dengan rate limit lebih longgar
 * - Claude (Vertex AI): Claude Sonnet 4.6 untuk chat, Haiku 4.5 untuk parse
 *
 * Dua Groq model dengan peran berbeda:
 * - GROQ_CHAT_MODEL  = qwen-qwq-32b — chat analitik, reasoning mendalam
 * - GROQ_PARSE_MODEL = llama-3.3-70b-versatile — parse transaksi, cepat
 */

export type AIProvider = 'gemini' | 'groq' | 'claude';

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
  claude: 'Claude',
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
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-sonnet-4-6@20250514': 'Claude Sonnet 4.6',
  'claude-3-5-sonnet-v2@20241022': 'Claude Sonnet 3.5',
  'claude-3-5-haiku@20241022': 'Claude Haiku 3.5',
  'claude-haiku-4-5@20251001': 'Claude Haiku 4.5',
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

// ─── Claude via Vertex AI ────────────────────────────────────────────────────
//
// Auth: service account JSON disimpan di env GOOGLE_APPLICATION_CREDENTIALS_JSON.
// Token di-cache sampai expiry supaya tidak exchange setiap request.

const CLAUDE_CHAT_MODEL = 'claude-sonnet-4-6';
const CLAUDE_PARSE_MODEL = 'claude-haiku-4-5@20251001';
const VERTEX_REGION = 'global';

let _vertexToken: { token: string; expiresAt: number } | null = null;

async function getVertexToken(): Promise<string | null> {
  // Return cached token kalau masih valid (buffer 60 detik)
  if (_vertexToken && Date.now() < _vertexToken.expiresAt - 60_000) {
    return _vertexToken.token;
  }

  const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credJson) return null;

  try {
    const creds = JSON.parse(credJson) as {
      client_email: string;
      private_key: string;
    };

    // JWT untuk Google OAuth2 token exchange
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));

    // Sign JWT dengan private key RSA (Web Crypto API)
    const pemBody = creds.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', keyBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );
    const sigInput = new TextEncoder().encode(`${header}.${payload}`);
    const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, sigInput);
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const jwt = `${header}.${payload}.${sig}`;

    // Exchange JWT → access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    if (!tokenRes.ok) {
      console.warn('[ai/provider] Vertex token exchange failed:', tokenRes.status);
      return null;
    }
    const tokenJson = await tokenRes.json() as { access_token: string; expires_in: number };
    _vertexToken = {
      token: tokenJson.access_token,
      expiresAt: Date.now() + tokenJson.expires_in * 1000,
    };
    return _vertexToken.token;
  } catch (err) {
    console.warn('[ai/provider] Vertex token error:', err);
    return null;
  }
}

function getVertexProjectId(): string | null {
  const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credJson) return null;
  try {
    return (JSON.parse(credJson) as { project_id?: string }).project_id ?? null;
  } catch {
    return null;
  }
}

async function claudeGenerate(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string | null> {
  const token = await getVertexToken();
  const projectId = getVertexProjectId();
  if (!token || !projectId) return null;

  const endpoint = `https://${VERTEX_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_REGION}/publishers/anthropic/models/${model}:rawPredict`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        anthropic_version: 'vertex-2023-10-16',
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0,
      }),
    });
    if (!res.ok) {
      console.warn(`[ai/provider] Claude generate failed:`, res.status, await res.text());
      return null;
    }
    const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
    return json.content?.find(b => b.type === 'text')?.text ?? null;
  } catch (err) {
    console.warn('[ai/provider] Claude generate error:', err);
    return null;
  }
}

async function claudeStream(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<Response | null> {
  const token = await getVertexToken();
  const projectId = getVertexProjectId();
  if (!token || !projectId) return null;

  const endpoint = `https://${VERTEX_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_REGION}/publishers/anthropic/models/${model}:streamRawPredict`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        anthropic_version: 'vertex-2023-10-16',
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7,
        thinking: { type: 'enabled', budget_tokens: 4000 },
      }),
    });
    if (!res.ok) {
      console.warn('[ai/provider] Claude stream failed:', res.status, await res.text());
      return null;
    }
    return res;
  } catch (err) {
    console.warn('[ai/provider] Claude stream error:', err);
    return null;
  }
}

/**
 * Konversi Anthropic SSE response → ReadableStream<StreamChunk>.
 * Format: `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}`
 * Thinking blocks: type=thinking_delta → kind:'thinking', text_delta → kind:'answer'
 */
function buildClaudeStream(res: Response): ReadableStream<StreamChunk> {
  return new ReadableStream({
    async start(controller) {
      const reader = res.body?.getReader();
      if (!reader) { controller.close(); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let currentBlockThinking = false;
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
              const json = JSON.parse(data) as {
                type: string;
                index?: number;
                content_block?: { type: string };
                delta?: { type: string; text?: string; thinking?: string };
              };
              // Track apakah block saat ini thinking atau text
              if (json.type === 'content_block_start' && json.content_block) {
                currentBlockThinking = json.content_block.type === 'thinking';
              }
              if (json.type === 'content_block_delta' && json.delta) {
                const text = json.delta.thinking ?? json.delta.text ?? '';
                if (text) {
                  const isThinking = json.delta.type === 'thinking_delta' || currentBlockThinking;
                  controller.enqueue({ text, kind: isThinking ? 'thinking' : 'answer' });
                }
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

// Public wrappers untuk Claude — dipakai langsung dari route handler
export async function generateTextClaude(
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<GenerateResult | null> {
  const text = await claudeGenerate(CLAUDE_PARSE_MODEL, systemPrompt, messages, opts);
  if (text === null) return null;
  return { text, provider: 'claude', model: CLAUDE_PARSE_MODEL };
}

export async function streamTextClaude(
  systemPrompt: string,
  messages: AIMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<StreamResult | null> {
  const res = await claudeStream(CLAUDE_CHAT_MODEL, systemPrompt, messages, opts);
  if (!res) return null;
  return { stream: buildClaudeStream(res), provider: 'claude', model: CLAUDE_CHAT_MODEL };
}

export function isClaudeAvailable(): boolean {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
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
