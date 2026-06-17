'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { Loader2, Lock, Pencil, X } from 'lucide-react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { isManagerRole } from '@/lib/roles';
import { getBusinessAiKnowledge, saveBusinessAiKnowledge } from '@/lib/api/aiKnowledge';
import { AnimatedDialog } from '@/components/ui/AnimatedDialog';
import type { AiKnowledgeFields } from '@/types';

const MAX_LEN = 4000;
const EMPTY_FIELDS: AiKnowledgeFields = {};

/**
 * Panel "Info Bisnis untuk AI" — pengetahuan level-bisnis yang dibaca AI saat
 * membalas lead di semua channel.
 *
 * Dua bagian: field terstruktur (hours/location/policies/faq) yang diedit lewat
 * ikon edit (muncul saat hover) → modal, ditampilkan sebagai ringkasan di atas;
 * dan catatan bebas (textarea) di bawah. Keduanya disimpan ke satu row.
 */
export function AiKnowledgePanel() {
  const { activeBusiness, userRole, user } = useBusinessContext();
  const { t } = useLanguage();
  const th = t.hub;
  const businessId = activeBusiness?.id;
  const canManage = isManagerRole(userRole);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [loadedContent, setLoadedContent] = useState('');
  const [content, setContent] = useState('');
  const [fields, setFields] = useState<AiKnowledgeFields>(EMPTY_FIELDS);

  // Modal edit field terstruktur
  const [showFields, setShowFields] = useState(false);
  const [draft, setDraft] = useState<AiKnowledgeFields>(EMPTY_FIELDS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!businessId) return;
      setLoading(true);
      try {
        const data = await getBusinessAiKnowledge(businessId);
        if (!cancelled) {
          setLoadedContent(data.content);
          setContent(data.content);
          setFields(data.fields ?? EMPTY_FIELDS);
        }
      } catch (err) {
        console.error('Failed to load ai knowledge:', err);
        if (!cancelled) toast.error(th.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const dirty = content.trim() !== loadedContent.trim();

  const filledFields = ([
    { key: 'hours', label: th.fieldHours, value: fields.hours },
    { key: 'location', label: th.fieldLocation, value: fields.location },
    { key: 'policies', label: th.fieldPolicies, value: fields.policies },
    { key: 'faq', label: th.fieldFaq, value: fields.faq },
  ] as const).filter((f) => f.value && f.value.trim());

  async function persist(nextContent: string, nextFields: AiKnowledgeFields) {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      const trimmed = nextContent.trim();
      await saveBusinessAiKnowledge(businessId, trimmed, nextFields, user.id);
      setContent(trimmed);
      setLoadedContent(trimmed);
      setFields(nextFields);
      toast.success(th.saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : th.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  function openFieldsEditor() {
    setDraft(fields);
    setShowFields(true);
  }

  async function handleApplyFields() {
    // Bersihkan field kosong sebelum simpan
    const cleaned: AiKnowledgeFields = {};
    if (draft.hours?.trim()) cleaned.hours = draft.hours.trim();
    if (draft.location?.trim()) cleaned.location = draft.location.trim();
    if (draft.policies?.trim()) cleaned.policies = draft.policies.trim();
    if (draft.faq?.trim()) cleaned.faq = draft.faq.trim();
    setShowFields(false);
    await persist(content, cleaned);
  }

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 w-full">
      {/* Edit icon — muncul saat hover, pojok kanan atas */}
      {canManage && (
        <button
          type="button"
          onClick={openFieldsEditor}
          title={th.editFields}
          aria-label={th.editFields}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center gap-2 mb-3 pr-8">
        <Image src="/persona/concierge.png" alt="Concierge" width={24} height={24} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{th.aiInfoTitle}</h2>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{th.aiInfoDesc}</p>

      {/* Chip kategori fakta yang sebaiknya diisi */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[th.fieldHours, th.fieldLocation, th.fieldPolicies, th.fieldFaq].map((label) => (
          <span
            key={label}
            className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700/60 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300"
          >
            {label}
          </span>
        ))}
      </div>

      {!canManage && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-3">
          <Lock className="w-3.5 h-3.5" /> {th.aiInfoReadonly}
        </p>
      )}

      {/* Ringkasan field terstruktur (kalau ada) — di atas textarea */}
      {filledFields.length > 0 && (
        <div className="mb-4 space-y-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3">
          {filledFields.map((f) => (
            <div key={f.key}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{f.label}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>
      )}

      {filledFields.length > 0 && (
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          {th.aiInfoNotesLabel}
        </label>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={!canManage || loading}
        rows={filledFields.length > 0 ? 6 : 10}
        maxLength={MAX_LEN}
        placeholder={th.aiInfoPlaceholder}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y disabled:opacity-60"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          {content.length} / {MAX_LEN}
        </span>
        {canManage && dirty && (
          <button
            onClick={() => persist(content, fields)}
            disabled={saving}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? th.saving : th.save}
          </button>
        )}
      </div>

      {/* Modal edit field terstruktur */}
      <AnimatedDialog isOpen={showFields} onClose={() => setShowFields(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{th.fieldsModalTitle}</h2>
            <button
              onClick={() => setShowFields(false)}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{th.fieldHours}</label>
              <input
                type="text"
                value={draft.hours ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))}
                placeholder={th.fieldHoursPlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{th.fieldLocation}</label>
              <input
                type="text"
                value={draft.location ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                placeholder={th.fieldLocationPlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{th.fieldPolicies}</label>
              <textarea
                value={draft.policies ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, policies: e.target.value }))}
                rows={3}
                placeholder={th.fieldPoliciesPlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{th.fieldFaq}</label>
              <textarea
                value={draft.faq ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, faq: e.target.value }))}
                rows={4}
                placeholder={th.fieldFaqPlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowFields(false)} disabled={saving} className="btn-secondary flex-1">
              {th.fieldsCancel}
            </button>
            <button onClick={handleApplyFields} disabled={saving} className="btn-primary-glow flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? th.saving : th.fieldsApply}
            </button>
          </div>
        </div>
      </AnimatedDialog>
    </div>
  );
}
