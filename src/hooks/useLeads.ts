'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import * as leadsApi from '@/lib/api/leads';
import type { Lead, LeadChannel, LeadMessage, LeadStatus } from '@/types';

/**
 * State halaman /leads (inbox Leads Hub) — pola hook-per-halaman seperti
 * useTransactions: filter, list, thread terpilih, dan semua aksi manager.
 */
export function useLeads() {
  const { activeBusinessId: businessId, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  // Filter state
  const [channelFilter, setChannelFilter] = useState<LeadChannel | ''>('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');

  // List state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Status koneksi channel (indikator inbox + empty state pintar)
  const [channelStatuses, setChannelStatuses] = useState<leadsApi.ChannelStatus[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);

  const connectedChannels = useMemo(
    () => channelStatuses.filter((c) => c.is_active),
    [channelStatuses]
  );

  // Thread state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Composer state (balasan manual WhatsApp)
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const refreshLeads = useCallback(async () => {
    if (!businessId) return;
    setLoadingLeads(true);
    try {
      const data = await leadsApi.getLeads(businessId, {
        channel: channelFilter,
        status: statusFilter,
      });
      setLeads(data);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
      toast.error('Gagal memuat leads');
    } finally {
      setLoadingLeads(false);
    }
  }, [businessId, channelFilter, statusFilter]);

  useEffect(() => {
    refreshLeads();
  }, [refreshLeads]);

  const refreshChannelStatuses = useCallback(async () => {
    if (!businessId) return;
    setLoadingChannels(true);
    try {
      const data = await leadsApi.getChannelStatuses(businessId);
      setChannelStatuses(data);
    } catch (err) {
      console.error('Failed to fetch channel statuses:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, [businessId]);

  useEffect(() => {
    refreshChannelStatuses();
  }, [refreshChannelStatuses]);

  // Reset thread saat ganti bisnis
  useEffect(() => {
    setSelectedLeadId(null);
    setMessages([]);
    setReplyText('');
  }, [businessId]);

  const refreshMessages = useCallback(async (leadId: string) => {
    setLoadingMessages(true);
    try {
      const data = await leadsApi.getLeadMessages(leadId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch lead messages:', err);
      toast.error('Gagal memuat percakapan');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const selectLead = useCallback(
    (leadId: string | null) => {
      setSelectedLeadId(leadId);
      setReplyText('');
      if (leadId) refreshMessages(leadId);
      else setMessages([]);
    },
    [refreshMessages]
  );

  // ── Aksi manager ──

  const handleSetStatus = useCallback(
    async (lead: Lead, status: LeadStatus) => {
      if (!canManage || lead.status === status) return;
      try {
        const updated = await leadsApi.updateLeadStatus(lead.id, status);
        setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        toast.success('Status lead diperbarui');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal update status');
      }
    },
    [canManage]
  );

  const handleApproveDraft = useCallback(
    async (message: LeadMessage) => {
      if (!canManage) return;
      try {
        const updated = await leadsApi.approveDraftMessage(message);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        toast.success('Draft ditandai terkirim — jangan lupa kirim manual di platformnya');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal approve draft');
      }
    },
    [canManage]
  );

  const handleDiscardDraft = useCallback(
    async (message: LeadMessage) => {
      if (!canManage) return;
      try {
        await leadsApi.discardDraftMessage(message.id);
        setMessages((prev) => prev.filter((m) => m.id !== message.id));
        toast.success('Draft dibuang');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal membuang draft');
      }
    },
    [canManage]
  );

  const handleSendReply = useCallback(async () => {
    const text = replyText.trim();
    if (!canManage || !selectedLead || !text || sending) return;
    setSending(true);
    try {
      const saved = await leadsApi.sendWhatsAppReply(selectedLead.id, text);
      setMessages((prev) => [...prev, saved]);
      setReplyText('');
      // Sinkronkan last_message_at & status (new → contacted) di list
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id
            ? {
                ...l,
                last_message_at: saved.created_at,
                status: l.status === 'new' ? 'contacted' : l.status,
              }
            : l
        )
      );
      toast.success('Balasan terkirim');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim balasan');
    } finally {
      setSending(false);
    }
  }, [canManage, selectedLead, replyText, sending]);

  return {
    canManage,
    // filters
    channelFilter,
    setChannelFilter,
    statusFilter,
    setStatusFilter,
    // list
    leads,
    loadingLeads,
    refreshLeads,
    // status channel
    connectedChannels,
    loadingChannels,
    refreshChannelStatuses,
    // thread
    selectedLead,
    selectLead,
    messages,
    loadingMessages,
    // composer
    replyText,
    setReplyText,
    sending,
    handleSendReply,
    // aksi
    handleSetStatus,
    handleApproveDraft,
    handleDiscardDraft,
  };
}
