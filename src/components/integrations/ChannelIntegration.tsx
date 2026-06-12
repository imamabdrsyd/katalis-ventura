'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Instagram,
  MessageCircle,
  Loader2,
  ExternalLink,
  Unlink,
  Sparkles,
  Bot,
  CheckCircle2,
} from 'lucide-react';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import type { ChannelIntegration as Integration, AiMode } from '@/types';

interface Props {
  businessId: string;
  canManage: boolean;
}

/** config aman (token sudah di-strip server-side) — hanya field non-rahasia. */
interface SafeConfig {
  username?: string;
  token_expires_at?: string;
}

export function ChannelIntegration({ businessId, canManage }: Props) {
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  // Toast hasil OAuth (redirect balik dengan query param)
  useEffect(() => {
    if (searchParams.get('instagram_connected') === '1') {
      toast.success('Instagram berhasil terhubung!');
    }
    const err = searchParams.get('instagram_error');
    if (err) toast.error(decodeURIComponent(err));
  }, [searchParams]);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations?businessId=${businessId}`);
      const json = await res.json();
      if (res.ok) setIntegrations((json.data as Integration[]) ?? []);
      else toast.error(json.error || 'Gagal memuat integrasi');
    } catch {
      toast.error('Gagal memuat integrasi');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const instagram = integrations.find((i) => i.channel === 'instagram' && i.is_active);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary-500" />
          Integrasi Pesan & Sosial
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Hubungkan akun pesan agar DM masuk otomatis ke inbox Leads + dibalas AI.
        </p>
      </div>

      {/* Instagram */}
      <InstagramCard
        integration={instagram}
        businessId={businessId}
        canManage={canManage}
        onChanged={fetchIntegrations}
      />

      {/* WhatsApp — segera */}
      <ComingSoonCard
        icon={<MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        label="WhatsApp"
        description="Hubungkan nomor WhatsApp Business per bisnis"
      />
    </div>
  );
}

function InstagramCard({
  integration,
  businessId,
  canManage,
  onChanged,
}: {
  integration?: Integration;
  businessId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const isConnected = !!integration;
  const config = (integration?.config as SafeConfig | null) ?? null;

  const handleConnect = () => {
    window.location.href = `/api/integrations/instagram/auth?businessId=${businessId}`;
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    if (!confirm('Putuskan koneksi Instagram? Riwayat percakapan tidak akan dihapus.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Gagal memutus koneksi');
      }
      toast.success('Koneksi Instagram diputus');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memutus koneksi');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="card-static rounded-xl p-5 bg-white dark:bg-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-amber-400 text-white">
              <Instagram className="w-5 h-5" />
            </div>
            {isConnected && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Instagram</h3>
              {isConnected && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  Terhubung
                </span>
              )}
            </div>
            {isConnected ? (
              <p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {config?.username ? `@${config.username}` : 'Akun Instagram terhubung'}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                DM Instagram masuk otomatis ke inbox Leads
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 sm:pt-0.5">
          {isConnected
            ? canManage && (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  title="Putuskan koneksi"
                  className="btn-icon text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )
            : canManage && (
                <button onClick={handleConnect} className="btn-primary flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Hubungkan
                </button>
              )}
        </div>
      </div>

      {/* How it works — belum terhubung */}
      {!isConnected && <HowItWorks />}

      {/* Setelan AI — terhubung */}
      {isConnected && integration && (
        <AiSettingsPanel integration={integration} canManage={canManage} onChanged={onChanged} />
      )}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    'Klik Hubungkan dan login akun Instagram profesional bisnis ini.',
    'DM yang masuk otomatis tersimpan sebagai lead + riwayat percakapan.',
    'Aktifkan AI untuk balasan otomatis atau draft yang kamu approve dulu.',
  ];
  return (
    <div className="mt-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Cara kerja
      </p>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
            <span className="w-5 h-5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AiSettingsPanel({
  integration,
  canManage,
  onChanged,
}: {
  integration: Integration;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [enabled, setEnabled] = useState(integration.ai_enabled);
  const [mode, setMode] = useState<AiMode>(integration.ai_mode);
  const [persona, setPersona] = useState(integration.ai_persona ?? '');
  const [saving, setSaving] = useState(false);

  const dirty =
    enabled !== integration.ai_enabled ||
    mode !== integration.ai_mode ||
    (persona.trim() || null) !== (integration.ai_persona ?? null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_enabled: enabled,
          ai_mode: mode,
          ai_persona: persona.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Gagal menyimpan setelan');
      }
      toast.success('Setelan AI disimpan');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan setelan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
      {/* Toggle aktif */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Bot className="w-4 h-4 text-primary-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Balasan AI</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI menjawab DM berdasarkan info bisnis & katalog produk.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canManage}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
            enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Mode + persona — hanya saat AI aktif */}
      {enabled && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Mode balasan</p>
            <SegmentedToggle<AiMode>
              value={mode}
              onChange={setMode}
              ariaLabel="Mode balasan AI"
              options={[
                { value: 'draft', label: 'Draft', icon: <Sparkles className="w-3.5 h-3.5" />, disabled: !canManage },
                { value: 'auto', label: 'Auto-kirim', icon: <CheckCircle2 className="w-3.5 h-3.5" />, disabled: !canManage },
              ]}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            {mode === 'draft'
              ? 'AI membuat draft — kamu approve & kirim dari inbox.'
              : 'AI langsung membalas DM (dalam 24 jam sejak pesan terakhir customer).'}
          </p>

          <div>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
              Persona / instruksi AI
            </label>
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              disabled={!canManage}
              rows={3}
              maxLength={2000}
              placeholder="Contoh: Balas ramah & santai. Sebut promo bundling kalau ditanya harga."
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50"
            />
          </div>
        </>
      )}

      {canManage && dirty && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Menyimpan…' : 'Simpan setelan'}
          </button>
        </div>
      )}
    </div>
  );
}

function ComingSoonCard({
  icon,
  iconBg,
  label,
  description,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description: string;
}) {
  return (
    <div className="card-static rounded-xl p-5 bg-white dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{label}</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              Segera
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  );
}
