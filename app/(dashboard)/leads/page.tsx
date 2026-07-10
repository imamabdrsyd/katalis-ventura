'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useLeads } from '@/hooks/useLeads';
import { useBusinessContext } from '@/context/BusinessContext';
import {
  CHANNEL_LABELS,
  LEAD_CHANNEL_TO_SALES_CHANNEL,
  LEAD_STATUS_BADGE_CLASSES,
  LEAD_STATUS_LABELS,
} from '@/lib/leadColors';
import { SalesChannelBadge } from '@/components/transactions/SalesChannelBadge';
import type { ChannelStatus } from '@/lib/api/leads';
import type { Lead, LeadChannel, LeadMessage, LeadStatus } from '@/types';
import {
  MessagesSquare, RefreshCw, Send, Copy, Check, Trash2, ArrowLeft,
  Inbox, Bot, User, UserRound, Sparkles, ChevronDown, Plug, Blocks, Paperclip, Info,
} from 'lucide-react';

const ALL_CHANNELS = Object.keys(CHANNEL_LABELS) as LeadChannel[];
const ALL_STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isDraft(message: LeadMessage): boolean {
  return message.direction === 'outbound' && message.meta?.is_draft === true;
}

/**
 * Lead "unread" = ada pesan masuk (inbound) yang belum dilihat tim. Logika sama
 * persis dengan useLeadCounts (sumber badge bell + sidebar) supaya konsisten:
 * belum pernah dibuka (last_read_at NULL) atau last_read_at < last_inbound_at.
 */
function isLeadUnread(lead: Lead): boolean {
  if (!lead.last_inbound_at) return false;
  return !lead.last_read_at || new Date(lead.last_read_at) < new Date(lead.last_inbound_at);
}

/**
 * Pesan non-teks dari webhook disimpan sbg placeholder "[pesan <tipe>]"
 * (mis. "[pesan instagram]", "[pesan image]"). Deteksi di render-time supaya
 * data lama & baru sama-sama tampil ramah ("Lampiran"), bukan token mentah.
 */
function isMediaPlaceholder(content: string): boolean {
  return /^\[pesan .+\]$/i.test(content.trim());
}

