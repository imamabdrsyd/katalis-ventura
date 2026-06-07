'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, User, Loader2, RotateCcw, MessageSquare, PlusCircle, Check, Paperclip, FileSpreadsheet, Brain, ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { parseExcelFile, parseExcelRaw, applyColumnMapping, validateFile, type ColumnMapping } from '@/lib/import/excelParser';
import { validateRowsSmart } from '@/lib/import/excelValidator';
import { smartResolveTransaction } from '@/lib/import/smartResolver';
import { getAccounts } from '@/lib/api/accounts';
import { createTransactionsBulk, type TransactionInsert } from '@/lib/api/transactions';
import { uploadAttachment } from '@/lib/storage/attachments';
import { matchAccountByKeywords } from '@/lib/ocr/matcher';
import type { OcrResult } from '@/lib/ocr/types';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useBusinessContext } from '@/context/BusinessContext';
import { CATEGORY_BADGE_CLASSES, CATEGORY_LABELS } from '@/lib/categoryColors';
import { MODEL_LABELS } from '@/lib/ai/provider';

type ChatMode = 'ask' | 'record';

/**
 * Parse nominal uang dari berbagai format tanpa keliru memotong digit.
 * Mendukung:
 * - Indonesia: "1.234.567" (titik=ribuan) → 1234567 · "1.234.567,89" → 1234567.89
 * - Internasional: "$1,234.56" (koma=ribuan, titik=desimal) → 1234.56
 * - Plain: 1234567 / "1234567" → 1234567
 * Heuristik: pemisah yang muncul TERAKHIR & diikuti 1-2 digit = desimal; sisanya ribuan.
 */
function sanitizeAmountFlexible(value: number | string): number {
  if (typeof value === 'number') return value;
  let s = String(value).trim();
  if (!s) return NaN;

  // Buang simbol mata uang & spasi, simpan digit, titik, koma, minus.
  s = s.replace(/[^\d.,-]/g, '');
  if (!s) return NaN;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot === -1 && lastComma === -1) {
    return parseFloat(s);
  }

  // Pemisah desimal = yang posisinya paling akhir.
  const decimalSep = lastComma > lastDot ? ',' : '.';
  const thousandSep = decimalSep === ',' ? '.' : ',';

  // Buang semua pemisah ribuan, ubah desimal jadi titik.
  const cleaned = s
    .split(thousandSep).join('')
    .replace(decimalSep, '.');

  // Kalau "desimal" ternyata >2 digit, kemungkinan itu ribuan (mis. "1.234" Indonesia).
  const decimalPart = cleaned.split('.')[1];
  if (decimalPart && decimalPart.length > 2) {
    return parseFloat(cleaned.replace('.', ''));
  }
  return parseFloat(cleaned);
}

/**
 * Konversi berbagai format tanggal → ISO "YYYY-MM-DD" (format wajib server).
 * Mendukung: YYYY-MM-DD (passthrough), DD/MM/YYYY, MM/DD/YYYY (Airbnb/US),
 * DD-MM-YYYY, serta Date object. Return null kalau tidak bisa di-parse.
 *
 * Heuristik DD/MM vs MM/DD: kalau salah satu bagian > 12, itu pasti hari →
 * bisa tentukan urutannya. Kalau ambigu (keduanya <= 12), default MM/DD/YYYY
 * (format Airbnb & laporan marketplace internasional).
 */
function toISODate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }
  const s = String(value).trim();
  if (!s) return null;

  // Sudah ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd/mm/yyyy atau mm/dd/yyyy (separator / atau -)
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    const n1 = parseInt(a, 10);
    const n2 = parseInt(b, 10);
    let day: number, month: number;
    if (n1 > 12) {        // a pasti hari → DD/MM
      day = n1; month = n2;
    } else if (n2 > 12) { // b pasti hari → MM/DD
      month = n1; day = n2;
    } else {              // ambigu → default MM/DD (Airbnb/US)
      month = n1; day = n2;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Fallback: coba Date parser bawaan (mis. "Dec 30 2024")
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

const MODE_PAGE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
  }),
  center: {
    x: 0,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
  }),
};

export interface ImportPreview {
  fileName: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  // Transaksi siap-insert (sudah di-resolve akun) — disimpan untuk eksekusi saat konfirmasi
  ready: TransactionInsert[];
  lowConfidenceCount: number;
}

export interface TransactionDraft {
  name: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  debit_account_id: string;
  credit_account_id: string;
  debit_account_code: string;
  credit_account_code: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  // Reasoning model (DeepSeek R1 / Gemini thinking) — ditampilkan di accordion collapsible
  thinking?: string;
  streaming?: boolean;
  // Preview transaksi (mode record) — kalau ada, render sebagai card konfirmasi
  draft?: TransactionDraft;
  draftStatus?: 'pending' | 'saving' | 'saved' | 'cancelled';
  // Preview import file (mode record + attach file)
  importPreview?: ImportPreview;
  importStatus?: 'pending' | 'importing' | 'done' | 'cancelled';
  importResult?: { inserted: number; failed: number };
  // Pertanyaan follow-up dari LLM import (provider Vertex) saat ada baris yang ragu.
  // Saat aktif, jawaban user berikutnya diteruskan ke LLM untuk finalisasi impor.
  importQuestions?: string[];
  // Aksi navigasi dari agent tool calling — tampil sebagai tombol di bawah jawaban
  navigateAction?: {
    page: string;
    filters?: Record<string, string>;
    message: string;
    url: string;
  };
}

/**
 * State impor LLM yang menunggu jawaban klarifikasi user (provider Vertex).
 * Disimpan terpisah dari Message supaya jawaban user (pesan berikutnya) bisa
 * digabung dengan raw rows + pertanyaan lalu dikirim ulang ke /api/ai/parse-import.
 */
