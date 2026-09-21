'use client';

/**
 * State editor konten Site CMS (halaman /admin).
 *
 * Satu hook dipakai semua halaman yang dikelola CMS — landing, SEO, dan
 * berikutnya legal — karena alurnya identik: muat draft → sunting → simpan →
 * pratinjau → publikasikan, dengan riwayat versi untuk dipulihkan.
 *
 * Pembagian state yang penting dipahami:
 *   - `draft`       isi di layar, berubah tiap ketikan
 *   - `savedDraft`  draft terakhir yang sudah tersimpan di DB
 *   - `isDirty`     draft ≠ savedDraft → ada yang belum disimpan
 *   - `hasUnpublishedChanges` savedDraft ≠ yang tayang → ada yang belum tayang
 *
 * Dua tingkat itu sengaja dipisah supaya admin bisa menyimpan pekerjaan
 * setengah jadi tanpa menayangkannya.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { SitePageKey, SitePageVersion } from '@/lib/site/types';

interface EditorState<T> {
  draft: T | null;
  savedDraft: T | null;
  defaults: T | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
}

const EMPTY_STATE = {
  draft: null,
  savedDraft: null,
  defaults: null,
  publishedAt: null,
  hasUnpublishedChanges: false,
};

export function useSiteEditor<T>(pageKey: SitePageKey) {
  const [state, setState] = useState<EditorState<T>>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<SitePageVersion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/site/${pageKey}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Gagal memuat konten.');

      setState({
        draft: body.draft,
        savedDraft: body.draft,
        defaults: body.defaults,
        publishedAt: body.publishedAt,
        hasUnpublishedChanges: body.hasUnpublishedChanges,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat konten.');
    } finally {
      setLoading(false);
    }
  }, [pageKey]);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty = useMemo(
    () => JSON.stringify(state.draft) !== JSON.stringify(state.savedDraft),
    [state.draft, state.savedDraft]
  );

  /** Ubah draft lewat fungsi murni — pemanggil wajib mengembalikan objek baru. */
  const update = useCallback((updater: (prev: T) => T) => {
    setState((prev) => (prev.draft === null ? prev : { ...prev, draft: updater(prev.draft) }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (state.draft === null) return false;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/site/${pageKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.draft),
      });
      const body = await res.json();

      if (!res.ok) {
        // Kesalahan validasi Zod datang sebagai daftar field — tampilkan yang
        // pertama supaya admin tahu field mana, bukan sekadar "gagal".
        const detail = Array.isArray(body.details) && body.details.length > 0
          ? `${body.details[0].field}: ${body.details[0].message}`
          : body.error;
        throw new Error(detail ?? 'Gagal menyimpan draft.');
      }

      setState((prev) => ({
        ...prev,
        savedDraft: prev.draft,
        hasUnpublishedChanges: true,
      }));
      toast.success('Draft tersimpan');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan draft.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [pageKey, state.draft]);

  const publish = useCallback(async (): Promise<boolean> => {
    setPublishing(true);
    try {
      // Publish selalu menayangkan apa yang ada di DB, bukan yang di layar.
      // Menyimpan dulu mencegah admin mengira suntingan terakhirnya ikut tayang
      // padahal belum tersimpan.
      if (isDirty) {
        const saved = await save();
        if (!saved) return false;
      }

      const res = await fetch(`/api/admin/site/${pageKey}/publish`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Gagal mempublikasikan.');

      setState((prev) => ({
        ...prev,
        publishedAt: body.publishedAt,
        hasUnpublishedChanges: false,
      }));
      toast.success('Perubahan sudah tayang');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mempublikasikan.');
      return false;
    } finally {
      setPublishing(false);
    }
  }, [isDirty, pageKey, save]);

  const loadVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/site/${pageKey}/versions`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Gagal memuat riwayat.');
      setVersions(body.versions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat riwayat.');
    }
  }, [pageKey]);

  const restoreVersion = useCallback(
    async (versionId: string) => {
      try {
        const res = await fetch(`/api/admin/site/${pageKey}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Gagal memulihkan versi.');

        // Versi dipulihkan ke draft, bukan langsung tayang — muat ulang supaya
        // layar menampilkan isi versi itu dan admin bisa meninjau dulu.
        await load();
        toast.success(body.message ?? 'Versi dimuat ke draft.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal memulihkan versi.');
      }
    },
    [load, pageKey]
  );

  /** Kembalikan draft ke isi bawaan kode, tanpa menyimpan. */
  const resetToDefaults = useCallback(() => {
    setState((prev) => (prev.defaults === null ? prev : { ...prev, draft: prev.defaults }));
  }, []);

  return {
    draft: state.draft,
    defaults: state.defaults,
    publishedAt: state.publishedAt,
    hasUnpublishedChanges: state.hasUnpublishedChanges,
    versions,
    loading,
    saving,
    publishing,
    error,
    isDirty,
    update,
    save,
    publish,
    loadVersions,
    restoreVersion,
    resetToDefaults,
    reload: load,
  };
}
