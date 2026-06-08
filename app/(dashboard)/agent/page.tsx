'use client';

import { useState, useRef, useCallback } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { AgentProgressToast, type AgentStep } from '@/components/agent/AgentProgressToast';
import {
  Bot,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  X,
  Info,
} from 'lucide-react';
import { isManagerRole } from '@/lib/roles';

const SUPPORTED_CHANNELS = [
  { value: 'airbnb', label: 'Airbnb', description: 'CSV dari Airbnb Host dashboard', available: true },
  { value: 'shopee', label: 'Shopee', description: 'Laporan transaksi Shopee', available: false },
  { value: 'tokopedia', label: 'Tokopedia', description: 'Laporan transaksi Tokopedia', available: false },
  { value: 'tiktokshop', label: 'TikTok Shop', description: 'Laporan penjualan TikTok Shop', available: false },
];

interface ImportResult {
  inserted: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export default function AgentPage() {
  const { activeBusinessId, userRole, activeBusiness } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  const [selectedChannel, setSelectedChannel] = useState('airbnb');
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepIdRef = useRef(0);
  // Lock sinkron: state isRunning update async, jadi double-click cepat bisa lolos
  // guard sebelum re-render. Ref di-set seketika untuk mencegah submit ganda.
  const runningRef = useRef(false);
  // Counter untuk drag enter/leave — cegah flicker saat kursor lewat child element.
  const dragCounterRef = useRef(0);

  const channel = SUPPORTED_CHANNELS.find(c => c.value === selectedChannel)!;

  const handleDismissToast = useCallback(() => setToastVisible(false), []);

  const addStep = useCallback((step: Omit<AgentStep, 'id' | 'timestamp'>) => {
    setAgentSteps(prev => [
      ...prev,
      { ...step, id: String(++stepIdRef.current), timestamp: Date.now() },
    ]);
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.csv$/i)) {
      alert('Hanya file CSV yang didukung. Ekspor data dari channel sebagai CSV.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File terlalu besar (maks 5MB)');
      return;
    }
    setSelectedFile(file);
    setImportResult(null);
    setAgentSteps([]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleCallAgent = useCallback(async () => {
    // Lock sinkron via ref — cegah double-submit sebelum state isRunning ter-commit.
    if (!selectedFile || !activeBusinessId || runningRef.current) return;
    runningRef.current = true;

    setIsRunning(true);
    setAgentSteps([]);
    setImportResult(null);
    setToastVisible(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('businessId', activeBusinessId);
    formData.append('channel', selectedChannel);

    try {
      const response = await fetch('/api/agent/import-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.body) {
        addStep({ type: 'error', message: `Server error: ${response.status}` });
        setIsRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.trim();
          if (!dataLine.startsWith('data: ')) continue;
          const json = dataLine.slice(6);

          try {
            const event = JSON.parse(json);

            if (event.type === 'done') {
              // Tandai selesai → keluar dari outer while juga, lalu batalkan reader
              // supaya tidak menunggu byte sisa / penutupan koneksi.
              streamDone = true;
              setIsRunning(false);
              break;
            }

            if (event.type === 'result' && event.data && !event.data.needsAccountConfirmation) {
              setImportResult({
                inserted: event.data.inserted ?? 0,
                failed: event.data.failed ?? 0,
                skipped: event.data.skipped ?? 0,
                errors: event.data.errors ?? [],
              });
            }

            // Log semua event kecuali 'done' (sudah ditangani di atas)
            addStep({
              type: event.type,
              message: event.message ?? '',
              current: event.current,
              total: event.total,
            });
          } catch {
            // skip malformed event
          }
        }
      }

      // Bersihkan reader bila kita berhenti karena event 'done'
      if (streamDone) {
        await reader.cancel().catch(() => {});
      }
    } catch (err) {
      addStep({ type: 'error', message: err instanceof Error ? err.message : 'Gagal menghubungi server' });
    } finally {
      setIsRunning(false);
      runningRef.current = false;
    }
  }, [selectedFile, activeBusinessId, selectedChannel, addStep]);

  if (!canManage) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Akses Terbatas</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Hanya Business Manager yang dapat menggunakan AXION Agent.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle at 30% 25%, #a5b4fc 0%, #6366f1 45%, #3730a3 100%)',
            }}
          >
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">AXION Agent</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeBusiness?.business_name ?? 'Bisnis Aktif'}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Impor data revenue dari channel bisnis secara otomatis. Agent akan menganalisis CSV, mencocokkan akun, dan menyimpan transaksi langsung.
        </p>
      </div>

