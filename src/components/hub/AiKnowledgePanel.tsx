'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { Loader2, Lock, Pencil, X, Trash2, ChevronDown } from 'lucide-react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { isManagerRole } from '@/lib/roles';
import { getBusinessAiKnowledge, saveBusinessAiKnowledge } from '@/lib/api/aiKnowledge';
import { AnimatedDialog } from '@/components/ui/AnimatedDialog';
import { validateFile } from '@/lib/storage/attachments';
import type { AiKnowledgeFields, AiKnowledgeImage } from '@/types';

const MAX_LEN = 4000;
const EMPTY_FIELDS: AiKnowledgeFields = {};
const COLLAPSE_KEY = 'katalis_ai_knowledge_collapsed';

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

  // Collapse panel — dipakai supaya riwayat stok di bawahnya lebih terlihat.
  // Preferensi disimpan agar tidak perlu di-collapse ulang tiap kunjungan.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  // Modal edit field terstruktur
  const [showFields, setShowFields] = useState(false);
  const [draft, setDraft] = useState<AiKnowledgeFields>(EMPTY_FIELDS);

  // State untuk upload gambar pendukung baru
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageTitle, setNewImageTitle] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // State untuk modal image viewer
  const [selectedImage, setSelectedImage] = useState<AiKnowledgeImage | null>(null);

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
    if (draft.images && draft.images.length > 0) {
      cleaned.images = draft.images
        .map((img) => ({
          url: img.url,
          path: img.path,
          title: img.title.trim(),
        }))
        .filter((img) => img.url && img.title);
    }
    setShowFields(false);
    await persist(content, cleaned);
  }

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-card border border-transparent dark:border-gray-700 p-5 w-full">
      {/* Edit icon — muncul saat hover, pojok kanan atas */}
      {/* Header: judul (tombol collapse) + aksi edit — sebaris, tanpa absolute
          supaya pensil & chevron tak saling menimpa. Saat tertutup hanya baris
          ini yang tampil, memberi ruang untuk riwayat stok di bawahnya. */}
      <div
        className={`flex items-center gap-2 transition-[margin] duration-300 ease-in-out ${
          collapsed ? 'mb-0' : 'mb-3'
        }`}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? th.expandPanel : th.collapsePanel}
          className="flex flex-1 min-w-0 items-center gap-2 text-left"
        >
          <Image src="/persona/concierge.png" alt="Concierge" width={24} height={24} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{th.aiInfoTitle}</h2>
        </button>

        {/* -mr-1.5 menutup padding tombol supaya chevron benar-benar mepet pojok */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? th.expandPanel : th.collapsePanel}
          aria-label={collapsed ? th.expandPanel : th.collapsePanel}
          className="shrink-0 -mr-1.5 p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      {/* Animasi collapse: grid-rows 1fr↔0fr — tinggi konten bisa ditransisikan
          tanpa perlu tahu tinggi pastinya (max-height selalu meleset). Anak
          langsung wajib overflow-hidden + min-h-0 supaya ikut menciut. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        }`}
        aria-hidden={collapsed}
      >
        <div className="overflow-hidden min-h-0">
      {/* Deskripsi + aksi edit sebaris — pensil menempel ke konteks yang diedit */}
      <div className="flex items-start gap-2 mb-3">
        <p className="flex-1 min-w-0 text-sm text-gray-500 dark:text-gray-400">{th.aiInfoDesc}</p>
        {canManage && (
          <button
            type="button"
            onClick={openFieldsEditor}
            title={th.editFields}
            aria-label={th.editFields}
            className="shrink-0 -mt-1 -mr-1.5 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

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
      {(filledFields.length > 0 || (fields.images && fields.images.length > 0)) && (
        <div className="mb-4 space-y-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3">
          {filledFields.map((f) => (
            <div key={f.key}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{f.label}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mt-0.5">{f.value}</p>
            </div>
          ))}

          {fields.images && fields.images.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">{th.fieldImages}</p>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {fields.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square bg-gray-100 dark:bg-gray-800 text-left"
                    title={img.title}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[10px] text-white truncate text-center group-hover:bg-black/80 transition-colors">
                      {img.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
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
        </div>
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
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-880 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
              />
            </div>

            {/* Bagian Upload Gambar Pendukung */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {th.fieldImages} ({(draft.images ?? []).length}/3)
              </label>

              {/* List Gambar Pendukung */}
              <div className="space-y-3 mb-3">
                {(draft.images ?? []).map((img, index) => (
                  <div key={index} className="flex gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-300 dark:border-gray-600">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {th.fieldImageTitle} *
                      </label>
                      <input
                        type="text"
                        value={img.title}
                        onChange={(e) => {
                          const newImages = [...(draft.images ?? [])];
                          newImages[index] = { ...img, title: e.target.value };
                          setDraft((d) => ({ ...d, images: newImages }));
                        }}
                        placeholder={th.fieldImageTitle}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const newImages = (draft.images ?? []).filter((_, i) => i !== index);
                        setDraft((d) => ({ ...d, images: newImages }));

                        // Auto-save delete ke database
                        const nextFields: AiKnowledgeFields = { ...fields, images: newImages };
                        await saveBusinessAiKnowledge(businessId!, content.trim(), nextFields, user!.id);
                        setFields(nextFields);
                      }}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0 self-center transition-colors"
                      title={t.catalog.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload Input - Hanya tampil jika jumlah gambar < 3 */}
              {(draft.images ?? []).length < 3 && (
                <div className="p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800/20">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const err = validateFile(file);
                          if (err) {
                            toast.error(err);
                            return;
                          }
                          setNewImageFile(file);
                        }}
                        className="hidden"
                        id="new-ai-image-upload"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('new-ai-image-upload')?.click()}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
                      >
                        {th.fieldImageSelect}
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                        {newImageFile ? newImageFile.name : th.fieldNoImageSelected}
                      </span>
                    </div>

                    {newImageFile && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            {th.fieldImageTitle} *
                          </label>
                          <input
                            type="text"
                            value={newImageTitle}
                            onChange={(e) => setNewImageTitle(e.target.value)}
                            placeholder="Cth. Menu Makanan Utama, Brosur Kamar..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!newImageFile) return;
                              if (!newImageTitle.trim()) {
                                toast.error(th.errorImageTitleRequired);
                                return;
                              }

                              setUploadingImage(true);
                              try {
                                const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
                                const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

                                const formData = new FormData();
                                formData.append('file', newImageFile);
                                formData.append('upload_preset', uploadPreset);
                                formData.append('folder', `axion/ai-knowledge/${businessId}`);

                                const cloudRes = await fetch(
                                  `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                                  { method: 'POST', body: formData }
                                );
                                if (!cloudRes.ok) {
                                  const err = await cloudRes.json();
                                  throw new Error(err.error?.message || 'Gagal upload ke Cloudinary');
                                }
                                const { secure_url, public_id } = await cloudRes.json();
                                const displayUrl = secure_url.replace(/\/upload\//, '/upload/f_jpg/');

                                const newImages = [
                                  ...(draft.images ?? []),
                                  { url: displayUrl, path: public_id, title: newImageTitle.trim() },
                                ];

                                setDraft((d) => ({
                                  ...d,
                                  images: newImages,
                                }));

                                // Auto-save ke database agar tidak hilang jika modal ditutup (UX Omnichannel)
                                const nextFields: AiKnowledgeFields = { ...fields, images: newImages };
                                await saveBusinessAiKnowledge(businessId!, content.trim(), nextFields, user!.id);
                                setFields(nextFields);

                                setNewImageFile(null);
                                setNewImageTitle('');
                                toast.success('Gambar berhasil diunggah');
                              } catch (err: any) {
                                toast.error(err.message || 'Gagal upload gambar');
                              } finally {
                                setUploadingImage(false);
                              }
                            }}
                            disabled={uploadingImage}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            {uploadingImage && <Loader2 className="w-3 h-3 animate-spin" />}
                            {th.fieldImageUpload}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewImageFile(null);
                              setNewImageTitle('');
                            }}
                            disabled={uploadingImage}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
                          >
                            {th.fieldsCancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

      {/* Image Viewer Modal */}
      <AnimatedDialog
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        panelClassName="bg-transparent shadow-none max-w-4xl w-full flex items-center justify-center p-4"
        backdropClassName="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
      >
        {selectedImage && (
          <div className="relative flex flex-col items-center max-w-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
              title="Tutup"
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage.url}
              alt={selectedImage.title}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-4 text-center">
              <p className="text-white font-medium">{selectedImage.title}</p>
            </div>
          </div>
        )}
      </AnimatedDialog>
    </div>
  );
}