interface PendingLLMImport {
  fileName: string;
  rows: Record<string, unknown>[];
  questions: string[];
  provider: 'gemini-vertex' | 'claude';
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
}

const SUGGESTED_QUESTIONS = [
  'Kenapa bulan ini rugi?',
  'Kategori beban terbesar apa?',
  'Bagaimana tren revenue 3 bulan terakhir?',
  'Berapa burn rate saat ini?',
];

// Pesan sapaan/akknowledgment singkat yang tidak punya muatan pertanyaan.
// Di-handle lokal tanpa memanggil LLM (hemat kuota + tidak fetch 3000 transaksi).
// Hanya berlaku di mode Ask. Daftar dibuat konservatif — hanya frasa yang
// hampir pasti basa-basi, supaya tidak salah skip pertanyaan asli.
const SMALL_TALK = new Set([
  'oi', 'hai', 'halo', 'hallo', 'hi', 'hello', 'hey', 'p', 'pp', 'woi', 'oy',
  'ok', 'oke', 'okay', 'oce', 'sip', 'siap', 'mantap', 'mantul', 'noted', 'baik',
  'ya', 'iya', 'yo', 'yup', 'yoi', 'yes', 'y', 'ga', 'gak', 'nggak', 'no', 'tidak',
  'makasih', 'thanks', 'thank you', 'terima kasih', 'tq', 'thx', 'trims',
  'test', 'tes', 'testing', 'coba', 'wkwk', 'wkwkwk', 'haha', 'hehe', 'lol',
]);

/** Balasan ramah untuk small talk — bervariasi supaya tidak terasa robotik. */
function smallTalkReply(text: string): string {
  const t = text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  if (/(makasih|thanks|thank|^tq$|^thx$|trims)/.test(t)) {
    return 'Sama-sama! Ada lagi yang mau ditanyakan soal keuangan bisnismu?';
  }
  if (/^(oi|hai|halo|hallo|hi|hello|hey|p|pp|woi|oy)$/.test(t)) {
    return 'Halo! 👋 Mau tanya apa soal keuangan bisnismu? Misalnya tren revenue, beban terbesar, atau kondisi laba rugi bulan ini.';
  }
  return 'Siap! Kalau ada yang mau dianalisis dari keuangan bisnismu, tinggal tanya ya. 😊';
}

/** Apakah teks ini small talk murni (≤3 kata & semua token ada di SMALL_TALK)? */
function isSmallTalk(text: string): boolean {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').trim();
  if (!cleaned) return true; // hanya emoji/tanda baca
  const words = cleaned.split(/\s+/);
  if (words.length > 3) return false;
  return words.every(w => SMALL_TALK.has(w));
}

// Konversi navigate_to page + filters → URL path dengan query params
function buildNavigateUrl(page: string, filters?: Record<string, string>): string {
  const paths: Record<string, string> = {
    transactions: '/transactions',
    'income-statement': '/income-statement',
    'balance-sheet': '/balance-sheet',
    'cash-flow': '/cash-flow',
    'general-ledger': '/general-ledger',
    'trial-balance': '/trial-balance',
    accounts: '/accounts',
    reports: '/reports',
    dashboard: '/dashboard',
  };
  const base = paths[page] ?? `/${page}`;
  if (!filters || Object.keys(filters).length === 0) return base;
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  );
  return `${base}?${params.toString()}`;
}