      {/* Task: Import CSV */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Task header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Import Revenue CSV</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Upload CSV dari channel penjualanmu, Agent yang proses</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Channel selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Channel
            </label>
            <div className="relative">
              <button
                onClick={() => setChannelDropdownOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {channel.label}
                  {!channel.available && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 font-normal">
                      Segera
                    </span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${channelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {channelDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setChannelDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
                    {SUPPORTED_CHANNELS.map(ch => (
                      <button
                        key={ch.value}
                        disabled={!ch.available}
                        onClick={() => { setSelectedChannel(ch.value); setChannelDropdownOpen(false); }}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                          !ch.available
                            ? 'opacity-50 cursor-not-allowed'
                            : selectedChannel === ch.value
                            ? 'bg-indigo-50 dark:bg-indigo-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${selectedChannel === ch.value ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {ch.label}
                          </p>
                          <p className="text-xs text-gray-400">{ch.description}</p>
                        </div>
                        {!ch.available && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 self-center">Segera</span>}
                        {ch.available && selectedChannel === ch.value && <CheckCircle className="w-4 h-4 text-indigo-500 self-center flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* File drop zone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              File CSV
            </label>
            <div
              onDragEnter={e => { e.preventDefault(); dragCounterRef.current += 1; setDragOver(true); }}
              onDragOver={e => e.preventDefault()}
              onDragLeave={e => {
                e.preventDefault();
                dragCounterRef.current -= 1;
                // Hanya matikan highlight saat benar-benar keluar dropzone (counter 0),
                // bukan saat kursor pindah antar child element.
                if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragOver(false); }
              }}
              onDrop={e => { dragCounterRef.current = 0; handleDrop(e); }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                  : selectedFile
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedFile(null); setImportResult(null); }}
                    className="ml-auto p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800/30 text-emerald-600 dark:text-emerald-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {dragOver ? 'Lepas file di sini' : 'Drag & drop atau klik untuk pilih file'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">CSV · Maks 5MB</p>
                </>
              )}
            </div>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              {selectedChannel === 'airbnb'
                ? 'Agent akan buat jurnal 3-baris per booking: Dr Bank (paidout), Dr Komisi Airbnb (service fee), Cr Pendapatan Sewa (gross). Transaksi langsung masuk sebagai posted.'
                : 'Channel ini belum didukung. Pilih Airbnb untuk sekarang.'}
            </p>
          </div>

          {/* Import result summary */}
          {importResult && !isRunning && (
            <div className={`p-4 rounded-xl border ${importResult.failed > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Selesai!</span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                <p>✓ <strong>{importResult.inserted}</strong> transaksi berhasil diimpor sebagai <em>posted</em></p>
                {importResult.skipped > 0 && <p>⊘ <strong>{importResult.skipped}</strong> baris dilewati (tidak ada data)</p>}
                {importResult.failed > 0 && <p>✗ <strong>{importResult.failed}</strong> gagal</p>}
                {importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-red-600 dark:text-red-400">• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleCallAgent}
            disabled={!selectedFile || isRunning || !channel.available}
            className={`w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all ${
              !selectedFile || isRunning || !channel.available
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'text-white shadow-lg hover:shadow-xl active:scale-95'
            }`}
            style={
              !selectedFile || isRunning || !channel.available
                ? undefined
                : {
                    background:
                      'radial-gradient(circle at 30% 25%, #a5b4fc 0%, #6366f1 45%, #3730a3 100%)',
                  }
            }
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Agent sedang bekerja...
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                Panggil Agent
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Toast */}
      {toastVisible && (
        <AgentProgressToast
          steps={agentSteps}
          isRunning={isRunning}
          onDismiss={handleDismissToast}
        />
      )}
    </div>
  );
}
