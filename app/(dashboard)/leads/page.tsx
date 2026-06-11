'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useLeads } from '@/hooks/useLeads';
import {
  CHANNEL_BADGE_CLASSES,
  CHANNEL_LABELS,
  LEAD_STATUS_BADGE_CLASSES,
  LEAD_STATUS_LABELS,
} from '@/lib/leadColors';
import type { Lead, LeadChannel, LeadMessage, LeadStatus } from '@/types';
import {
  MessagesSquare, RefreshCw, Send, Copy, Check, Trash2, ArrowLeft,
  Inbox, Bot, User, UserRound, Sparkles,
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

function LeadListItem({
  lead,
  active,
  onClick,
}: {
  lead: Lead;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${
        active
          ? 'bg-indigo-50 dark:bg-indigo-900/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
          {lead.name || lead.external_id}
        </p>
        {lead.last_message_at && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
            {formatMessageTime(lead.last_message_at)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`badge text-[10px] ${CHANNEL_BADGE_CLASSES[lead.channel]}`}>
          {CHANNEL_LABELS[lead.channel]}
        </span>
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
                ? 'border-2 border-dashed border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-gray-800 dark:text-gray-100'
                : 'bg-primary-500 dark:bg-primary-600 text-white rounded-br-md'
          }`}
        >
          {draft && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
              <Sparkles className="w-3 h-3" />
              Draft AI — belum terkirim
            </p>
          )}
          {message.content}
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
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

export default function LeadsPage() {
  const {
    canManage,
    channelFilter, setChannelFilter,
    statusFilter, setStatusFilter,
    leads, loadingLeads, refreshLeads,
    selectedLead, selectLead,
    messages, loadingMessages,
    replyText, setReplyText, sending, handleSendReply,
    handleSetStatus, handleApproveDraft, handleDiscardDraft,
  } = useLeads();

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectClass =
    'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <MessagesSquare className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          Leads
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Inbox pesan masuk dari WhatsApp, Airbnb, Booking.com, dan channel lain
        </p>
      </div>

      {/* Toolbar filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
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
          <button
            onClick={refreshLeads}
            disabled={loadingLeads}
            className="ml-auto p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loadingLeads ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inbox 2 panel */}
      <div className="grid md:grid-cols-[320px,1fr] gap-4 md:h-[calc(100vh-280px)] md:min-h-[420px]">
        {/* Panel kiri: list leads — di mobile disembunyikan saat thread terbuka */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col min-h-0 ${
            selectedLead ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
            {loadingLeads ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">Memuat leads…</div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Belum ada lead. Pesan masuk dari channel yang terhubung akan muncul di sini.
                </p>
              </div>
            ) : (
              leads.map((lead) => (
                <LeadListItem
                  key={lead.id}
                  lead={lead}
                  active={selectedLead?.id === lead.id}
                  onClick={() => selectLead(lead.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Panel kanan: thread */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex-col min-h-0 min-h-[420px] ${
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
                    <span className={`badge text-[10px] ${CHANNEL_BADGE_CLASSES[selectedLead.channel]}`}>
                      {CHANNEL_LABELS[selectedLead.channel]}
                    </span>
                    {selectedLead.phone && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">{selectedLead.phone}</span>
                    )}
                  </div>
                </div>
                {canManage ? (
                  <select
                    value={selectedLead.status}
                    onChange={(e) => handleSetStatus(selectedLead, e.target.value as LeadStatus)}
                    className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
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
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {CHANNEL_LABELS[selectedLead.channel]} tidak mendukung kirim langsung —
                      approve draft AI lalu salin & kirim manual lewat platformnya.
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
