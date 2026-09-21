'use client';

/**
 * Kerangka halaman editor Site CMS: header status + aksi + panel riwayat.
 *
 * Alur yang dibangun di sini sengaja tiga langkah — Simpan draft → Pratinjau →
 * Publikasikan — bukan "simpan = tayang". Landing page adalah muka publik
 * axionventura.com; salah ketik yang langsung tayang mahal, dan tidak ada
 * jalan mundur kalau tidak ada riwayat.
 */

import { useState } from 'react';
import { ExternalLink, History, RotateCcw, Save, Upload } from 'lucide-react';
import type { SitePageVersion } from '@/lib/site/types';

interface SiteEditorShellProps {
  title: string;
  description: string;
  /** Route pratinjau draft; tidak diberikan = halaman ini belum punya pratinjau. */
  previewHref?: string;
  /** Halaman publik yang sedang tayang. */
  liveHref: string;
  loading: boolean;
  saving: boolean;
  publishing: boolean;
  error: string | null;
  isDirty: boolean;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  versions: SitePageVersion[];
  onSave: () => void;
  onPublish: () => void;
  onLoadVersions: () => void;
  onRestoreVersion: (id: string) => void;
  onResetToDefaults: () => void;
  children: React.ReactNode;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'belum pernah';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SiteEditorShell({
  title,
  description,
  previewHref,
  liveHref,
  loading,
  saving,
  publishing,
  error,
  isDirty,
  hasUnpublishedChanges,
  publishedAt,
  versions,
  onSave,
  onPublish,
  onLoadVersions,
  onRestoreVersion,
  onResetToDefaults,
  children,
}: SiteEditorShellProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const openHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) onLoadVersions();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-static border border-red-200 dark:border-red-900/50">
        <h2 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-400">
          Gagal memuat editor
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {isDirty ? (
              <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Ada perubahan belum disimpan
              </span>
            ) : hasUnpublishedChanges ? (
              <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                Tersimpan — belum tayang
              </span>
            ) : (
              <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Sudah tayang
              </span>
            )}
            <span className="text-gray-400 dark:text-gray-500">
              Terakhir dipublikasikan: {formatWhen(publishedAt)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openHistory} className="btn-ghost inline-flex items-center gap-2">
            <History className="h-4 w-4" />
            Riwayat
          </button>

          {previewHref && (
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost inline-flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Pratinjau
            </a>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !isDirty}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan…' : 'Simpan draft'}
          </button>

          <button
            type="button"
            onClick={onPublish}
            disabled={publishing || (!isDirty && !hasUnpublishedChanges)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {publishing ? 'Menayangkan…' : 'Publikasikan'}
          </button>
        </div>
      </header>

      {historyOpen && (
        <div className="card-static">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Riwayat publikasi
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Memulihkan versi akan memuatnya ke draft — belum tayang sampai kamu
                menekan Publikasikan.
              </p>
            </div>
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400"
            >
              Lihat yang tayang
            </a>
          </div>

          {versions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Belum ada publikasi. Halaman publik masih memakai teks bawaan dari kode.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {versions.map((version) => (
                <li key={version.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800 dark:text-gray-100">
                      {version.label ?? 'Tanpa catatan'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatWhen(version.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestoreVersion(version.id)}
                    className="btn-ghost shrink-0 !py-1.5 text-xs"
                  >
                    Muat ke draft
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
            <button
              type="button"
              onClick={onResetToDefaults}
              className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Kembalikan draft ke teks bawaan kode
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">{children}</div>
    </div>
  );
}