function LeadListItem({
  lead,
  active,
  unread,
  onClick,
}: {
  lead: Lead;
  active: boolean;
  unread: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-l-2 transition-colors ${
        active
          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-400'
          : unread
            ? 'border-transparent bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {unread && (
            <span
              className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 flex-shrink-0"
              aria-label="Belum dibaca"
            />
          )}
          <p
            className={`text-sm truncate ${
              unread
                ? 'font-bold text-gray-900 dark:text-white'
                : 'font-semibold text-gray-900 dark:text-gray-100'
            }`}
          >
            {lead.name || lead.external_id}
          </p>
        </div>
        {lead.last_message_at && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
            {formatMessageTime(lead.last_message_at)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <SalesChannelBadge channel={LEAD_CHANNEL_TO_SALES_CHANNEL[lead.channel]} />
        <span className={`badge text-[10px] ${LEAD_STATUS_BADGE_CLASSES[lead.status]}`}>
          {LEAD_STATUS_LABELS[lead.status]}
        </span>
      </div>
    </button>
  );
}

function MessageBubble({
  message,
  canManage,
  onApprove,
  onDiscard,
}: {
  message: LeadMessage;
  canManage: boolean;
  onApprove: (m: LeadMessage) => void;
  onDiscard: (m: LeadMessage) => void;
}) {
  const inbound = message.direction === 'inbound';
  const draft = isDraft(message);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Disalin ke clipboard');
    } catch {
      toast.error('Gagal menyalin');
    }
  }

  const senderLabel =
    message.sender === 'customer' ? null
    : message.sender === 'ai' ? 'AI'
    : 'Tim';
  const SenderIcon = message.sender === 'ai' ? Bot : message.sender === 'human' ? UserRound : User;

  return (
    <div className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] md:max-w-[70%] ${inbound ? '' : 'items-end'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
            inbound
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-md'
              : draft
                ? 'border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                : 'bg-stone-800 dark:bg-gray-100 text-white dark:text-gray-900 rounded-br-md'
          }`}
        >
          {draft && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              <Sparkles className="w-3 h-3" />
              Draft AI — belum terkirim
            </p>
          )}
          {isMediaPlaceholder(message.content) ? (
            <span className="flex items-center gap-1.5 italic text-gray-500 dark:text-gray-400">
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              Lampiran (buka di platform aslinya)
            </span>
          ) : (
            message.content
          )}
        </div>
        <div className={`flex items-center gap-2 mt-1 px-1 ${inbound ? '' : 'justify-end'}`}>
          {senderLabel && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <SenderIcon className="w-3 h-3" />
              {senderLabel}
            </span>
          )}
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
        {draft && (
          <div className="flex flex-wrap gap-2 mt-1.5 justify-end">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            {canManage && (
              <>
                <button
                  onClick={() => onApprove(message)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve & Tandai Terkirim
                </button>
                <button
                  onClick={() => onDiscard(message)}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Buang draft"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Pill status koneksi channel di toolbar: titik hijau "live" + badge channel + mode AI. */
function ChannelStatusChip({ status }: { status: ChannelStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40"
      title={`${CHANNEL_LABELS[status.channel]} terhubung${
        status.ai_enabled ? ` · AI ${status.ai_mode === 'auto' ? 'otomatis' : 'draft'}` : ''
      }`}
    >
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <SalesChannelBadge channel={LEAD_CHANNEL_TO_SALES_CHANNEL[status.channel]} />
      {status.ai_enabled && (
        <span className="flex items-center gap-0.5 text-[10px] font-medium text-blue-500 dark:text-blue-400">
          <Bot className="w-3 h-3" />
          {status.ai_mode === 'auto' ? 'Auto' : 'Draft'}
        </span>
      )}
    </span>
  );
}

function LeadsPageInner() {
  const {
    canManage,
    channelFilter, setChannelFilter,
    statusFilter, setStatusFilter,
    leads, loadingLeads, refreshLeads,
    connectedChannels, loadingChannels, refreshChannelStatuses,
    selectedLead, selectLead,
    messages, loadingMessages,
    replyText, setReplyText, sending, handleSendReply,
    handleSetStatus, handleApproveDraft, handleDiscardDraft,
  } = useLeads();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBusinessId, activeBusiness } = useBusinessContext();

  // Dibuka dari badge notif (bell/sidebar) dengan ?openUnread=1 → auto-pilih lead
  // unread TERLAMA begitu list termuat, lalu bersihkan param agar tak berulang.
  const handledOpenUnreadRef = useRef(false);
  useEffect(() => {
    if (searchParams.get('openUnread') !== '1') {
      handledOpenUnreadRef.current = false;
      return;
    }
    if (handledOpenUnreadRef.current || loadingLeads) return;

    const oldestUnread = [...leads]
      .filter(isLeadUnread)
      .sort((a, b) => (a.last_inbound_at ?? '').localeCompare(b.last_inbound_at ?? ''))[0];
    if (oldestUnread) selectLead(oldestUnread.id);

    handledOpenUnreadRef.current = true;
    router.replace('/leads');
  }, [searchParams, loadingLeads, leads, selectLead, router]);

  // Subtitle menyesuaikan tipe bisnis — sebut channel yang relevan saja
  const leadsSubtitle = (() => {
    const type = activeBusiness?.business_type;
    if (type === 'produk' || type === 'dagang') {
      return 'Inbox pesan masuk dari WhatsApp, Instagram, marketplace, dan channel lain';
    }
    if (type === 'jasa') {
      return 'Inbox pesan masuk dari WhatsApp, Airbnb, Booking.com, dan channel lain';
    }
    return 'Inbox pesan masuk dari WhatsApp, Instagram, dan channel lain';
  })();

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectClass =
    'appearance-none pl-3 pr-9 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer';
  const selectChevronClass =
    'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none';

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <MessagesSquare className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            Leads
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {leadsSubtitle}
          </p>
        </div>
        {canManage && activeBusinessId && (
          <button
            onClick={() =>
              router.push(`/businesses/${activeBusinessId}/config?tab=integrations`)
            }
            className="btn-primary-glow flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
            title="Hubungkan & atur channel (WhatsApp, Instagram, dll)"
          >
            <Blocks className="w-4 h-4" />
            <span className="hidden sm:inline">Kelola Integrasi</span>
          </button>
        )}
      </div>

      {/* Toolbar filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card border border-transparent dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as LeadChannel | '')}
              className={selectClass}
            >
              <option value="">Semua channel</option>
              {ALL_CHANNELS.map((c) => (
                <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
              ))}
            </select>
            <ChevronDown className={selectChevronClass} />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | '')}
              className={selectClass}
            >
              <option value="">Semua status</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <ChevronDown className={selectChevronClass} />
          </div>
          {/* Indikator status koneksi channel */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {!loadingChannels && (
              connectedChannels.length > 0 ? (
                connectedChannels.map((c) => (
                  <ChannelStatusChip key={c.channel} status={c} />
                ))
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-[11px] text-gray-400 dark:text-gray-500">
                  <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                  Belum ada channel terhubung
                </span>
              )
            )}
            <button
              onClick={() => { refreshLeads(); refreshChannelStatuses(); }}
              disabled={loadingLeads}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loadingLeads ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Inbox 2 panel */}
      <div className="grid md:grid-cols-[320px,1fr] gap-4 md:h-[calc(100vh-280px)] md:min-h-[420px]">
        {/* Panel kiri: list leads — di mobile disembunyikan saat thread terbuka */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-card border border-transparent dark:border-gray-700 flex flex-col min-h-0 ${
            selectedLead ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto py-2 divide-y divide-gray-100 dark:divide-gray-700/60">
            {loadingLeads ? (
              <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">Memuat leads…</div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                {loadingChannels ? (
                  <>
                    <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Belum ada lead.
                    </p>
                  </>
                ) : connectedChannels.length === 0 ? (
                  <>
                    <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Belum ada channel terhubung
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Hubungkan WhatsApp atau Instagram dulu agar pesan masuk muncul di sini.
                    </p>
                    {canManage && activeBusinessId && (
                      <button
                        onClick={() =>
                          router.push(`/businesses/${activeBusinessId}/config?tab=integrations`)
                        }
                        className="btn-ghost inline-flex items-center gap-2 mt-4"
                      >
                        <Plug className="w-4 h-4" />
                        Hubungkan channel
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Menunggu pesan masuk
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {connectedChannels.map((c) => CHANNEL_LABELS[c.channel]).join(' & ')} sudah
                      terhubung. Lead baru akan otomatis muncul di sini.
                    </p>
                  </>
                )}
              </div>
            ) : (
              leads.map((lead) => (
                <LeadListItem
                  key={lead.id}
                  lead={lead}
                  active={selectedLead?.id === lead.id}
                  unread={selectedLead?.id !== lead.id && isLeadUnread(lead)}
                  onClick={() => selectLead(lead.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Panel kanan: thread */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-card border border-transparent dark:border-gray-700 flex-col min-h-0 min-h-[420px] ${
            selectedLead ? 'flex' : 'hidden md:flex'
          }`}
        >
          {!selectedLead ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessagesSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Pilih lead untuk melihat percakapan
              </p>
            </div>
          ) : (
            <>
              {/* Header thread */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => selectLead(null)}
                  className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {selectedLead.name || selectedLead.external_id}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <SalesChannelBadge channel={LEAD_CHANNEL_TO_SALES_CHANNEL[selectedLead.channel]} />
                    {selectedLead.phone && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">{selectedLead.phone}</span>
                    )}
                  </div>
                </div>
                {canManage ? (
                  <div className="relative">
                    <select
                      value={selectedLead.status}
                      onChange={(e) => handleSetStatus(selectedLead, e.target.value as LeadStatus)}
                      className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  </div>
                ) : (
                  <span className={`badge text-[10px] ${LEAD_STATUS_BADGE_CLASSES[selectedLead.status]}`}>
                    {LEAD_STATUS_LABELS[selectedLead.status]}
                  </span>
                )}
              </div>

              {/* Pesan */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">Memuat percakapan…</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">Belum ada pesan</div>
                ) : (
                  messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      canManage={canManage}
                      onApprove={handleApproveDraft}
                      onDiscard={handleDiscardDraft}
                    />
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Composer */}
              {canManage && (
                selectedLead.channel === 'whatsapp' ? (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        placeholder="Tulis balasan WhatsApp… (Ctrl+Enter untuk kirim)"
                        rows={2}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={sending || !replyText.trim()}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        {sending ? 'Mengirim…' : 'Kirim'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
                    <p className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
                      <Info className="w-3.5 h-3.5 mt-px shrink-0" />
                      <span>
                        {`${CHANNEL_LABELS[selectedLead.channel]} tidak mendukung kirim langsung — approve draft AI lalu salin & kirim manual lewat platformnya.`}
                      </span>
                    </p>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// useSearchParams() butuh Suspense boundary saat prerender (Next.js CSR bailout).
export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsPageInner />
    </Suspense>
  );
}
