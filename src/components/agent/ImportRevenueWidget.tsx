'use client';

import { useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { SalesChannelBadge } from '@/components/transactions/SalesChannelBadge';
import type { SalesChannel } from '@/types';
import { Upload, FileSpreadsheet, CheckCircle, ChevronDown, X, Table2 } from 'lucide-react';

export interface SupportedChannel {
  value: string;
  label: string;
  badges: SalesChannel[];
  description: string;
  available: boolean;
}

interface ImportRevenueWidgetProps {
  channels: SupportedChannel[];
  selectedChannel: string;
  onSelectChannel: (value: string) => void;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
  selectedFile: File | null;
  onFile: (file: File) => void;
  onClearFile: () => void;
  dragOver: boolean;
  onDragStateChange: (over: boolean) => void;
  /** Disabled saat agent sedang berjalan. */
  disabled?: boolean;
  /** Catatan deterministik di bawah dropzone (per-channel). */
  hint: string;
}

function ChannelBadges({ badges }: { badges: SalesChannel[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {badges.map(badge => <SalesChannelBadge key={badge} channel={badge} size="sm" />)}
    </span>
  );
}

/**
 * Widget pemilih channel + dropzone CSV, dirancang untuk hidup di dalam bubble chat
 * pada halaman Agentic Workspace. Instruksi & tombol "Panggil Bianca" tidak ada di sini —
 * keduanya pindah ke composer chat di bawah. Komponen ini fully controlled oleh parent.
 */
export function ImportRevenueWidget({
  channels,
  selectedChannel,
  onSelectChannel,
  dropdownOpen,
  onToggleDropdown,
  onCloseDropdown,
  selectedFile,
  onFile,
  onClearFile,
  dragOver,
  onDragStateChange,
  disabled,
  hint,
}: ImportRevenueWidgetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const channel = channels.find(c => c.value === selectedChannel) ?? channels[0];

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.csv$/i)) {
      toast.error('Hanya file CSV yang didukung. Ekspor data dari channel sebagai CSV.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File terlalu besar (maks 5MB)');
      return;
    }
    onFile(file);
  }, [onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onDragStateChange(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile, onDragStateChange]);

  if (!channel) return null;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 hover:-translate-y-1">
      {/* Widget header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2.5">
        <Table2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">Import Revenue CSV</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">Pilih channel & unggah CSV, lalu kirim ke Bianca</p>
        </div>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Channel selector */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Channel
          </label>
          <div className="relative">
            <button
              onClick={onToggleDropdown}
              disabled={disabled}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-primary-400 dark:hover:border-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Pilih channel: ${channel.label}`}
            >
              <span className="flex items-center gap-2">
                <ChannelBadges badges={channel.badges} />
                {!channel.available && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 font-normal">
                    Segera
                  </span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={onCloseDropdown} />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
                  {channels.map(ch => (
                    <button
                      key={ch.value}
                      disabled={!ch.available}
                      onClick={() => { onSelectChannel(ch.value); onCloseDropdown(); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        !ch.available
                          ? 'opacity-50 cursor-not-allowed'
                          : selectedChannel === ch.value
                          ? 'bg-primary-50 dark:bg-primary-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      aria-label={ch.label}
                    >
                      <div className="flex-1 min-w-0">
                        <ChannelBadges badges={ch.badges} />
                        <p className="text-xs text-gray-400">{ch.description}</p>
                      </div>
                      {!ch.available && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400">Segera</span>}
                      {ch.available && selectedChannel === ch.value && <CheckCircle className="w-4 h-4 text-primary-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* File drop zone */}
        <div
          onDragEnter={e => { e.preventDefault(); if (disabled) return; dragCounterRef.current += 1; onDragStateChange(true); }}
          onDragOver={e => e.preventDefault()}
          onDragLeave={e => {
            e.preventDefault();
            dragCounterRef.current -= 1;
            if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; onDragStateChange(false); }
          }}
          onDrop={e => { dragCounterRef.current = 0; if (!disabled) handleDrop(e); }}
          onClick={() => { if (!disabled) fileInputRef.current?.click(); }}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            disabled
              ? 'opacity-60 cursor-not-allowed border-gray-300 dark:border-gray-600'
              : 'cursor-pointer'
          } ${
            dragOver
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : selectedFile
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
              : !disabled
              ? 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
              : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f); }}
          />

          {selectedFile ? (
            <>
              <FileSpreadsheet className="h-7 w-7 text-emerald-500 mx-auto mb-2.5" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1 flex items-center justify-center gap-2">
                {selectedFile.name}
                <button
                  onClick={e => { e.stopPropagation(); onClearFile(); }}
                  disabled={disabled}
                  className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800/30 text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <Upload className="h-7 w-7 text-gray-400 dark:text-gray-500 mx-auto mb-2.5" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {dragOver ? 'Lepas file di sini' : 'Drop file CSV di sini atau klik untuk pilih file'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Format: .csv (max 5MB)
              </p>
            </>
          )}
        </div>

        {/* Deterministic hint */}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
          {hint}
        </p>
      </div>
    </div>
  );
}
