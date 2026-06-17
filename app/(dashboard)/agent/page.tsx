'use client';

import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { ImportRevenueWidget, type SupportedChannel } from '@/components/agent/ImportRevenueWidget';
import {
  appendAgentImportStep,
  readAgentImportSession,
  startAgentImportSession,
  updateAgentImportSession,
} from '@/lib/agent/importSession';
import type { AgentStep } from '@/components/agent/AgentProgressToast';
import type { BusinessTypeKey } from '@/lib/salesChannels';
import type { SalesChannel } from '@/types';
import { isManagerRole } from '@/lib/roles';
import {
  Bot, AlertCircle, Send, ArrowUp, Sparkles, CheckCircle, XCircle, Loader2, Paperclip, Brain, ChevronRight, Globe,
  X, Network,
} from 'lucide-react';

const SUPPORTED_CHANNELS = [
  { value: 'airbnb', label: 'Airbnb', badges: ['airbnb'], description: 'CSV dari Airbnb Host dashboard', available: true, businessTypes: ['jasa'] },
  { value: 'tiktok_tokopedia', label: 'TikTok Shop / Tokopedia', badges: ['tiktok', 'tokopedia'], description: 'Ekspor pesanan Seller Center (gabungan)', available: true, businessTypes: ['produk', 'dagang'] },
  { value: 'shopee', label: 'Shopee', badges: ['shopee'], description: 'Laporan transaksi Shopee', available: false, businessTypes: ['produk', 'dagang'] },
] satisfies Array<SupportedChannel & { businessTypes?: BusinessTypeKey[] }>;

function channelHint(channel: string): string {
  if (channel === 'airbnb') {
    return 'Jurnal 3-baris per booking: Dr Bank · Dr Komisi · Cr Pendapatan Sewa (gross). Bianca menerjemahkan instruksi jadi filter & akun — angka tetap deterministik.';
  }
  if (channel === 'tiktok_tokopedia') {
    return '1 transaksi per pesanan selesai; duplikat Order ID dilewati otomatis. Bianca menerjemahkan instruksi jadi filter & akun — angka tetap deterministik.';
  }
  return 'Channel ini belum didukung. Pilih channel lain.';
}

function instructionPlaceholder(channel: string): string {
  return channel === 'airbnb'
    ? '"hanya bulan Mei" · "masukkan ke piutang dulu" · "jadikan draft"'
    : '"hanya TikTok bulan Mei" · "masukkan ke piutang dulu" · "jadikan draft"';
}

interface ImportResult {
  inserted: number;
  failed: number;
  skipped: number;
  duplicate?: number;
  errors: string[];
}

/** Sumber dari grounding Google Search (sitasi jawaban agent). */
interface GroundingSource {
  title: string;
  uri: string;
}

// ── Chat message model ───────────────────────────────────────────────────────
// Bubble yang muncul di stream: sapaan (assistant), pesan user, jawaban LLM
// general-purpose (assistant), dan blok progres/hasil run agent impor.
// Widget impor TIDAK lagi di stream — pindah ke panel kanan.
type ChatMessage =
  | { id: string; role: 'assistant'; kind: 'intro'; text: string; userName?: string }
  | { id: string; role: 'user'; kind: 'text'; text: string }
  | { id: string; role: 'assistant'; kind: 'answer'; text: string; thinking?: string; sources?: GroundingSource[]; model?: string; streaming?: boolean }
  | {
      id: string;
      role: 'assistant';
      kind: 'run';
      steps: AgentStep[];
      isRunning: boolean;
      result: ImportResult | null;
      fileName: string;
    };

