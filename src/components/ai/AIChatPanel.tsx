'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, User, Loader2, RotateCcw, MessageSquare, PlusCircle, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type ChatMode = 'ask' | 'record';

const CATEGORY_LABEL: Record<string, string> = {
  EARN: 'Pendapatan', OPEX: 'Beban Operasional', VAR: 'HPP / Variabel',
  CAPEX: 'Belanja Modal', TAX: 'Pajak', FIN: 'Pembiayaan',
};

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
  streaming?: boolean;
  // Preview transaksi (mode record) — kalau ada, render sebagai card konfirmasi
  draft?: TransactionDraft;
  draftStatus?: 'pending' | 'saving' | 'saved' | 'cancelled';
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

export function AIChatPanel({ isOpen, onClose, businessId, businessName }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('ask');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
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
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal menghubungi AI' }));
        throw new Error(err.error ?? 'Gagal menghubungi AI');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
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
              accumulated += json.text;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) {
                  updated[updated.length - 1] = { ...last, content: accumulated };
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
          updated[updated.length - 1] = { role: 'assistant', content: accumulated || '_(tidak ada respons)_' };
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
  }, [messages, loading, businessId]);

  // Mode "record": parse teks → tampilkan preview draft transaksi (belum disimpan)
  const recordTransaction = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, text: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal memproses transaksi');

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
  }, [loading, businessId]);

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
  const handleSend = useCallback((text: string) => {
    if (mode === 'record') recordTransaction(text);
    else sendMessage(text);
  }, [mode, recordTransaction, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setLoading(false);
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
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] sm:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-[400px] flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl shadow-black/10 dark:shadow-black/40"
            style={{ height: 'min(560px, calc(100dvh - 120px))' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <Image src="/images/favicon.png" alt="AXION Agent" width={36} height={36} className="object-contain shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-50 leading-tight">AXION Agent</p>
                <div className="flex items-center gap-1.5">
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
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
              {messages.length === 0 ? (
                <EmptyState mode={mode} onSuggest={handleSend} />
              ) : (
                messages.map((msg, i) => (
                  <ChatBubble
                    key={i}
                    message={msg}
                    onSaveDraft={() => saveDraft(i)}
                    onCancelDraft={() => cancelDraft(i)}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
              {/* Mode toggle: Tanya (analitik) vs Catat (input transaksi) */}
              <div className="flex items-center gap-1 mb-2 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-full w-fit">
                <button
                  onClick={() => setMode('ask')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    mode === 'ask'
                      ? 'bg-white dark:bg-gray-600 text-primary-500 dark:text-primary-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" /> Tanya
                </button>
                <button
                  onClick={() => setMode('record')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    mode === 'record'
                      ? 'bg-white dark:bg-gray-600 text-primary-500 dark:text-primary-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <PlusCircle className="w-3 h-3" /> Catat
                </button>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === 'record' ? 'Mis. "bayar listrik 500rb"...' : 'Tanya soal keuangan bisnismu...'}
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-[13px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 dark:focus:border-primary-500 transition-all max-h-32 disabled:opacity-50"
                  style={{ lineHeight: '1.5' }}
                  onInput={e => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
                  }}
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || loading}
                  className="shrink-0 w-9 h-9 rounded-xl bg-primary-500 hover:bg-primary-600 active:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
                {mode === 'record' ? 'Ketik transaksi, AXION bantu catat' : 'Enter kirim · Shift+Enter baris baru'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ mode, onSuggest }: { mode: ChatMode; onSuggest: (q: string) => void }) {
  const isRecord = mode === 'record';
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-4">
      <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
        <Bot className="w-7 h-7 text-primary-500 dark:text-primary-400" />
      </div>
      <div className="text-center">
        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Hi! I&apos;m AXION Agent</p>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
          {isRecord ? 'Ketik transaksi, aku bantu catat ke pembukuan' : 'Tanya apa saja tentang keuangan bisnismu'}
        </p>
      </div>
      {!isRecord && (
        <div className="w-full space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 text-center mb-2">
            Coba tanya ini
          </p>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onSuggest(q)}
              className="w-full text-left px-3 py-2 rounded-xl text-[12px] text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      {isRecord && (
        <div className="w-full space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 text-center mb-2">
            Contoh
          </p>
          {['bayar listrik 500rb', 'jual kopi ke Budi 2.5jt', 'beli bahan baku 750.000'].map((q) => (
            <button
              key={q}
              onClick={() => onSuggest(q)}
              className="w-full text-left px-3 py-2 rounded-xl text-[12px] text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatBubble({
  message,
  onSaveDraft,
  onCancelDraft,
}: {
  message: Message;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser
          ? 'bg-primary-500 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
      }`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[82%] min-w-0 rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        isUser
          ? 'bg-primary-500 text-white rounded-tr-sm'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-sm border border-gray-100 dark:border-gray-700'
      }`}>
        {message.streaming && !message.content ? (
          <span className="inline-flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : (
          <>
            <MarkdownText text={message.content} isUser={isUser} />
            {message.draft && (
              <DraftCard
                draft={message.draft}
                status={message.draftStatus ?? 'pending'}
                onSave={onSaveDraft}
                onCancel={onCancelDraft}
              />
            )}
          </>
        )}
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
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium">
            {CATEGORY_LABEL[draft.category] ?? draft.category}
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
            return <strong key={j} className={isUser ? 'text-white' : 'text-gray-900 dark:text-gray-50'}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });
        return (
          <div key={i} className={isBullet ? 'flex gap-1.5' : ''}>
            {isBullet && <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${isUser ? 'bg-white/70' : 'bg-gray-400 dark:bg-gray-500'}`} />}
            <span>{parts}</span>
          </div>
        );
      })}
    </div>
  );
}
