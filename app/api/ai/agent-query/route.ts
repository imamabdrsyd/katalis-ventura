/**
 * /api/ai/agent-query — Agentic loop dengan SSE streaming + tool calling (Vertex / Gemini).
 *
 * Alur:
 * 1. Terima pesan user + business_id
 * 2. Stream ke Gemini via streamGenerateContent (SSE)
 * 3. Emit thinking chunks real-time ke client saat model berpikir
 * 4. Kalau Gemini emit functionCall → kumpulkan semua, eksekusi tool (blocking), lanjut loop
 * 5. Iteration terakhir (jawaban final) → stream answer chunks ke client
 * 6. Emit event 'navigate' kalau ada navigate_to action
 * 7. Emit [DONE]
 *
 * Format SSE per-chunk: data: {"kind":"thinking"|"answer"|"navigate"|"error","text?":"...","data?":...}
 * Tool calling max 3 iterasi (cegah loop tak terbatas).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { buildFinancialContext } from '@/lib/ai/financialContext';
import { buildAgentSystemPrompt, type FinancialPersona } from '@/lib/ai/financialPersonas';
import { routeIntent } from '@/lib/ai/intent';
import { TOOL_DEFINITIONS, executeTool, type NavigateAction } from '@/lib/ai/agentTools';
import { getVertexTokenAndProject } from '@/lib/ai/vertexAuth';
import type { Transaction, Account } from '@/types';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(40)
    .optional()
    .default([]),
  persona: z.enum(['auto', 'pembukuan', 'analis_fpna', 'pajak', 'general']).optional().default('auto'),
  chatMode: z.enum(['general', 'business']).optional().default('business'),
});

// Gemini 3.5 Flash: generasi terbaru (3.5), near-Pro level, thinking model.
// Lebih canggih dari 2.5 Pro untuk reasoning analitik, lebih cepat dari 3.1 Pro Preview.
const GEMINI_VERTEX_MODEL = 'gemini-3.5-flash';
const MAX_TOOL_ITERATIONS = 10;

// Directive untuk forced synthesis step. gemini-3.5-flash kadang "selesai" di dalam
// thinking pada tugas berat (mis. rekonsiliasi seluruh CSV) tanpa pernah menuliskan
// jawaban final untuk user → "(tidak ada respons)". Saat loop berakhir tanpa jawaban,
// kita panggil sekali lagi TANPA tools dengan instruksi ini agar model wajib menulis.
const SYNTHESIS_DIRECTIVE =
  'Berdasarkan SEMUA data yang sudah kamu kumpulkan dari pemanggilan tool di atas, ' +
  'tuliskan jawaban final untuk pertanyaan pengguna SEKARANG dalam Bahasa Indonesia. ' +
  'Jangan memanggil tool apa pun lagi. Langsung berikan kesimpulan/analisisnya. ' +
  'Jika ada data yang belum sempat kamu tarik, sampaikan kesimpulan dari data yang ADA ' +
  'dan sebutkan keterbatasannya secara singkat — jangan diam tanpa jawaban.';

type GeminiPart = { text: string; thought?: boolean };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };
type FunctionCallPart = { functionCall: { name: string; args: Record<string, unknown> } };
type FunctionResponsePart = { functionResponse: { name: string; response: { content: unknown } } };

/** Encode satu SSE event. */
function sseEvent(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Stream satu Gemini call. Thinking chunks selalu di-emit real-time.
 * Answer chunks di-buffer dulu — caller yang memutuskan emit atau tidak
 * tergantung apakah ada tool call (kalau ada tool call, answer di-discard).
 */
async function streamGeminiIteration(
  endpoint: string,
  token: string,
  reqBody: unknown,
  controller: ReadableStreamDefaultController,
): Promise<{ functionCalls: Array<{ name: string; args: Record<string, unknown> }>; collectedParts: Array<GeminiPart | FunctionCallPart>; answerChunks: string[]; finishReason: string | null }> {
  const streamEndpoint = endpoint.replace(':generateContent', ':streamGenerateContent?alt=sse');

  const geminiRes = await fetch(streamEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(reqBody),
  });

  if (!geminiRes.ok) {
    const detail = await geminiRes.text();
    console.error('[agent-query] Gemini stream error:', geminiRes.status, detail);
    throw new Error(`Vertex AI error: ${geminiRes.status}`);
  }

  const reader = geminiRes.body!.getReader();
  const decoder = new TextDecoder();

  const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const collectedParts: Array<GeminiPart | FunctionCallPart> = [];
  const answerChunks: string[] = [];
  let finishReason: string | null = null;

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;

      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { continue; }

      const candidate = (parsed as { candidates?: Array<{ content?: { parts?: Array<GeminiPart | FunctionCallPart> }; finishReason?: string }> })
        ?.candidates?.[0];
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      if (!candidate?.content?.parts) continue;

      for (const part of candidate.content.parts) {
        if ('functionCall' in part) {
          functionCalls.push({
            name: (part as FunctionCallPart).functionCall.name,
            args: (part as FunctionCallPart).functionCall.args,
          });
          collectedParts.push(part);
        } else if ('text' in part) {
          const textPart = part as GeminiPart;
          collectedParts.push(textPart);
          if (textPart.thought) {
            // Thinking — emit langsung real-time
            controller.enqueue(sseEvent({ kind: 'thinking', text: textPart.text }));
          } else {
            // Answer — buffer dulu, caller yang emit kalau tidak ada tool call
            answerChunks.push(textPart.text);
          }
        }
      }

      // Grounding Google Search → emit sumber
      const grounding: Array<{ web?: { uri?: string; title?: string } }> =
        (candidate as any)?.groundingMetadata?.groundingChunks ?? [];
      if (grounding.length > 0) {
        const sources: Array<{ uri: string; title: string }> = [];
        const seen = new Set<string>();
        for (const g of grounding) {
          const uri = g.web?.uri;
          if (!uri || seen.has(uri)) continue;
          seen.add(uri);
          sources.push({ uri, title: g.web?.title || uri });
        }
        if (sources.length > 0) {
          controller.enqueue(sseEvent({ kind: 'sources', sources }));
        }
      }
    }
  }

  return { functionCalls, collectedParts, answerChunks, finishReason };
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    console.error('[agent-query] Zod validation failed:', parsed.error.flatten());
    return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }), { status: 400 });
  }

  const { business_id, message, history, persona, chatMode } = parsed.data;
  
  let route: { persona?: string | null, isFinancial: boolean };
  
  if (chatMode === 'general' || persona === 'general') {
    route = { persona: 'general', isFinancial: false };
  } else if (persona === 'auto') {
    const intent = routeIntent(message);
    route = { persona: intent.persona, isFinancial: true }; // Force isFinancial to true if in business mode
  } else {
    route = { persona: persona as any, isFinancial: true };
  }

  const systemPrompt = route.isFinancial
    ? buildAgentSystemPrompt((route.persona as FinancialPersona) ?? null)
    : `Kamu adalah AXION Agent, asisten AI serbaguna yang membantu pengguna dengan topik apa pun. Jawab dengan jelas, akurat, dan ringkas. Gunakan Bahasa Indonesia kecuali pengguna menggunakan bahasa lain.`;

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, business_id);
  if (!role) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  let financialContext = '';

  if (route.isFinancial) {
    // Fetch business context (paralel)
    const [{ data: business }, { data: accounts }, { data: transactions }] = await Promise.all([
      supabase.from('businesses').select('business_name, business_sector').eq('id', business_id).single(),
      supabase.from('accounts').select('*').eq('business_id', business_id),
      supabase
        .from('transactions')
        .select(`*, debit_account:accounts!transactions_debit_account_id_fkey(*), credit_account:accounts!transactions_credit_account_id_fkey(*), journal_lines(*, account:accounts(*))`)
        .eq('business_id', business_id)
        .is('deleted_at', null)
        .or('status.is.null,status.eq.posted')
        .order('date', { ascending: false })
        .limit(3000),
    ]);

    financialContext = buildFinancialContext(
      business?.business_name ?? 'Bisnis',
      business?.business_sector ?? '',
      (transactions ?? []) as unknown as Transaction[],
      (accounts ?? []) as unknown as Account[],
      new Date()
    );
  }

  const auth = await getVertexTokenAndProject();
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Vertex AI tidak dikonfigurasi.' }), { status: 503 });
  }
  const { token, projectId } = auth;

  const baseEndpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${GEMINI_VERTEX_MODEL}:generateContent`;

  const contents: GeminiContent[] = [
    ...history.map(m => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.content }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: route.isFinancial ? `${financialContext}\n\n${message}` : message }],
    },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sseEvent({ kind: 'route', persona: route.persona, isFinancial: route.isFinancial }));

        let navigateAction: NavigateAction | null = null;
        let emittedAnswer = false;
        let lastFinishReason: string | null = null;

        for (let iteration = 0; iteration < (route.isFinancial ? MAX_TOOL_ITERATIONS : 1); iteration++) {
          const reqBody: any = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              temperature: 1,
              // maxOutputTokens mencakup thinking + jawaban. gemini-3.5-flash adalah
              // thinking model yang reasoning-nya bisa menghabiskan seluruh budget,
              // menyisakan 0 token untuk jawaban → finishReason MAX_TOKENS dengan
              // answerChunks kosong ("tidak ada respons"). Naikkan plafon total dan
              // batasi thinkingBudget agar selalu ada ruang untuk jawaban final.
              maxOutputTokens: 16384,
              thinkingConfig: { includeThoughts: true, thinkingBudget: 8192 },
            },
          };

          if (route.isFinancial) {
            reqBody.tools = [{ function_declarations: TOOL_DEFINITIONS }];
            reqBody.tool_config = { function_calling_config: { mode: 'AUTO' } };
          } else {
            reqBody.tools = [{ googleSearch: {} }];
          }

          const { functionCalls, collectedParts, answerChunks, finishReason } = await streamGeminiIteration(
            baseEndpoint,
            token,
            reqBody,
            controller,
          );
          lastFinishReason = finishReason;

          if (functionCalls.length === 0) {
            // Tidak ada tool call → loop selesai. Kalau ada answer chunk, emit.
            // Kalau kosong (model cuma menghasilkan thinking lalu berhenti), JANGAN
            // diam — synthesis step di bawah yang akan memaksa jawaban final.
            for (const chunk of answerChunks) {
              controller.enqueue(sseEvent({ kind: 'answer', text: chunk }));
            }
            if (answerChunks.length > 0) emittedAnswer = true;
            break;
          }

          // Ada tool calls — tambah model response ke history
          contents.push({ role: 'model', parts: collectedParts as GeminiPart[] });

          // Eksekusi semua tool calls
          const toolResponseParts: FunctionResponsePart[] = [];
          for (const fc of functionCalls) {
            const result = await executeTool(fc.name, fc.args, business_id, user.id);

            if (fc.name === 'navigate_to' && result.data) {
              navigateAction = result.data as NavigateAction;
            }

            toolResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: { content: result.error ? { error: result.error } : result.data },
              },
            });
          }

          contents.push({ role: 'user', parts: toolResponseParts as unknown as GeminiPart[] });
        }

        // Forced synthesis step: loop berakhir tanpa jawaban (model cuma thinking, atau
        // kehabisan iterasi sambil masih memanggil tool). Paksa SATU panggilan terakhir
        // TANPA tools agar model wajib menuliskan jawaban final dari data yang sudah ada.
        // thinkingBudget kecil supaya mayoritas token dipakai untuk menulis jawaban.
        if (route.isFinancial && !emittedAnswer && !navigateAction) {
          try {
            // Directive ditaruh di system_instruction (bukan turn baru di contents)
            // agar tidak melanggar aturan alternating-role Gemini — contents bisa
            // berakhir dengan functionResponse (role user), menambah turn user lagi
            // akan invalid. Tanpa tools, model dipaksa menjawab dari konteks yang ada.
            const synthBody = {
              system_instruction: { parts: [{ text: `${systemPrompt}\n\n${SYNTHESIS_DIRECTIVE}` }] },
              contents,
              generationConfig: {
                temperature: 1,
                maxOutputTokens: 16384,
                thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 },
              },
            };
            const synth = await streamGeminiIteration(baseEndpoint, token, synthBody, controller);
            for (const chunk of synth.answerChunks) {
              controller.enqueue(sseEvent({ kind: 'answer', text: chunk }));
            }
            if (synth.answerChunks.length > 0) emittedAnswer = true;
            else lastFinishReason = synth.finishReason ?? lastFinishReason;
          } catch (synthErr) {
            console.error('[agent-query] synthesis step error:', synthErr);
          }
        }

        // Kalau setelah semua upaya tetap tidak ada jawaban (mis. diblokir safety),
        // beri tahu user secara eksplisit daripada diam-diam "(tidak ada respons)".
        if (route.isFinancial && !emittedAnswer && !navigateAction) {
          controller.enqueue(sseEvent({
            kind: 'error',
            text:
              `Maaf, saya belum berhasil menyusun jawaban untuk permintaan ini` +
              `${lastFinishReason ? ` (alasan: ${lastFinishReason})` : ''}. ` +
              `Coba persempit ruang lingkupnya — misalnya cocokkan per bulan atau per beberapa baris dulu.`,
          }));
        }

        // Emit navigate action kalau ada
        if (navigateAction) {
          controller.enqueue(sseEvent({ kind: 'navigate', data: navigateAction }));
        }

        // Emit model identifier
        controller.enqueue(sseEvent({ kind: 'model', text: 'gemini-3.5-flash-vertex' }));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
        console.error('[agent-query] stream error:', err);
        controller.enqueue(sseEvent({ kind: 'error', text: msg }));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
