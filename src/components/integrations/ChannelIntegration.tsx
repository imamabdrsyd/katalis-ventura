'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  Unlink,
  Sparkles,
  Bot,
  CheckCircle2,
  KeyRound,
  Power,
  Gem,
  Zap,
} from 'lucide-react';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { getAiTier, type AiTier } from '@/lib/ai/concierge/tier';
import type { ChannelIntegration as Integration, AiMode, LeadChannel } from '@/types';

interface Props {
  businessId: string;
  canManage: boolean;
  onReady?: () => void;
  /** Slot tambahan di bawah kolom kiri (mis. E-Commerce Integration). */
  leftColumnExtra?: React.ReactNode;
}

/** config aman (token sudah di-strip server-side) — hanya field non-rahasia. */
interface SafeConfig {
  username?: string;
  token_expires_at?: string;
  display_phone_number?: string | null;
  verified_name?: string | null;
}

export function ChannelIntegration({ businessId, canManage, onReady, leftColumnExtra }: Props) {
  const { t } = useLanguage();
  const ci = t.channelIntegration;
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  // Simpan onReady di ref agar perubahan referensi callback dari parent
  // tidak men-trigger ulang fetch (mencegah loop & flicker).
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (searchParams.get('instagram_connected') === '1') {
      toast.success(ci.instagramConnectedToast);
    }
    const err = searchParams.get('instagram_error');
    if (err) toast.error(decodeURIComponent(err));
  }, [searchParams, ci]);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations?businessId=${businessId}`);
      const json = await res.json();
      if (res.ok) setIntegrations((json.data as Integration[]) ?? []);
      else toast.error(json.error || ci.loadFailed);
    } catch {
      toast.error(ci.loadFailed);
    } finally {
      setLoading(false);
      onReadyRef.current?.();
    }
  }, [businessId, ci]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const instagram = integrations.find((i) => i.channel === 'instagram' && i.is_active);
  const whatsapp = integrations.find((i) => i.channel === 'whatsapp' && i.is_active);
  const airbnb = integrations.find((i) => i.channel === 'airbnb' && i.is_active);
  const bookingCom = integrations.find((i) => i.channel === 'booking_com' && i.is_active);

  if (loading) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 items-start">
      {/* Kolom kiri — Pesan & Sosial (Connect: OAuth / kredensial) */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            {ci.sectionTitle}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {ci.sectionDesc}
          </p>
        </div>

        {/* Instagram */}
        <InstagramCard
          integration={instagram}
          businessId={businessId}
          canManage={canManage}
          onChanged={fetchIntegrations}
        />

        {/* WhatsApp — kredensial per-bisnis */}
        <WhatsAppCard
          integration={whatsapp}
          businessId={businessId}
          canManage={canManage}
          onChanged={fetchIntegrations}
        />

        {/* Slot tambahan (E-Commerce Integration) — hanya bisnis produk/dagang */}
        {leftColumnExtra}
      </div>

      {/* Kolom kanan — Channel OTA (Activate: webhook generic Zapier/Make) */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            {ci.otaSectionTitle}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {ci.otaSectionDesc}
          </p>
        </div>

        {/* Airbnb — webhook generic via Zapier/Make */}
        <OtaCard
          channel="airbnb"
          label="Airbnb"
          logoSrc="/images/airbnb.png"
          integration={airbnb}
          businessId={businessId}
          canManage={canManage}
          onChanged={fetchIntegrations}
        />

        {/* Booking.com — webhook generic via Zapier/Make */}
        <OtaCard
          channel="booking_com"
          label="Booking.com"
          logoSrc="/sales channel/booking.png"
          integration={bookingCom}
          businessId={businessId}
          canManage={canManage}
          onChanged={fetchIntegrations}
        />
      </div>
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
  const { t } = useLanguage();
  const ci = t.channelIntegration;
  const [disconnecting, setDisconnecting] = useState(false);
  const isConnected = !!integration;
  const config = (integration?.config as SafeConfig | null) ?? null;

  const handleConnect = () => {
    window.location.href = `/api/integrations/instagram/auth?businessId=${businessId}`;
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    if (!confirm(ci.disconnectConfirmInstagram)) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || ci.disconnectFailed);
      }
      toast.success(ci.disconnectedInstagram);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ci.disconnectFailed);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="card-static rounded-xl p-5 bg-white dark:bg-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <Image src="/sales channel/ig.png" alt="Instagram" width={40} height={40} className="w-full h-full object-cover" />
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
                  {ci.connected}
                </span>
              )}
            </div>
            {isConnected ? (
              <p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {config?.username ? `@${config.username}` : ci.instagramConnected}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {ci.instagramDesc}
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
                  title={ci.disconnect}
                  className="btn-icon text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )
            : canManage && (
                <button onClick={handleConnect} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <Image src="/sales channel/ig.png" alt="Instagram" width={16} height={16} className="w-4 h-4 rounded-sm object-cover" />
                  {ci.connect}
                </button>
              )}
        </div>
      </div>

      {!isConnected && <HowItWorks />}

      {isConnected && integration && (
        <AiSettingsPanel integration={integration} canManage={canManage} onChanged={onChanged} />
      )}
    </div>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  const ci = t.channelIntegration;
  const steps = [ci.howItWorksStep1, ci.howItWorksStep2, ci.howItWorksStep3];
  return (
    <div className="mt-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        {ci.howItWorksTitle}
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
  forceDraftOnly = false,
}: {
  integration: Integration;
  canManage: boolean;
  onChanged: () => void;
  forceDraftOnly?: boolean;
}) {
  const { t } = useLanguage();
  const ci = t.channelIntegration;
  const [enabled, setEnabled] = useState(integration.ai_enabled);
  const [mode, setMode] = useState<AiMode>(forceDraftOnly ? 'draft' : integration.ai_mode);
  const [persona, setPersona] = useState(integration.ai_persona ?? '');
  const [tier, setTier] = useState<AiTier>(getAiTier(integration));
  const [saving, setSaving] = useState(false);

  const dirty =
    enabled !== integration.ai_enabled ||
    mode !== integration.ai_mode ||
    (persona.trim() || null) !== (integration.ai_persona ?? null) ||
    tier !== getAiTier(integration);

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
          ai_tier: tier,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || ci.settingsFailed);
      }
      toast.success(ci.settingsSaved);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ci.settingsFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Bot className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{ci.aiReplyTitle}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{ci.aiReplyDesc}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canManage}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
            enabled ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled
                ? 'translate-x-6 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.25)] ring-1 ring-black/10'
                : 'translate-x-1 shadow'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {!forceDraftOnly && (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{ci.replyMode}</p>
                <SegmentedToggle<AiMode>
                  value={mode}
                  onChange={setMode}
                  ariaLabel={ci.replyMode}
                  options={[
                    { value: 'draft', label: ci.modeDraftLabel, icon: <Sparkles className="w-3.5 h-3.5" />, disabled: !canManage },
                    { value: 'auto', label: ci.modeAutoLabel, icon: <CheckCircle2 className="w-3.5 h-3.5" />, disabled: !canManage },
                  ]}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                {mode === 'draft' ? ci.modeDraftDesc : ci.modeAutoDesc}
              </p>
            </>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2.5">
              <Gem className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Kualitas Concierge</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tier === 'pro'
                    ? 'Pro: persona CS premium adaptif-sektor via Vertex AI (fallback otomatis).'
                    : 'Free: balasan AI standar (Gemini/Groq gratis).'}
                </p>
              </div>
            </div>
            <SegmentedToggle<AiTier>
              value={tier}
              onChange={setTier}
              ariaLabel="Kualitas Concierge AI"
              options={[
                { value: 'free', label: 'Free', icon: <Zap className="w-3.5 h-3.5" />, disabled: !canManage },
                { value: 'pro', label: 'Pro', icon: <Gem className="w-3.5 h-3.5" />, disabled: !canManage },
              ]}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {ci.personaLabel}
            </label>
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              disabled={!canManage}
              rows={3}
              maxLength={2000}
              placeholder={ci.personaPlaceholder}
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
            {saving ? ci.savingSettings : ci.saveSettings}
          </button>
        </div>
      )}
    </div>
  );
}

function OtaHowItWorks() {
  const { t } = useLanguage();
  const ci = t.channelIntegration;
  const steps = [ci.otaHowItWorksStep1, ci.otaHowItWorksStep2, ci.otaHowItWorksStep3];
  return (
    <div className="mt-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        {ci.howItWorksTitle}
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
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{ci.otaDocsLink}: docs/INTEGRATIONS.md</p>
    </div>
  );
}

function OtaCard({
  channel,
  label,
  logoSrc,
  integration,
  businessId,
  canManage,
  onChanged,
}: {
  channel: LeadChannel;
  label: string;
  logoSrc: string;
  integration?: Integration;
  businessId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const ci = t.channelIntegration;
  const [saving, setSaving] = useState(false);
  const isActive = !!integration;

  const handleActivate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, channel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || ci.otaActivateFailed);
      toast.success(ci.otaActivatedToast);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ci.otaActivateFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!integration) return;
    if (!confirm(ci.otaDeactivateConfirm)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || ci.otaDeactivateFailed);
      }
      toast.success(ci.otaDeactivated);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ci.otaDeactivateFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-static rounded-xl p-5 bg-white dark:bg-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <Image src={logoSrc} alt={label} width={40} height={40} className="w-full h-full object-cover" />
            </div>
            {isActive && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{label}</h3>
              {isActive && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  {ci.otaActive}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{ci.otaDesc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 sm:pt-0.5">
          {isActive
            ? canManage && (
                <button
                  onClick={handleDeactivate}
                  disabled={saving}
                  title={ci.otaDeactivate}
                  className="btn-icon text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50"
                >
                  <Power className="w-4 h-4" />
                </button>
              )
            : canManage && (
                <button
                  onClick={handleActivate}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? ci.otaActivating : ci.otaActivate}
                </button>
              )}
        </div>
      </div>

      {!isActive && <OtaHowItWorks />}

      {isActive && integration && (
        <>
          <p className="mt-4 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            {ci.otaDraftOnlyNotice}
          </p>
          <AiSettingsPanel
            integration={integration}
            canManage={canManage}
            onChanged={onChanged}
            forceDraftOnly
          />
        </>
      )}
    </div>
  );
}

function WhatsAppCard({
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
  const { t } = useLanguage();
  const ci = t.channelIntegration;
  const [modalOpen, setModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const isConnected = !!integration;
  const config = (integration?.config as SafeConfig | null) ?? null;

  const handleDisconnect = async () => {
    if (!integration) return;
    if (!confirm(ci.disconnectConfirmWhatsApp)) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || ci.disconnectFailed);
      }
      toast.success(ci.disconnectedWhatsApp);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ci.disconnectFailed);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="card-static rounded-xl p-5 bg-white dark:bg-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <Image src="/sales channel/wa.webp" alt="WhatsApp" width={40} height={40} className="w-full h-full object-cover" />
            </div>
            {isConnected && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">WhatsApp</h3>
              {isConnected && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  {ci.connected}
                </span>
              )}
            </div>
            {isConnected ? (
              <p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {config?.display_phone_number ?? integration?.external_account_id}
                {config?.verified_name ? ` — ${config.verified_name}` : ''}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {ci.whatsAppDesc}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 sm:pt-0.5">
          {isConnected ? (
            canManage && (
              <>
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {ci.updateToken}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  title={ci.disconnect}
                  className="btn-icon text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </>
            )
          ) : (
            canManage && (
              <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                <Image src="/sales channel/wa.webp" alt="WhatsApp" width={16} height={16} className="w-4 h-4 rounded-sm object-cover" />
                {ci.connect}
              </button>
            )
          )}
        </div>
      </div>

      {/* Setelan AI — terhubung */}
      {isConnected && integration && (
        <AiSettingsPanel integration={integration} canManage={canManage} onChanged={onChanged} />
      )}

      <WhatsAppConnectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        businessId={businessId}
        isUpdate={isConnected}
        onSaved={() => {
          setModalOpen(false);
          onChanged();
        }}
      />
    </div>
  );
}

function WhatsAppConnectModal({
  isOpen,
  onClose,
  businessId,
  isUpdate,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  isUpdate: boolean;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const ci = t.channelIntegration;
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [saving, setSaving] = useState(false);

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  const handleSubmit = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/integrations/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          phone_number_id: phoneNumberId.trim(),
          access_token: accessToken.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || ci.connectFailed);
      toast.success(isUpdate ? ci.tokenUpdated : ci.waConnected);
      setPhoneNumberId('');
      setAccessToken('');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ci.connectFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isUpdate ? ci.modalTitleUpdate : ci.modalTitleConnect}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{ci.modalDesc}</p>

        <div>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {ci.phoneNumberIdLabel}
          </label>
          <input
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="mis. 1065520xxxxxxxxx"
            className={`mt-1.5 ${inputClass}`}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {ci.accessTokenLabel}
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="EAAG…"
            autoComplete="off"
            className={`mt-1.5 ${inputClass}`}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={saving}>
            {ci.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !phoneNumberId.trim() || !accessToken.trim()}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? ci.verifying : isUpdate ? ci.update : ci.verify}
          </button>
        </div>
      </div>
    </Modal>
  );
}