// ID unik per pesan. Pakai randomUUID supaya tidak bentrok saat Fast Refresh
// me-reset counter modul sementara state `messages` lama masih hidup.
let messageSeq = 0;
const nextId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m${Date.now().toString(36)}-${++messageSeq}`;

export default function AgentPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const headerTools = buildAgentTools(t.aiChat.agentPage);
  const { activeBusinessId, userRole, activeBusiness, user } = useBusinessContext();
  const canManage = isManagerRole(userRole);
  const businessType = activeBusiness?.business_type;

  const availableChannels = useMemo(
    () =>
      SUPPORTED_CHANNELS.filter(
        (ch) => !ch.businessTypes || !businessType || (ch.businessTypes as readonly BusinessTypeKey[]).includes(businessType as BusinessTypeKey)
      ),
    [businessType]
  );

  const [selectedChannel, setSelectedChannel] = useState(
    () => availableChannels[0]?.value ?? SUPPORTED_CHANNELS[0].value
  );
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isChatting, setIsChatting] = useState(false);

  const userName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: nextId(),
      role: 'assistant',
      kind: 'intro',
      text: '',
      userName: '',
    },
  ]);

  // Patch nama user ke intro bubble setelah user context termuat
  useEffect(() => {
    if (!user) return;
    const name = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
      ?? user.email?.split('@')[0]
      ?? '';
    setMessages(prev => prev.map(m =>
      m.kind === 'intro' ? { ...m, userName: name } : m
    ));
  }, [user]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const stepIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const channel = SUPPORTED_CHANNELS.find(c => c.value === selectedChannel) ?? availableChannels[0] ?? SUPPORTED_CHANNELS[0];

  // Bila business_type baru termuat (async) dan channel terpilih jadi tak relevan,
  // pindahkan pilihan ke channel pertama yang tersedia.
  useEffect(() => {
    if (availableChannels.length > 0 && !availableChannels.some(c => c.value === selectedChannel)) {
      setSelectedChannel(availableChannels[0].value);
    }
  }, [availableChannels, selectedChannel]);

  // Auto-scroll ke bawah saat pesan/langkah baru muncul.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Batalkan chat yang masih streaming saat halaman ditinggalkan.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Tambahkan langkah agent ke bubble "run" yang sedang aktif (terakhir).
  const pushStepToRun = useCallback((runId: string, step: Omit<AgentStep, 'id' | 'timestamp'>) => {
    const fullStep: AgentStep = { ...step, id: String(++stepIdRef.current), timestamp: Date.now() };
    if (activeBusinessId) appendAgentImportStep(activeBusinessId, fullStep);
    setMessages(prev => prev.map(m =>
      m.id === runId && m.kind === 'run' ? { ...m, steps: [...m.steps, fullStep] } : m
    ));
  }, [activeBusinessId]);

  const updateRun = useCallback((runId: string, patch: Partial<Extract<ChatMessage, { kind: 'run' }>>) => {
    setMessages(prev => prev.map(m =>
      m.id === runId && m.kind === 'run' ? { ...m, ...patch } : m
    ));
  }, []);

  const handleCallAgent = useCallback(async () => {
    if (!selectedFile || !activeBusinessId || runningRef.current || !channel.available) return;
    runningRef.current = true;
    hasNavigatedRef.current = false;

    const trimmedInstruction = input.trim();
    const fileName = selectedFile.name;
    const runId = nextId();

    setIsRunning(true);
    startAgentImportSession(activeBusinessId);

    // Tambah bubble instruksi user (kalau ada) + bubble run kosong.
    setMessages(prev => {
      const additions: ChatMessage[] = [];
      const label = trimmedInstruction
        ? `${trimmedInstruction}\n\n📎 ${fileName}`
        : `📎 ${fileName}`;
      additions.push({ id: nextId(), role: 'user', kind: 'text', text: label });
      additions.push({ id: runId, role: 'assistant', kind: 'run', steps: [], isRunning: true, result: null, fileName });
      return [...prev, ...additions];
    });

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('businessId', activeBusinessId);
    formData.append('channel', selectedChannel);
    if (trimmedInstruction) formData.append('instruction', trimmedInstruction);

    setInput('');

    try {
      const response = await fetch('/api/agent/import-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.body) {
        pushStepToRun(runId, { type: 'error', message: `Server error: ${response.status}` });
        updateRun(runId, { isRunning: false });
        updateAgentImportSession(activeBusinessId, { status: 'error' });
        setIsRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.trim();
          if (!dataLine.startsWith('data: ')) continue;
          const json = dataLine.slice(6);

          try {
            const event = JSON.parse(json);

            if (event.type === 'done') {
              const session = readAgentImportSession(activeBusinessId);
              if (session?.status === 'running') {
                updateAgentImportSession(activeBusinessId, { status: 'completed' });
              }
              updateRun(runId, { isRunning: false });
              streamDone = true;
              setIsRunning(false);
              break;
            }

            if (event.type === 'progress') {
              updateAgentImportSession(activeBusinessId, {
                status: 'running',
                current: event.current,
                total: event.total,
              });

              if ((event.current ?? 0) > 0 && !hasNavigatedRef.current) {
                hasNavigatedRef.current = true;
                // Toast progres (lewat session storage) tetap muncul di /transactions.
                router.push('/transactions?agentImport=1');
              }
            }

            if (event.type === 'result' && event.data && !event.data.needsAccountConfirmation) {
              updateRun(runId, {
                result: {
                  inserted: event.data.inserted ?? 0,
                  failed: event.data.failed ?? 0,
                  skipped: event.data.skipped ?? 0,
                  duplicate: event.data.duplicate ?? 0,
                  errors: event.data.errors ?? [],
                },
              });
              updateAgentImportSession(activeBusinessId, { status: 'completed' });
            }

            pushStepToRun(runId, {
              type: event.type,
              message: event.message ?? '',
              current: event.current,
              total: event.total,
            });

            if (event.type === 'error') {
              updateAgentImportSession(activeBusinessId, { status: 'error' });
            }
          } catch {
            // skip malformed event
          }
        }
      }

      if (streamDone) {
        await reader.cancel().catch(() => {});
      }
    } catch (err) {
      pushStepToRun(runId, { type: 'error', message: err instanceof Error ? err.message : 'Gagal menghubungi server' });
      updateRun(runId, { isRunning: false });
      updateAgentImportSession(activeBusinessId, { status: 'error' });
    } finally {
      const session = readAgentImportSession(activeBusinessId);
      if (session?.status === 'running') {
        updateAgentImportSession(activeBusinessId, { status: 'error' });
      }
      updateRun(runId, { isRunning: false });
      setIsRunning(false);
      runningRef.current = false;
      // Bersihkan file supaya widget kembali ke keadaan siap untuk run berikutnya.
      setSelectedFile(null);
    }
  }, [selectedFile, activeBusinessId, selectedChannel, input, channel.available, pushStepToRun, updateRun, router]);

  // Chat general-purpose: pure pass-through ke LLM (Vertex). Tidak terkait keuangan
  // AXION — bisa terima topik apapun. Streaming SSE, dukung kind thinking/answer.
  const sendChatMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isChatting || isRunning) return;

    const answerId = nextId();
    // Riwayat dialog (hanya bubble teks user + jawaban LLM) untuk konteks percakapan.
    const history = messages
      .filter((m): m is Extract<ChatMessage, { kind: 'text' | 'answer' }> => m.kind === 'text' || m.kind === 'answer')
      .filter(m => (m.kind === 'answer' ? !m.streaming && !!m.text : true))
      .slice(-12)
      .map(m => ({ role: m.role, content: m.text }));

    setMessages(prev => [
      ...prev,
      { id: nextId(), role: 'user', kind: 'text', text: trimmed },
      { id: answerId, role: 'assistant', kind: 'answer', text: '', streaming: true },
    ]);
    setInput('');
    setIsChatting(true);

    abortRef.current = new AbortController();

    const patchAnswer = (patch: Partial<Extract<ChatMessage, { kind: 'answer' }>>) => {
      setMessages(prev => prev.map(m =>
        m.id === answerId && m.kind === 'answer' ? { ...m, ...patch } : m
      ));
    };

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({ messages: [...history, { role: 'user', content: trimmed }] }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Gagal menghubungi AI' }));
        throw new Error((err as { error?: string }).error ?? 'Gagal menghubungi AI');
      }

      const model = res.headers.get('X-AI-Model') || undefined;
      if (model) patchAnswer({ model });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let thinking = '';
      let sources: GroundingSource[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            if (json.kind === 'sources' && Array.isArray(json.sources)) {
              // Dedup by uri lintas chunk (grounding bisa muncul beberapa kali).
              const seen = new Set(sources.map(s => s.uri));
              for (const s of json.sources as GroundingSource[]) {
                if (s?.uri && !seen.has(s.uri)) { seen.add(s.uri); sources.push(s); }
              }
              patchAnswer({ sources: [...sources] });
            } else if (json.text) {
              if (json.kind === 'thinking') thinking += json.text;
              else accumulated += json.text;
              patchAnswer({ text: accumulated, thinking: thinking || undefined });
            }
          } catch { /* skip */ }
        }
      }

      patchAnswer({
        text: accumulated || '_(tidak ada respons)_',
        thinking: thinking || undefined,
        sources: sources.length ? sources : undefined,
        streaming: false,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') { patchAnswer({ streaming: false }); return; }
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      patchAnswer({ text: `⚠️ ${msg}`, streaming: false });
    } finally {
      setIsChatting(false);
      abortRef.current = null;
    }
  }, [messages, isChatting, isRunning]);

  // Router submit: ada file → jalankan agent import; tanpa file → chat LLM general.
  const handleSubmit = useCallback(() => {
    if (selectedFile) handleCallAgent();
    else sendChatMessage(input);
  }, [selectedFile, handleCallAgent, sendChatMessage, input]);

  if (!canManage) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Akses Terbatas</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Hanya Business Manager yang dapat menggunakan Agentic Workspace.</p>
      </div>
    );
  }

  if (!activeBusinessId) return null;

  const busy = isRunning || isChatting;
  // Mode import (ada file) → butuh channel available. Mode chat (tanpa file) → butuh teks.
  const canSend = busy
    ? false
    : selectedFile
    ? channel.available
    : input.trim().length > 0;
  const importMode = !!selectedFile;

  const importWidget = (
    <ImportRevenueWidget
      channels={availableChannels}
      selectedChannel={selectedChannel}
      onSelectChannel={setSelectedChannel}
      dropdownOpen={channelDropdownOpen}
      onToggleDropdown={() => setChannelDropdownOpen(o => !o)}
      onCloseDropdown={() => setChannelDropdownOpen(false)}
      selectedFile={selectedFile}
      onFile={setSelectedFile}
      onClearFile={() => setSelectedFile(null)}
      dragOver={dragOver}
      onDragStateChange={setDragOver}
      disabled={isRunning}
      hint={channelHint(selectedChannel)}
    />
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] w-full">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <Image
              src={ORCHESTRATOR_AVATAR}
              alt="AXION Agent"
              width={36}
              height={36}
              className="w-9 h-9 rounded-full object-contain p-1 ring-2 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-100 shrink-0"
            />
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight shrink-0">Agentic Workspace</h1>
            {/* Avatar sub-agent yang dikoordinasi, sembunyi di layar kecil */}
            <div className="hidden sm:flex items-center gap-2 pl-2">
              {SUB_AGENT_AVATARS.map(src => (
                <Image
                  key={src}
                  src={src}
                  alt="sub-agent"
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 min-w-0">
            {/* Chip nama tools — berjejer di header (sembunyi di layar kecil) */}
            <div className="hidden lg:flex items-center gap-1.5">
              {headerTools.map(tool => (
                <span
                  key={tool.fn}
                  title={tool.label}
                  className="px-2 py-1 rounded-full text-[10px] font-mono text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 whitespace-nowrap"
                >
                  {tool.fn}
                </span>
              ))}
            </div>
            <AgentCapabilitiesBadge />
          </div>
        </div>
      </div>

      {/* Body: chat (kiri) + panel widget impor (kanan) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Kolom chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Widget impor — versi mobile (panel kanan disembunyikan di < lg) */}
          <div className="lg:hidden px-4 pt-4 shrink-0">
            {importWidget}
          </div>

          {/* Chat stream */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-5 space-y-4 min-h-0 bg-white dark:bg-gray-900"
          >
            {messages.map(msg => (
              <ChatRow key={msg.id} message={msg} />
            ))}
          </div>

          {/* Composer */}
          <div className="px-3 md:px-6 py-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-4 pr-1.5 py-1.5 focus-within:border-primary-400 dark:focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
              {/* Indikator file terpilih */}
              {selectedFile && (
                <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 max-w-[120px]">
                  <Paperclip className="w-3 h-3 shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                </span>
              )}
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSend) { e.preventDefault(); handleSubmit(); } }}
                disabled={busy || (importMode && !channel.available)}
                placeholder={
                  importMode
                    ? !channel.available
                      ? 'Channel belum didukung — pilih channel lain'
                      : `Instruksi (opsional): ${instructionPlaceholder(selectedChannel)}`
                    : 'Tanya apa saja, atau unggah CSV di panel untuk impor…'
                }
                className="flex-1 min-w-0 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-[13px] leading-[1.5] focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={!canSend}
                title={importMode ? 'Panggil Bianca' : 'Kirim'}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full font-semibold text-[13px] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                style={canSend ? { background: 'radial-gradient(circle at 30% 25%, #a5b4fc 0%, #6366f1 45%, #3730a3 100%)' } : { background: '#9ca3af' }}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : importMode ? (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Panggil Bianca</span>
                  </>
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
              {importMode
                ? 'Bianca menerjemahkan instruksi jadi filter & akun — angka tetap deterministik.'
                : 'Chat bebas topik · Unggah CSV di panel kanan untuk impor revenue channel'}
            </p>
          </div>
        </div>

        {/* Panel widget impor — desktop (sticky, tidak tenggelam di chat) */}
        <aside className="hidden lg:block w-[360px] xl:w-[400px] shrink-0 border-l border-gray-200 dark:border-gray-800 overflow-y-auto p-5 bg-gray-50/50 dark:bg-gray-900/30">
          {importWidget}
        </aside>
      </div>
    </div>
  );
}

// ── Row renderer ─────────────────────────────────────────────────────────────

function IntroCard({ message }: { message: Extract<ChatMessage, { kind: 'intro' }> }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 select-none min-h-[60%]">
      <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-white dark:ring-gray-800 shadow-md mb-6 bg-white dark:bg-gray-100">
        <Image src={ORCHESTRATOR_AVATAR} alt="AXION Agent" width={80} height={80} className="w-full h-full object-contain p-2" />
      </div>
      <h2 className="text-3xl md:text-4xl font-light text-gray-800 dark:text-gray-100 mb-10 leading-snug tracking-tight">
        Halo{message.userName ? ` ${message.userName}` : ''}, mau melakukan apa hari ini?
      </h2>
    </div>
  );
}

function ChatRow({ message }: { message: ChatMessage }) {
  if (message.kind === 'intro') {
    return <IntroCard message={message} />;
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-stone-800 dark:bg-gray-100 text-white dark:text-gray-900 px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }

  // assistant rows — avatar orchestrator (AXION Agent)
  return (
    <div className="flex gap-2.5">
      <Image
        src={ORCHESTRATOR_AVATAR}
        alt="AXION Agent"
        width={28}
        height={28}
        className="w-7 h-7 rounded-full object-contain p-0.5 shrink-0 mt-0.5 ring-2 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-100"
      />
      <div className="min-w-0 flex-1">

        {message.kind === 'answer' && <AnswerBubble message={message} />}

        {message.kind === 'run' && <RunBubble run={message} />}
      </div>
    </div>
  );
}

// Render inline markdown sederhana: **bold**, *italic*, `code`.
// Renderer minimal (bukan react-markdown) — cukup untuk gaya jawaban LLM.
function renderInline(text: string): ReactNode[] {
  // Pisah berdasar token; urutan: bold dulu (** lebih spesifik dari *), lalu code, lalu italic.
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return tokens.map((tok, j) => {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return <strong key={j} className="text-gray-900 dark:text-gray-50">{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return <code key={j} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[12px] font-mono">{tok.slice(1, -1)}</code>;
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      return <em key={j}>{tok.slice(1, -1)}</em>;
    }
    return tok;
  });
}

function AnswerBubble({ message }: { message: Extract<ChatMessage, { kind: 'answer' }> }) {
  // Hanya tampilkan dot-typing kalau benar-benar belum ada apa-apa (teks & thinking).
  const isEmpty = message.streaming && !message.text && !message.thinking;
  return (
    <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-sm px-3.5 py-2.5 text-[13px] leading-relaxed">
      {isEmpty ? (
        <span className="inline-flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      ) : (
        <>
          {message.thinking && (
            <ThinkingAccordion
              text={message.thinking}
              streaming={!!message.streaming && !message.text}
            />
          )}
          {message.text && (
            <div className="space-y-1">
              {message.text.split('\n').map((line, i) => {
                if (!line.trim()) return <div key={i} className="h-1" />;

                // Horizontal rule: --- / *** / ___
                if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
                  return <hr key={i} className="my-2 border-gray-100 dark:border-gray-700" />;
                }

                // Heading: # / ## / ### → ukuran turun bertahap, tetap bold.
                const heading = line.match(/^(#{1,6})\s+(.*)$/);
                if (heading) {
                  const level = heading[1].length;
                  const sizeCls = level <= 2 ? 'text-[14px]' : 'text-[13px]';
                  return (
                    <div key={i} className={`font-semibold text-gray-900 dark:text-gray-50 ${sizeCls} mt-1.5`}>
                      {renderInline(heading[2])}
                    </div>
                  );
                }

                // List: bullet (-, *, •) atau bernomor (1. 2. …)
                const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
                const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
                if (bullet || numbered) {
                  const content = bullet ? bullet[1] : numbered![2];
                  return (
                    <div key={i} className="flex gap-1.5">
                      {bullet ? (
                        <span className="mt-1.5 w-1 h-1 rounded-full shrink-0 bg-gray-400 dark:bg-gray-500" />
                      ) : (
                        <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">{numbered![1]}.</span>
                      )}
                      <span>{renderInline(content)}</span>
                    </div>
                  );
                }

                return <div key={i}><span>{renderInline(line)}</span></div>;
              })}
            </div>
          )}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1 mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <Globe className="w-3 h-3" />
                Sumber
              </div>
              <div className="flex flex-wrap gap-1">
                {message.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.uri}
                    className="inline-flex items-center max-w-[200px] truncate rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-300 hover:border-primary-300 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
                  >
                    <span className="truncate">{s.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {message.model && !message.streaming && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
              <Sparkles className="w-2.5 h-2.5" />
              <span>{message.model}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Peta orchestrator + sub-agent AXION ───────────────────────────────────────
// Halaman /agent = "rumah" AXION Agent (orchestrator). Badge ini menampilkan peta
// sub-agent yang ada di sistem + kapabilitas tool-calling. Bersifat INFORMASI
// (peta), bukan klaim bahwa halaman ini menjalankan semuanya — tiap sub-agent
// diakses dari tempatnya sendiri (lihat field `access`).
// Avatar orchestrator (AXION Agent). Sub-agent avatar di buildSubAgents.
const ORCHESTRATOR_AVATAR = '/persona/agent.png';
const SUB_AGENT_AVATARS = [
  '/persona/stanley.png',
  '/persona/sri-mulyani.png',
  '/persona/bianca.png',
  '/persona/concierge.png',
];

type AgentPageT = ReturnType<typeof useLanguage>['t']['aiChat']['agentPage'];

// Nama & avatar tetap (tak diterjemahkan); role/desc/access dari i18n.
function buildSubAgents(ap: AgentPageT): {
  name: string;
  role: string;
  desc: string;
  access: string;
  avatar: string;
}[] {
  return [
    { name: 'Stanley', avatar: '/persona/stanley.png', role: ap.analystRole, desc: ap.analystDesc, access: ap.accessAsk },
    { name: 'Sri Mulyani', avatar: '/persona/sri-mulyani.png', role: ap.taxRole, desc: ap.taxDesc, access: ap.accessAsk },
    { name: 'Bianca', avatar: '/persona/bianca.png', role: ap.bookkeeperRole, desc: ap.bookkeeperDesc, access: ap.accessEntry },
    { name: 'Concierge', avatar: '/persona/concierge.png', role: ap.conciergeRole, desc: ap.conciergeDesc, access: ap.accessLeads },
  ];
}

// Nama fungsi (fn) tetap; label dari i18n.
function buildAgentTools(ap: AgentPageT): { label: string; fn: string }[] {
  return [
    { label: ap.toolQueryTransactions, fn: 'query_transactions' },
    { label: ap.toolFinancialSummary, fn: 'get_financial_summary' },
    { label: ap.toolContacts, fn: 'get_contacts' },
    { label: ap.toolBusinessInfo, fn: 'get_business_info' },
    { label: ap.toolNavigate, fn: 'navigate_to' },
  ];
}

function AgentCapabilitiesBadge() {
  const { t } = useLanguage();
  const ap = t.aiChat.agentPage;
  const subAgents = buildSubAgents(ap);
  const agentTools = buildAgentTools(ap);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        aria-expanded={open}
      >
        <Network className="w-3.5 h-3.5" />
        <span>{ap.capabilitiesChip}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 z-40 w-[370px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden"
            >
              <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Image
                    src={ORCHESTRATOR_AVATAR}
                    alt="AXION Agent"
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-contain p-1 shrink-0 ring-2 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-100"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{ap.orchestratorTitle}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{ap.orchestratorSubtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                  aria-label="Tutup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                <div className="px-2 py-2 space-y-0.5">
                  {subAgents.map(a => {
                    return (
                      <div key={a.name} className="flex items-start gap-2.5 px-2 py-2 rounded-xl">
                        <Image
                          src={a.avatar}
                          alt={a.name}
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-700"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            {a.name} <span className="font-normal text-gray-400 dark:text-gray-500">· {a.role}</span>
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{a.desc}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{a.access}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                    {ap.toolsSectionTitle}
                  </p>
                  <ul className="space-y-1.5">
                    {agentTools.map(tool => (
                      <li key={tool.fn} className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                        <Sparkles className="w-3 h-3 mt-0.5 text-primary-400 dark:text-primary-500 shrink-0" />
                        <span className="min-w-0">
                          <span className="block leading-tight">{tool.label}</span>
                          <code className="block text-[10px] text-gray-400 dark:text-gray-500 font-mono">{tool.fn}</code>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Accordion proses berpikir (reasoning model). Default tertutup; auto-buka saat
// thinking sedang mengalir (sebelum jawaban muncul), auto-tutup begitu selesai.
function ThinkingAccordion({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(false);
  const wasStreaming = useRef(false);

  useEffect(() => {
    if (streaming && !wasStreaming.current) setOpen(true);
    if (!streaming && wasStreaming.current) setOpen(false);
    wasStreaming.current = streaming;
  }, [streaming]);

  return (
    <div className="mb-2 rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-gray-50/60 dark:bg-gray-800/40 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors"
      >
        <Brain className={`w-3 h-3 shrink-0 ${streaming ? 'text-primary-500 dark:text-primary-400' : ''}`} />
        <span className="flex-1 text-left">{streaming ? 'Sedang berpikir…' : 'Proses berpikir'}</span>
        {streaming && (
          <span className="inline-flex gap-0.5">
            <span className="w-1 h-1 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
        <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-0.5 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-wrap border-t border-gray-200/60 dark:border-gray-700/60 max-h-52 overflow-y-auto">
              {text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RunBubble({ run }: { run: Extract<ChatMessage, { kind: 'run' }> }) {
  const progressStep = [...run.steps].reverse().find(s => s.type === 'progress' && s.total);
  const lastIsError = run.steps[run.steps.length - 1]?.type === 'error';

  return (
    <div className="max-w-[440px] rounded-2xl rounded-tl-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700">
        {run.isRunning ? (
          <div className="relative shrink-0">
            <Bot className="w-4 h-4 text-primary-500 dark:text-primary-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary-400 rounded-full animate-ping opacity-75" />
          </div>
        ) : lastIsError ? (
          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        ) : (
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
        )}
        <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
          {run.isRunning ? 'Bianca sedang membukukan…' : lastIsError ? 'Bianca berhenti' : 'Bianca selesai'}
        </span>
        <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">{run.fileName}</span>
      </div>

      {/* Progress bar */}
      {progressStep && progressStep.total ? (
        <div className="px-3.5 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
            <span>Progres import</span>
            <span className="tabular-nums">{progressStep.current}/{progressStep.total}</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((progressStep.current ?? 0) / progressStep.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      ) : null}

      {/* Steps log */}
      <div className="max-h-56 overflow-y-auto px-3.5 py-2.5 space-y-2">
        {run.steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2"
          >
            <span className="flex-shrink-0 mt-0.5">
              {step.type === 'thinking' && <Sparkles className="w-3.5 h-3.5 text-primary-400" />}
              {step.type === 'progress' && (
                i === run.steps.length - 1 && run.isRunning
                  ? <Loader2 className="w-3.5 h-3.5 text-primary-500 animate-spin" />
                  : <span className="w-3.5 h-3.5 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-primary-400" /></span>
              )}
              {step.type === 'result' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
              {step.type === 'error' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
            </span>
            <span className={`text-[12px] leading-relaxed ${
              step.type === 'error'
                ? 'text-red-600 dark:text-red-400'
                : step.type === 'result'
                ? 'text-emerald-700 dark:text-emerald-300 font-medium'
                : 'text-gray-600 dark:text-gray-300'
            }`}>
              {step.message}
            </span>
          </motion.div>
        ))}

        {run.isRunning && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary-400"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Result summary */}
      {run.result && !run.isRunning && (
        <div className={`px-3.5 py-2.5 border-t text-[12px] space-y-0.5 ${
          run.result.failed > 0
            ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-100 dark:border-amber-900/30'
            : 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-100 dark:border-emerald-900/30'
        }`}>
          <p className="text-gray-700 dark:text-gray-200">✓ <strong>{run.result.inserted}</strong> transaksi diimpor sebagai <em>posted</em></p>
          {run.result.skipped > 0 && <p className="text-gray-500 dark:text-gray-400">⊘ <strong>{run.result.skipped}</strong> dilewati (bukan pesanan selesai)</p>}
          {(run.result.duplicate ?? 0) > 0 && <p className="text-gray-500 dark:text-gray-400">⊘ <strong>{run.result.duplicate}</strong> duplikat dilewati</p>}
          {run.result.failed > 0 && <p className="text-amber-700 dark:text-amber-400">✗ <strong>{run.result.failed}</strong> gagal</p>}
          {run.result.errors.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {run.result.errors.map((e, i) => (
                <p key={i} className="text-red-600 dark:text-red-400">• {e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
