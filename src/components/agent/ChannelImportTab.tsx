'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AgentProgressToast, type AgentStep } from '@/components/agent/AgentProgressToast';
import { appendAgentImportStep, readAgentImportSession, startAgentImportSession, updateAgentImportSession } from '@/lib/agent/importSession';
import { Bot, Upload, FileSpreadsheet, CheckCircle, ChevronDown, X, Info } from 'lucide-react';

const SUPPORTED_CHANNELS = [
  { value: 'airbnb', label: 'Airbnb', description: 'CSV dari Airbnb Host dashboard', available: true },
  { value: 'tiktok_tokopedia', label: 'TikTok Shop / Tokopedia', description: 'Ekspor pesanan Seller Center (gabungan)', available: true },
  { value: 'shopee', label: 'Shopee', description: 'Laporan transaksi Shopee', available: false },
];

interface ImportResult {
  inserted: number;
  failed: number;
  skipped: number;
  duplicate?: number;
  errors: string[];
}

interface ChannelImportTabProps {
  businessId: string;
  onImportComplete: () => void;
}

export function ChannelImportTab({ businessId, onImportComplete }: ChannelImportTabProps) {
  const router = useRouter();

  const [selectedChannel, setSelectedChannel] = useState('airbnb');
  const [instruction, setInstruction] = useState('');
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepIdRef = useRef(0);
  const runningRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const dragCounterRef = useRef(0);

  const channel = SUPPORTED_CHANNELS.find(c => c.value === selectedChannel)!;

  const addStep = useCallback((step: Omit<AgentStep, 'id' | 'timestamp'>) => {
    const nextStep = { ...step, id: String(++stepIdRef.current), timestamp: Date.now() };
    setAgentSteps(prev => [...prev, nextStep]);
    if (businessId) appendAgentImportStep(businessId, nextStep);
  }, [businessId]);

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
    if (!selectedFile || !businessId || runningRef.current) return;
    runningRef.current = true;
    hasNavigatedRef.current = false;

    setIsRunning(true);
    setAgentSteps([]);
    setImportResult(null);
    setToastVisible(true);
    startAgentImportSession(businessId);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('businessId', businessId);
    formData.append('channel', selectedChannel);
    if (instruction.trim()) formData.append('instruction', instruction.trim());

    try {
      const response = await fetch('/api/agent/import-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.body) {
        addStep({ type: 'error', message: `Server error: ${response.status}` });
        updateAgentImportSession(businessId, { status: 'error' });
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
              const session = readAgentImportSession(businessId);
              if (session?.status === 'running') {
                updateAgentImportSession(businessId, { status: 'completed' });
              }
              streamDone = true;
              setIsRunning(false);
              break;
            }

            if (event.type === 'progress') {
              updateAgentImportSession(businessId, {
                status: 'running',
                current: event.current,
                total: event.total,
              });

              if ((event.current ?? 0) > 0 && !hasNavigatedRef.current) {
                hasNavigatedRef.current = true;
                router.push('/transactions?agentImport=1');
                onImportComplete();
              }
            }

            if (event.type === 'result' && event.data && !event.data.needsAccountConfirmation) {
              setImportResult({
                inserted: event.data.inserted ?? 0,
                failed: event.data.failed ?? 0,
                skipped: event.data.skipped ?? 0,
                duplicate: event.data.duplicate ?? 0,
                errors: event.data.errors ?? [],
              });
            }

            addStep({
              type: event.type,
              message: event.message ?? '',
              current: event.current,
              total: event.total,
            });

            if (event.type === 'result' && event.data && !event.data.needsAccountConfirmation) {
              updateAgentImportSession(businessId, { status: 'completed' });
            }
            if (event.type === 'error') {
              updateAgentImportSession(businessId, { status: 'error' });
            }
          } catch {
            // skip malformed event
          }
        }
      }

      if (streamDone) {
        await reader.cancel().catch(() => {});
      }
    } catch (err) {
      addStep({ type: 'error', message: err instanceof Error ? err.message : 'Gagal menghubungi server' });
      updateAgentImportSession(businessId, { status: 'error' });
    } finally {
      const session = readAgentImportSession(businessId);
      if (session?.status === 'running') {
        updateAgentImportSession(businessId, { status: 'error' });
      }
      setIsRunning(false);
      runningRef.current = false;
    }
  }, [selectedFile, businessId, selectedChannel, instruction, addStep, router, onImportComplete]);

  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Upload CSV dari channel penjualanmu — Agent menganalisis, mencocokkan akun, dan menyimpan jurnal transaksi secara otomatis.
      </p>

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
                    onClick={() => { setSelectedChannel(ch.value); setInstruction(''); setChannelDropdownOpen(false); }}
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

      {/* Instruksi tambahan */}
      {(selectedChannel === 'airbnb' || selectedChannel === 'tiktok_tokopedia') && (
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Instruksi tambahan <span className="font-normal text-gray-400">(opsional)</span>
          </label>
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            disabled={isRunning}
            rows={2}
            placeholder={selectedChannel === 'airbnb'
              ? 'Mis. "masukkan ke piutang dulu, dana belum cair" · "hanya bulan Mei" · "jadikan draft"'
              : 'Mis. "masukkan ke piutang dulu, dana belum cair" · "hanya TikTok bulan Mei" · "jadikan draft"'
            }
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 resize-none disabled:opacity-50"
          />
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            Agent menerjemahkan instruksi jadi filter & akun — perhitungan angka tetap akurat & deterministik.
          </p>
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
        <Info className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          {selectedChannel === 'airbnb'
            ? 'Agent akan buat jurnal 3-baris per booking: Dr Bank (paidout), Dr Komisi Airbnb (service fee), Cr Pendapatan Sewa (gross). Transaksi langsung masuk sebagai posted.'
            : selectedChannel === 'tiktok_tokopedia'
            ? 'Agent akan buat 1 transaksi per pesanan (multi-SKU digabung): Dr Kas/Bank, Cr Pendapatan Penjualan sebesar subtotal net. Hanya pesanan "Selesai" diproses; Order ID yang sudah diimpor dilewati otomatis (anti-duplikat).'
            : 'Channel ini belum didukung. Pilih channel lain untuk sekarang.'}
        </p>
      </div>

      {/* Import result summary */}
      {importResult && !isRunning && (
        <div className={`p-4 rounded-xl border ${
          importResult.failed > 0
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Selesai!</span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
            <p>✓ <strong>{importResult.inserted}</strong> transaksi berhasil diimpor sebagai <em>posted</em></p>
            {importResult.skipped > 0 && <p>⊘ <strong>{importResult.skipped}</strong> dilewati (bukan pesanan selesai)</p>}
            {(importResult.duplicate ?? 0) > 0 && <p>⊘ <strong>{importResult.duplicate}</strong> duplikat dilewati (sudah diimpor)</p>}
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
            : { background: 'radial-gradient(circle at 30% 25%, #a5b4fc 0%, #6366f1 45%, #3730a3 100%)' }
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

      {/* Progress Toast */}
      {toastVisible && (
        <AgentProgressToast
          steps={agentSteps}
          isRunning={isRunning}
          onDismiss={() => setToastVisible(false)}
        />
      )}
    </div>
  );
}