export function AIChatPanel({ isOpen, onClose, businessId, businessName }: AIChatPanelProps) {
  const { t } = useLanguage();
  const { user } = useBusinessContext();
  const router = useRouter();
  const modeToggleLayoutId = useId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('ask');
  const [modeDirection, setModeDirection] = useState(1);
  const [activeModel, setActiveModel] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const p = localStorage.getItem('axion_ai_provider');
      if (p === 'claude') return 'claude-sonnet-4-6';
      if (p === 'gemini-vertex') return 'gemini-2.5-flash-vertex';
      return null;
    }
    return null;
  });
  // 'auto' = AXION chain (Gemini→Groq), 'claude' = Claude Sonnet via Vertex AI, 'gemini-vertex' = Gemini via Vertex AI
  const [selectedProvider, setSelectedProvider] = useState<'auto' | 'claude' | 'gemini-vertex'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('axion_ai_provider') as 'auto' | 'claude' | 'gemini-vertex') ?? 'auto';
    }
    return 'auto';
  });
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  // Apakah Claude (Vertex AI) dikonfigurasi di server — kalau tidak, opsi disabled
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  // Konteks transaksi yang nominalnya belum disebut — diisi saat API balas
  // 'needs_amount', dipakai untuk menggabungkan nominal dari pesan berikutnya.
  const [pendingTx, setPendingTx] = useState<{
    name: string;
    category_hint: string | null;
    date: string | null;
  } | null>(null);
  // Impor LLM (Vertex) yang menunggu jawaban klarifikasi user.
  const [pendingLLMImport, setPendingLLMImport] = useState<PendingLLMImport | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      // Selalu refresh status Claude; badge standby hanya diisi bila belum ada model aktif.
      fetch('/api/ai/status')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.model) setActiveModel(current => current ?? d.model);
          setClaudeAvailable(!!d?.claudeAvailable);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');

    // Small talk ("oi", "ok", "makasih") di-balas lokal — tidak panggil LLM
    // maupun fetch transaksi. Hemat kuota Gemini & mempercepat respons.
    if (isSmallTalk(trimmed)) {
      setMessages(prev => [...prev, { role: 'assistant', content: smallTalkReply(trimmed) }]);
      return;
    }

    setLoading(true);

    // Placeholder streaming message
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          business_id: businessId,
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          provider: selectedProvider,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal menghubungi AI' }));
        throw new Error(err.error ?? 'Gagal menghubungi AI');
      }

      // Baca provider/model dari header untuk ditampilkan di UI
      const model = res.headers.get('X-AI-Model');
      if (model) setActiveModel(model);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let thinking = '';
      let buffer = '';

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
            if (json.text) {
              if (json.kind === 'thinking') thinking += json.text;
              else accumulated += json.text;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) {
                  updated[updated.length - 1] = { ...last, content: accumulated, thinking: thinking || undefined };
                }
                return updated;
              });
            }
          } catch {
            // skip
          }
        }
      }

      // Finalize — remove streaming flag
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: accumulated || '_(tidak ada respons)_',
            thinking: thinking || undefined,
          };
        }
        return updated;
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming) {
          updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        }
        return updated;
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [messages, loading, businessId, selectedProvider]);

  // Agent query (Gemini Vertex tool calling) — untuk provider gemini-vertex di mode ask.
  // Berbeda dari sendMessage (SSE streaming): ini non-streaming, tapi dapat tool results
  // dan bisa balik navigateAction untuk diarahkan ke halaman tertentu.
  const sendAgentMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');

    if (isSmallTalk(trimmed)) {
      setMessages(prev => [...prev, { role: 'assistant', content: smallTalkReply(trimmed) }]);
      return;
    }

    setLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const history = messages
        .filter(m => !m.streaming)
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai/agent-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, message: trimmed, history }),
      });

      const data = res.ok ? await res.json() : null;
      if (!data) {
        const err = await res.json().catch(() => ({ error: 'Gagal menghubungi agent' }));
        throw new Error(err.error ?? 'Gagal menghubungi agent');
      }

      if (data.model) setActiveModel(MODEL_LABELS[data.model] ?? data.model);

      const navigateAction = data.navigate
        ? {
            page: data.navigate.page as string,
            filters: (data.navigate.filters ?? {}) as Record<string, string>,
            message: data.navigate.message as string,
            url: buildNavigateUrl(data.navigate.page as string, data.navigate.filters as Record<string, string>),
          }
        : undefined;

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: (data.answer as string) || '_(tidak ada respons)_',
            navigateAction,
          };
        }
        return updated;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming) {
          updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [messages, loading, businessId]);

  // Mode "record": parse teks → tampilkan preview draft transaksi (belum disimpan).
  // Kalau sebelumnya AI minta nominal (pendingTx), gabungkan jawaban user dgn
  // deskripsi yang sudah dikenali supaya tidak perlu mengetik ulang.
  const recordTransaction = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Gabungkan dengan konteks transaksi yang nominalnya belum lengkap.
    // Pesan yang ditampilkan tetap apa yang user ketik (mis. "500rb"), tapi
    // teks yang dikirim ke parser = "<deskripsi> <nominal>".
    const textToParse = pendingTx ? `${pendingTx.name} ${trimmed}` : trimmed;
    const carryHint = pendingTx?.category_hint ?? null;
    const carryDate = pendingTx?.date ?? null;
    setPendingTx(null);

    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          text: textToParse,
          category_hint: carryHint,
          pending_date: carryDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal memproses transaksi');

      if (json.model) setActiveModel(json.model);

      // AI mengenali transaksi tapi nominal belum disebut → tanya balik
      if (json.status === 'needs_amount') {
        setPendingTx({
          name: json.pending?.name ?? trimmed,
          category_hint: json.pending?.category_hint ?? null,
          date: json.pending?.date ?? carryDate,
        });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: json.message ?? 'Berapa nominalnya?',
          };
          return updated;
        });
        return;
      }

      const draft = json.data as TransactionDraft;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Cek dulu detail transaksinya, lalu simpan kalau sudah benar:',
          draft,
          draftStatus: 'pending',
        };
        return updated;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [loading, businessId, pendingTx]);

  // Simpan draft transaksi ke API (setelah user konfirmasi di preview card)
  const saveDraft = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.draft || msg.draftStatus === 'saving' || msg.draftStatus === 'saved') return;
    const draft = msg.draft;

    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = { ...updated[msgIndex], draftStatus: 'saving' };
      return updated;
    });

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          date: draft.date,
          category: draft.category,
          name: draft.name,
          description: draft.description,
          amount: draft.amount,
          debit_account_id: draft.debit_account_id,
          credit_account_id: draft.credit_account_id,
          is_double_entry: true,
          status: 'posted',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan transaksi');

      setMessages(prev => {
        const updated = [...prev];
        updated[msgIndex] = { ...updated[msgIndex], draftStatus: 'saved' };
        return updated;
      });
      // Beri tahu halaman lain (transactions, dashboard) untuk refresh
      window.dispatchEvent(new Event('transaction-saved'));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menyimpan';
      setMessages(prev => {
        const updated = [...prev];
        updated[msgIndex] = { ...updated[msgIndex], draftStatus: 'pending' };
        return [...updated, { role: 'assistant', content: `⚠️ ${errMsg}` }];
      });
    }
  }, [messages, businessId]);

  const cancelDraft = useCallback((msgIndex: number) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = { ...updated[msgIndex], draftStatus: 'cancelled' };
      return updated;
    });
  }, []);

  // Router: kirim sesuai mode aktif
  // ── LLM-driven import (provider Vertex saja) ───────────────────────────────
  // Full LLM parse: kirim raw rows ke /api/ai/parse-import, LLM ekstrak transaksi
  // cerdas (nama bermakna, buang baris ringkasan, klasifikasi per-baris). Kalau LLM
  // ragu, dia balik pertanyaan → ditampilkan di chat, jawaban user dikirim ulang.
  const runLLMImport = useCallback(async (
    fileName: string,
    rows: Record<string, unknown>[],
    provider: 'gemini-vertex' | 'claude',
    clarifications?: { question: string; answer: string }[],
  ) => {
    setLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch('/api/ai/parse-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, provider, rows, clarifications }),
      });
      const data = res.ok ? await res.json() : null;
      if (!data) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? 'LLM gagal memproses file');
      }

      const llmTxs = (data.transactions ?? []) as Array<{
        name: string; description: string; amount: number; date: string; category: string;
      }>;
      const questions = (data.questions ?? []) as string[];
      const summary = (data.summary ?? '') as string;

      // Kalau LLM masih ragu & belum ada klarifikasi → tanya user dulu.
      if (questions.length > 0 && !clarifications) {
        setPendingLLMImport({ fileName, rows, questions, provider });
        setMessages(prev => {
          const updated = [...prev];
          const q = questions.map(x => `• ${x}`).join('\n');
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `${summary ? summary + '\n\n' : ''}Sebelum impor, aku perlu konfirmasi:\n${q}\n\n_Balas di chat untuk menjawab._`,
            importQuestions: questions,
          };
          return updated;
        });
        return;
      }

      // Resolve akun debit/kredit untuk tiap transaksi LLM.
      const accounts = await getAccounts(businessId);
      const accByCode = new Map(accounts.map(a => [a.account_code, a]));
      const today = new Date().toISOString().split('T')[0];
      const ready: TransactionInsert[] = [];
      let lowConfidenceCount = 0;

      for (const tx of llmTxs) {
        const resolved = smartResolveTransaction(tx.description || tx.name, accounts, tx.category);
        if (resolved.confidence === 'low') lowConfidenceCount++;
        const debit = accByCode.get(resolved.debit_account_code);
        const credit = accByCode.get(resolved.credit_account_code);
        if (!debit || !credit || debit.id === credit.id) continue;
        const amountNum = sanitizeAmountFlexible(tx.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) continue;

        ready.push({
          business_id: businessId,
          date: toISODate(tx.date) ?? today,
          // LLM sudah klasifikasi per-baris → pakai kategori LLM, bukan hasil resolver.
          category: (tx.category as TransactionInsert['category']) ?? resolved.category,
          name: tx.name || tx.description,
          description: tx.description || tx.name,
          amount: amountNum,
          account: '',
          created_by: '',
          debit_account_id: debit.id,
          credit_account_id: credit.id,
          is_double_entry: true,
          status: 'posted',
        });
      }

      setPendingLLMImport(null);
      const preview: ImportPreview = {
        fileName,
        totalRows: rows.length,
        validCount: ready.length,
        errorCount: Math.max(0, rows.length - ready.length),
        ready,
        lowConfidenceCount,
      };

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: ready.length > 0
            ? `${summary ? summary + ' ' : ''}${ready.length} transaksi siap-impor. Cek & konfirmasi:`
            : (summary || 'Tidak ada transaksi valid yang bisa diimpor dari file ini.'),
          importPreview: ready.length > 0 ? preview : undefined,
          importStatus: ready.length > 0 ? 'pending' : undefined,
        };
        return updated;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses file';
      setPendingLLMImport(null);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const handleSend = useCallback((text: string) => {
    // Kalau ada impor LLM yang menunggu jawaban klarifikasi → teruskan jawaban ke LLM.
    if (pendingLLMImport && mode === 'record') {
      const clar = pendingLLMImport.questions.map(q => ({ question: q, answer: text }));
      setMessages(prev => [...prev, { role: 'user', content: text }]);
      runLLMImport(pendingLLMImport.fileName, pendingLLMImport.rows, pendingLLMImport.provider, clar);
      setInput('');
      return;
    }
    if (mode === 'record') recordTransaction(text);
    // Mode ask + Gemini Vertex → gunakan agentic loop (tool calling)
    else if (selectedProvider === 'gemini-vertex') sendAgentMessage(text);
    else sendMessage(text);
  }, [mode, recordTransaction, sendMessage, sendAgentMessage, selectedProvider, pendingLLMImport, runLLMImport]);

  // Attach file XLS/CSV → parse client-side → resolve akun → preview import.
  // Parsing & resolve pakai engine import yang sama dgn halaman /transactions
  // (parseExcelFile + validateRowsSmart + smartResolveTransaction). Tidak butuh
  // AI untuk jalan; AI hanya enhancement opsional (belum dipakai di sini).
  const handleFile = useCallback(async (file: File) => {
    if (loading) return;

    const fileCheck = validateFile(file);
    setMessages(prev => [...prev, { role: 'user', content: `📎 ${file.name}` }]);
    if (!fileCheck.valid) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${fileCheck.error ?? 'File tidak valid'}` }]);
      return;
    }

    // Provider Vertex (Gemini Vertex / Claude) → full LLM parse (lebih cerdas, bisa
    // tanya follow-up). Provider AXION Auto → rule-based + LLM column mapping (hemat token).
    if (selectedProvider === 'gemini-vertex' || selectedProvider === 'claude') {
      try {
        const raw = await parseExcelRaw(file);
        if (raw.rows.length === 0) {
          setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ File kosong atau tidak terbaca.' }]);
          return;
        }
        await runLLMImport(file.name, raw.rows, selectedProvider);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal membaca file';
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
        return;
      }
    }

    setLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const accounts = await getAccounts(businessId);
      const accByCode = new Map(accounts.map(a => [a.account_code, a]));
      const today = new Date().toISOString().split('T')[0];

      // Helper: konversi ParsedRow[] → transaksi siap impor.
      // defaultCategory (opsional, dari LLM) jadi hint kategori untuk SEMUA baris
      // kalau baris itu sendiri tidak punya kategori — mis. file Airbnb → EARN.
      const buildReady = (
        parsedRows: import('@/lib/import/types').ParsedRow[],
        defaultCategory?: string
      ) => {
        const validation = validateRowsSmart(parsedRows);
        let lowConfidenceCount = 0;
        const ready: TransactionInsert[] = [];

        for (const vr of validation.validRows) {
          const r = vr.data;
          const categoryHint = String(r.category || '').trim() || defaultCategory || undefined;
          const resolved = smartResolveTransaction(r.description || r.name, accounts, categoryHint);
          if (resolved.confidence === 'low') lowConfidenceCount++;

          const debit = accByCode.get(resolved.debit_account_code);
          const credit = accByCode.get(resolved.credit_account_code);
          if (!debit || !credit || debit.id === credit.id) continue;

          // Sanitize amount: handle format Indonesia (1.234.567) & internasional ($1,234.56)
          const amountNum = sanitizeAmountFlexible(r.amount);
          if (!Number.isFinite(amountNum) || amountNum <= 0) continue;

          // Normalisasi tanggal → ISO (server WAJIB YYYY-MM-DD). File asing
          // (Airbnb = MM/DD/YYYY) ditolak server kalau tidak dikonversi.
          const isoDate = toISODate(r.date) ?? today;

          ready.push({
            business_id: businessId,
            date: isoDate,
            category: resolved.category,
            name: resolved.name || r.name || r.description,
            description: r.description || '',
            amount: amountNum,
            account: '',
            created_by: '',
            debit_account_id: debit.id,
            credit_account_id: credit.id,
            is_double_entry: true,
            status: 'posted',
          });
        }
        return { validation, ready, lowConfidenceCount };
      };

      // 1) Coba parser rule-based dulu (cepat, gratis).
      const rows = await parseExcelFile(file);
      let { validation, ready, lowConfidenceCount } = buildReady(rows);

      // 2) Kalau hasil rule-based buruk (>40% baris gagal jadi transaksi),
      //    minta LLM petakan kolom dari header asli, lalu parse ulang.
      const totalRows = validation.totalRows;
      const successRatio = totalRows > 0 ? ready.length / totalRows : 0;
      if (totalRows > 0 && successRatio < 0.6) {
        const raw = await parseExcelRaw(file);
        if (raw.headers.length > 0 && raw.rows.length > 0) {
          try {
            const res = await fetch('/api/ai/map-columns', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                business_id: businessId,
                headers: raw.headers,
                sample_rows: raw.rows.slice(0, 3),
              }),
            });
            const data = res.ok ? await res.json() : null;
            const mapping: ColumnMapping | null = data?.mapping ?? null;
            const defaultCategory: string | undefined = data?.default_category ?? undefined;
            if (mapping && mapping.date && mapping.amount) {
              const mappedRows = applyColumnMapping(raw.rows, mapping);
              const llmResult = buildReady(mappedRows, defaultCategory);
              // File non-standar: percayai mapping LLM kalau menghasilkan transaksi
              // (>=) — karena rule-based di sini sudah terbukti buruk (deskripsi/akun salah).
              // Mapping LLM punya kolom yang benar (Guest→nama, Type→deskripsi).
              if (llmResult.ready.length >= ready.length && llmResult.ready.length > 0) {
                validation = llmResult.validation;
                ready = llmResult.ready;
                lowConfidenceCount = llmResult.lowConfidenceCount;
              }
            }
          } catch (mapErr) {
            console.warn('[AIChatPanel] LLM column mapping failed:', mapErr);
          }
        }
      }

      const preview: ImportPreview = {
        fileName: file.name,
        totalRows: validation.totalRows,
        validCount: validation.validCount,
        errorCount: validation.errorCount,
        ready,
        lowConfidenceCount,
      };

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: ready.length > 0
            ? `Aku menemukan ${ready.length} transaksi siap-impor dari file. Cek ringkasannya:`
            : 'Tidak ada baris yang bisa diimpor dari file ini. Pastikan ada kolom tanggal, deskripsi, dan jumlah.',
          importPreview: ready.length > 0 ? preview : undefined,
          importStatus: ready.length > 0 ? 'pending' : undefined,
        };
        return updated;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca file';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [loading, businessId, selectedProvider, runLLMImport]);

  // Attach gambar (struk/invoice) → upload → OCR scan server-side → resolve akun →
  // preview import (pakai UI ImportPreview yang sama dgn Excel/CSV).
  const handleImage = useCallback(async (file: File) => {
    if (loading) return;

    setMessages(prev => [...prev, { role: 'user', content: `📎 ${file.name}` }]);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      // 1. Upload ke storage (Cloudinary) — sama dgn OCRScanButton.
      const attachment = await uploadAttachment(businessId, file);

      // 2. OCR scan server-side (scanning + parsing).
      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, image_url: attachment.url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'OCR gagal memproses gambar');

      const ocr = json.data as OcrResult;
      const p = ocr.parsed;
      const amountNum = sanitizeAmountFlexible(p.total ?? 0);

      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Aku tidak menemukan nominal yang jelas di struk ini. Coba foto yang lebih jelas, atau catat manual.',
          };
          return updated;
        });
        return;
      }

      // 3. Resolve akun debit/kredit dari keyword OCR.
      const accounts = await getAccounts(businessId);
      const accByCode = new Map(accounts.map(a => [a.account_code, a]));
      const today = new Date().toISOString().split('T')[0];

      const description = p.vendor || p.line_items?.[0]?.description || 'Transaksi dari struk';
      const categoryHint = p.category;
      // Coba match akun dari keyword OCR dulu; kalau tidak ada, pakai smart resolver.
      const matchedAccount = matchAccountByKeywords(accounts, [
        ...(p.keywords ?? []),
        ...(p.fallback_keywords ?? []),
      ]);
      const resolved = smartResolveTransaction(description, accounts, categoryHint);

      const debit = accByCode.get(resolved.debit_account_code);
      const credit = accByCode.get(resolved.credit_account_code);
      let lowConfidenceCount = resolved.confidence === 'low' ? 1 : 0;

      const ready: TransactionInsert[] = [];
      if (debit && credit && debit.id !== credit.id) {
        // Kalau OCR keyword match menemukan akun beban/aset yang lebih spesifik, pakai itu sbg debit.
        const debitId = matchedAccount && matchedAccount.id !== credit.id
          ? matchedAccount.id
          : debit.id;
        ready.push({
          business_id: businessId,
          date: toISODate(p.date) ?? today,
          category: resolved.category,
          name: p.vendor || description,
          description,
          amount: amountNum,
          account: '',
          created_by: '',
          debit_account_id: debitId,
          credit_account_id: credit.id,
          is_double_entry: true,
          status: 'posted',
        });
      }

      const preview: ImportPreview = {
        fileName: file.name,
        totalRows: 1,
        validCount: ready.length,
        errorCount: ready.length > 0 ? 0 : 1,
        ready,
        lowConfidenceCount,
      };

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: ready.length > 0
            ? `Struk terbaca: **${p.vendor || description}** sebesar ${formatCurrency(amountNum)}. Cek & konfirmasi:`
            : 'Struk terbaca tapi aku belum bisa menentukan akunnya. Coba catat manual.',
          importPreview: ready.length > 0 ? preview : undefined,
          importStatus: ready.length > 0 ? 'pending' : undefined,
        };
        return updated;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses gambar';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [loading, businessId]);

  // Router: gambar → OCR scan, Excel/CSV → parser. Ditentukan dari tipe/ekstensi file.
  const handleAttachment = useCallback((file: File) => {
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (isImage) {
      handleImage(file);
    } else {
      handleFile(file);
    }
  }, [handleImage, handleFile]);

  const runImport = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.importPreview || msg.importStatus !== 'pending') return;
    const preview = msg.importPreview;

    // Isi created_by dari user session sekarang
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Sesi habis, silakan login ulang.' }]);
      return;
    }
    const toInsert = preview.ready.map(t => ({ ...t, created_by: user.id }));

    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = { ...updated[msgIndex], importStatus: 'importing' };
      return updated;
    });

    try {
      const result = await createTransactionsBulk(toInsert);
      setMessages(prev => {
        const updated = [...prev];
        updated[msgIndex] = {
          ...updated[msgIndex],
          importStatus: 'done',
          importResult: { inserted: result.inserted, failed: result.failed },
        };
        return updated;
      });
      window.dispatchEvent(new Event('transaction-saved'));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Gagal impor';
      setMessages(prev => {
        const updated = [...prev];
        updated[msgIndex] = { ...updated[msgIndex], importStatus: 'pending' };
        return [...updated, { role: 'assistant', content: `⚠️ ${errMsg}` }];
      });
    }
  }, [messages]);

  const cancelImport = useCallback((msgIndex: number) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = { ...updated[msgIndex], importStatus: 'cancelled' };
      return updated;
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const changeMode = (nextMode: ChatMode) => {
    if (nextMode === mode) return;
    setModeDirection(nextMode === 'record' ? 1 : -1);
    setMode(nextMode);
    setPendingTx(null); // konteks "berapa nominalnya?" tidak relevan lintas-mode
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setLoading(false);
    setPendingTx(null);
    // Refresh badge ke provider standby (jangan kosongkan)
    fetch('/api/ai/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => setActiveModel(d?.model ?? null))
      .catch(() => setActiveModel(null));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — mobile only */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] sm:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-[400px] flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.22),0_2px_12px_-2px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.7),0_2px_12px_-2px_rgba(0,0,0,0.5)]"
            style={{ height: 'min(560px, calc(100dvh - 120px))', transformOrigin: 'bottom right' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-500 dark:text-primary-400 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-50 leading-tight">AXION Agent</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="relative flex w-1.5 h-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-60" />
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-400" />
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{businessName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    onClick={handleReset}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Reset percakapan"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-4 min-h-0">
              {messages.length === 0 ? (
                <EmptyState mode={mode} direction={modeDirection} onSuggest={handleSend} />
              ) : (
                messages.map((msg, i) => (
                  <ChatBubble
                    key={i}
                    message={msg}
                    userAvatarUrl={user?.user_metadata?.avatar_url}
                    userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                    onSaveDraft={() => saveDraft(i)}
                    onCancelDraft={() => cancelDraft(i)}
                    onRunImport={() => runImport(i)}
                    onCancelImport={() => cancelImport(i)}
                    onNavigate={(url) => { onClose(); router.push(url); router.refresh(); }}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
              {/* Mode toggle: Tanya (analitik) vs Catat (input transaksi) */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-full shrink-0">
                  <button
                    onClick={() => changeMode('ask')}
                    className={`relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      mode === 'ask'
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {mode === 'ask' && (
                      <motion.span
                        layoutId={modeToggleLayoutId}
                        className="absolute inset-0 rounded-full bg-white dark:bg-gray-600 shadow-sm"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {t.aiChat.ask}
                    </span>
                  </button>
                  <button
                    onClick={() => changeMode('record')}
                    className={`relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      mode === 'record'
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {mode === 'record' && (
                      <motion.span
                        layoutId={modeToggleLayoutId}
                        className="absolute inset-0 rounded-full bg-white dark:bg-gray-600 shadow-sm"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1">
                      <PlusCircle className="w-3 h-3" /> {t.aiChat.entry}
                    </span>
                  </button>
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setProviderDropdownOpen(o => !o)}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors max-w-[140px]"
                    title="Pilih model AI"
                  >
                    <span className="truncate">
                      {activeModel ? (MODEL_LABELS[activeModel] ?? activeModel) : (selectedProvider === 'claude' ? 'Claude' : selectedProvider === 'gemini-vertex' ? 'Gemini Vertex' : 'AXION Auto')}
                    </span>
                    <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                  </button>
                  <AnimatePresence>
                    {providerDropdownOpen && (
                      <>
                        {/* Backdrop untuk close on outside click */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setProviderDropdownOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full right-0 mb-1.5 z-20 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden"
                        >
                          {([
                            { id: 'auto' as const, label: 'AXION Auto', desc: 'Gemini · Llama · Qwen', logo: '/images/meta.png', disabled: false },
                            { id: 'gemini-vertex' as const, label: 'Gemini Vertex', desc: claudeAvailable ? '2.5 Flash via Vertex AI' : 'Perlu Vertex credentials', logo: '/images/gemini.png', disabled: !claudeAvailable },
                            { id: 'claude' as const, label: 'Claude', desc: claudeAvailable ? 'Sonnet 4.6 via Vertex' : 'Belum dikonfigurasi', logo: '/images/claude.png', disabled: !claudeAvailable },
                          ]).map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={opt.disabled}
                              onClick={() => {
                                if (opt.disabled) return;
                                setSelectedProvider(opt.id);
                                if (opt.id === 'claude') setActiveModel('claude-sonnet-4-6');
                                else if (opt.id === 'gemini-vertex') setActiveModel('gemini-2.5-flash-vertex');
                                else setActiveModel(null);
                                localStorage.setItem('axion_ai_provider', opt.id);
                                setProviderDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            >
                              <img src={opt.logo} alt={opt.label} className="w-5 h-5 shrink-0 rounded-sm object-contain" />
                              <span className="min-w-0 flex-1">
                                <span className="block text-[12px] font-medium text-gray-900 dark:text-gray-100">{opt.label}</span>
                                <span className="block text-[10px] text-gray-400 dark:text-gray-500">{opt.desc}</span>
                              </span>
                              <span className="w-3.5 shrink-0 flex justify-end">
                                {selectedProvider === opt.id && !opt.disabled && <Check className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              {/* Instagram-style pill input */}
              <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-4 pr-1.5 py-1.5 focus-within:border-primary-400 dark:focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    mode === 'record'
                      ? pendingTx
                        ? `Berapa nominal "${pendingTx.name}"?`
                        : 'Ketik transaksi atau lampirkan file...'
                      : 'Tanya soal keuangan bisnismu...'
                  }
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-[13px] leading-[1.5] focus:outline-none max-h-32 disabled:opacity-50 self-center"
                  onInput={e => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
                  }}
                />
                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                  {mode === 'record' && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) handleAttachment(f);
                        }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        title="Impor Excel/CSV atau scan struk (gambar)"
                        className="w-8 h-8 rounded-full text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || loading}
                    className="w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
                {mode === 'record' ? 'Ketik transaksi, lampirkan Excel/CSV, atau scan struk' : 'Enter kirim · Shift+Enter baris baru'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState({
  mode,
  direction,
  onSuggest,
}: {
  mode: ChatMode;
  direction: number;
  onSuggest: (q: string) => void;
}) {
  const isRecord = mode === 'record';
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-4">
      <Image src="/images/agent.png" alt="AXION Agent" width={48} height={48} className="object-contain" />
      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Hi! I&apos;m AXION Agent</p>
      <div className="relative h-[224px] w-full overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={mode}
            custom={direction}
            variants={MODE_PAGE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute inset-0 w-full"
          >
            <p className="text-center text-[12px] text-gray-500 dark:text-gray-400 mb-4">
              {isRecord ? 'Ketik transaksi, aku bantu catat ke pembukuan' : 'Tanya apa saja tentang keuangan bisnismu'}
            </p>
            <div className="w-full space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 text-center mb-2">
                {isRecord ? 'Contoh' : 'Coba tanya ini'}
              </p>
              {(isRecord
                ? ['bayar listrik 500rb', 'jual kopi ke Budi 2.5jt', 'beli bahan baku 750.000']
                : SUGGESTED_QUESTIONS
              ).map((q) => (
                <button
                  key={q}
                  onClick={() => onSuggest(q)}
                  className="w-full text-left px-3 py-2 rounded-xl text-[12px] text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  userAvatarUrl,
  userName,
  onSaveDraft,
  onCancelDraft,
  onRunImport,
  onCancelImport,
  onNavigate,
}: {
  message: Message;
  userAvatarUrl?: string;
  userName: string;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onRunImport: () => void;
  onCancelImport: () => void;
  onNavigate: (url: string) => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser
          ? 'bg-primary-500 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
      }`}>
        {isUser && userAvatarUrl ? (
          <Image
            src={userAvatarUrl}
            alt={userName}
            width={28}
            height={28}
            className="w-full h-full rounded-full object-cover"
          />
        ) : isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <Image src="/images/agent.png" alt="AXION Agent" width={16} height={16} className="object-contain" />
        )}
      </div>
      <div className={`max-w-[82%] min-w-0 rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        isUser
          ? 'bg-[#474443] dark:bg-gray-100 text-white dark:text-gray-900 rounded-tr-sm'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-sm border border-gray-100 dark:border-gray-700'
      }`}>
        {message.streaming && !message.content && !message.thinking ? (
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
                streaming={!!message.streaming && !message.content}
              />
            )}
            {message.content && <MarkdownText text={message.content} isUser={isUser} />}
            {message.draft && (
              <DraftCard
                draft={message.draft}
                status={message.draftStatus ?? 'pending'}
                onSave={onSaveDraft}
                onCancel={onCancelDraft}
              />
            )}
            {message.importPreview && (
              <ImportPreviewCard
                preview={message.importPreview}
                status={message.importStatus ?? 'pending'}
                result={message.importResult}
                onImport={onRunImport}
                onCancel={onCancelImport}
              />
            )}
            {message.navigateAction && (
              <NavigateActionCard action={message.navigateAction} onNavigate={onNavigate} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ThinkingAccordion({ text, streaming }: { text: string; streaming: boolean }) {
  // Default tertutup. Saat streaming thinking, auto-buka biar user lihat live;
  // begitu jawaban mulai mengalir (streaming=false), user bisa tutup manual.
  const [open, setOpen] = useState(false);
  const wasStreaming = useRef(false);

  useEffect(() => {
    if (streaming && !wasStreaming.current) setOpen(true);   // mulai thinking → buka
    if (!streaming && wasStreaming.current) setOpen(false);  // thinking selesai → tutup
    wasStreaming.current = streaming;
  }, [streaming]);

  return (
    <div className="mb-2 rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-gray-50/60 dark:bg-gray-800/40 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors"
      >
        <Brain className={`w-3 h-3 shrink-0 ${streaming ? 'text-primary-500 dark:text-primary-400' : ''}`} />
        <span className="flex-1 text-left">
          {streaming ? 'Sedang menganalisis…' : 'Proses berpikir'}
        </span>
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

// Page labels untuk navigate_to
const PAGE_LABELS: Record<string, string> = {
  transactions: 'Halaman Transaksi',
  'income-statement': 'Laporan Laba Rugi',
  'balance-sheet': 'Neraca',
  'cash-flow': 'Arus Kas',
  'general-ledger': 'Buku Besar',
  'trial-balance': 'Neraca Saldo',
  accounts: 'Akun (CoA)',
  reports: 'Laporan',
  dashboard: 'Dashboard',
};

function NavigateActionCard({
  action,
  onNavigate,
}: {
  action: { page: string; filters?: Record<string, string>; message: string; url: string };
  onNavigate: (url: string) => void;
}) {
  const filterEntries = Object.entries(action.filters ?? {}).filter(([, v]) => v);
  return (
    <div className="mt-2 rounded-xl border border-primary-200 dark:border-primary-700/50 bg-primary-50/60 dark:bg-primary-900/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary-700 dark:text-primary-300 mb-0.5">
            {PAGE_LABELS[action.page] ?? action.page}
          </p>
          {filterEntries.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {filterEntries.map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-primary-100 dark:bg-primary-800/40 text-primary-600 dark:text-primary-300"
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onNavigate(action.url)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Buka
        </button>
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  status,
  onSave,
  onCancel,
}: {
  draft: TransactionDraft;
  status: 'pending' | 'saving' | 'saved' | 'cancelled';
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-50 text-[13px] truncate">{draft.name}</span>
          <span className="font-bold text-gray-900 dark:text-gray-50 text-[13px] tabular-nums shrink-0">
            {formatCurrency(draft.amount, 'IDR')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-medium ${
            CATEGORY_BADGE_CLASSES[draft.category] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            {CATEGORY_LABELS[draft.category] ?? draft.category}
          </span>
          <span className="text-gray-400 dark:text-gray-500">{draft.date}</span>
          {draft.confidence === 'low' && (
            <span className="text-amber-600 dark:text-amber-400">· perlu dicek</span>
          )}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
          Dr {draft.debit_account_code} · Cr {draft.credit_account_code}
        </div>
      </div>
      {status === 'pending' && (
        <div className="flex border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onSave}
            className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-[12px] font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Simpan
          </button>
          <div className="w-px bg-gray-100 dark:bg-gray-700" />
          <button
            onClick={onCancel}
            className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Batal
          </button>
        </div>
      )}
      {status === 'saving' && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
        </div>
      )}
      {status === 'saved' && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/15 border-t border-emerald-100 dark:border-emerald-900/30">
          <Check className="w-3.5 h-3.5" /> Tersimpan
        </div>
      )}
      {status === 'cancelled' && (
        <div className="flex items-center justify-center py-2 text-[12px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
          Dibatalkan
        </div>
      )}
    </div>
  );
}

function ImportPreviewCard({
  preview,
  status,
  result,
  onImport,
  onCancel,
}: {
  preview: ImportPreview;
  status: 'pending' | 'importing' | 'done' | 'cancelled';
  result?: { inserted: number; failed: number };
  onImport: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold text-gray-900 dark:text-gray-50 text-[12px] truncate">{preview.fileName}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-emerald-50/70 dark:bg-emerald-900/15 py-1.5">
            <div className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{preview.ready.length}</div>
            <div className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Siap</div>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-1.5">
            <div className="text-[15px] font-bold text-gray-700 dark:text-gray-300 tabular-nums">{preview.totalRows}</div>
            <div className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="rounded-lg bg-amber-50/70 dark:bg-amber-900/15 py-1.5">
            <div className="text-[15px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">{preview.errorCount}</div>
            <div className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Error</div>
          </div>
        </div>
        {preview.lowConfidenceCount > 0 && status === 'pending' && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 leading-snug">
            {preview.lowConfidenceCount} baris kategori/akun ditebak otomatis — cek setelah impor.
          </p>
        )}
      </div>
      {status === 'pending' && (
        <div className="flex border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onImport}
            className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-[12px] font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Impor {preview.ready.length} transaksi
          </button>
          <div className="w-px bg-gray-100 dark:bg-gray-700" />
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-1 px-4 py-2 text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {status === 'importing' && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengimpor...
        </div>
      )}
      {status === 'done' && result && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/15 border-t border-emerald-100 dark:border-emerald-900/30">
          <Check className="w-3.5 h-3.5" /> {result.inserted} tersimpan{result.failed > 0 ? `, ${result.failed} gagal` : ''}
        </div>
      )}
      {status === 'cancelled' && (
        <div className="flex items-center justify-center py-2 text-[12px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
          Dibatalkan
        </div>
      )}
    </div>
  );
}

function MarkdownText({ text, isUser }: { text: string; isUser: boolean }) {
  // Simple markdown: **bold**, bullet list, line breaks
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const isBullet = line.match(/^[\-\*•]\s/);
        const content = isBullet ? line.replace(/^[\-\*•]\s/, '') : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className={isUser ? 'text-white dark:text-gray-900' : 'text-gray-900 dark:text-gray-50'}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });
        return (
          <div key={i} className={isBullet ? 'flex gap-1.5' : ''}>
            {isBullet && <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${isUser ? 'bg-white/70 dark:bg-gray-900/70' : 'bg-gray-400 dark:bg-gray-500'}`} />}
            <span>{parts}</span>
          </div>
        );
      })}
    </div>
  );
}
