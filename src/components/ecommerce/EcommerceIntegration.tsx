'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ExternalLink,
  ArrowRight,
  ShoppingBag,
  Zap,
  BookOpen,
  Link2,
} from 'lucide-react';

interface EcommerceConnection {
  id: string;
  business_id: string;
  platform: string;
  shop_id: number;
  shop_name: string;
  shop_logo: string;
  is_active: boolean;
  last_synced_at: string | null;
  token_expires_at: string;
  created_at: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  orders_fetched: number;
  transactions_created: number;
  errors: string[];
  started_at: string;
  completed_at: string | null;
}

interface Props {
  businessId: string;
  canManage: boolean;
}

const PLATFORM_CONFIG: Record<string, { label: string; logo: string; comingSoon?: boolean; description: string }> = {
  shopee: {
    label: 'Shopee',
    logo: '/images/ecommerce/Shopee.png',
    description: 'Sinkronisasi order Shopee secara otomatis ke pembukuan',
  },
  tokopedia: {
    label: 'Tokopedia',
    logo: '/images/ecommerce/Tokopedia.png',
    comingSoon: true,
    description: 'Integrasi dengan toko Tokopedia kamu',
  },
  tiktok: {
    label: 'TikTok Shop',
    logo: '/images/ecommerce/Tiktokshop.png',
    comingSoon: true,
    description: 'Integrasi dengan TikTok Shop kamu',
  },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

function SyncStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    success: {
      label: 'Sukses',
      className: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    partial: {
      label: 'Sebagian',
      className: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    failed: {
      label: 'Gagal',
      className: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    running: {
      label: 'Berjalan',
      className: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    },
  };

  const c = config[status] || config.failed;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function HowItWorksSteps() {
  const steps = [
    {
      icon: <Link2 className="w-4 h-4" />,
      title: 'Hubungkan toko',
      desc: 'Klik Hubungkan dan izinkan akses ke toko Shopee kamu',
    },
    {
      icon: <RefreshCw className="w-4 h-4" />,
      title: 'Sinkronisasi order',
      desc: 'Order selesai di Shopee otomatis masuk sebagai transaksi',
    },
    {
      icon: <BookOpen className="w-4 h-4" />,
      title: 'Pembukuan otomatis',
      desc: 'Dicatat sebagai Debit Bank / Kredit Pendapatan — double-entry siap pakai',
    },
  ];

  return (
    <div className="mt-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Cara kerja
      </p>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-500 dark:text-primary-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              {step.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{step.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EcommerceIntegration({ businessId, canManage }: Props) {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<EcommerceConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('shopee_connected') === '1') {
      setToast({ type: 'success', message: 'Shopee berhasil terhubung!' });
    }
    const err = searchParams.get('shopee_error');
    if (err) {
      setToast({ type: 'error', message: decodeURIComponent(err) });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [connResult, logResult] = await Promise.all([
      supabase
        .from('business_ecommerce_connections')
        .select('*')
        .eq('business_id', businessId),
      fetch(`/api/ecommerce/sync?businessId=${businessId}`).then((r) => r.json()),
    ]);

    setConnections((connResult.data as EcommerceConnection[]) ?? []);
    setSyncLogs((logResult.data as SyncLog[]) ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const shopeeConnection = connections.find((c) => c.platform === 'shopee' && c.is_active);

  const handleConnect = (platform: string) => {
    window.location.href = `/api/ecommerce/${platform}/auth?businessId=${businessId}`;
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/ecommerce/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, platform: 'shopee' }),
      });
      const data = await res.json();

      if (!res.ok) {
        setToast({ type: 'error', message: data.error || 'Gagal sync' });
      } else {
        const msg =
          data.transactionsCreated > 0
            ? `${data.transactionsCreated} transaksi baru dari ${data.ordersFound} order`
            : data.ordersFound > 0
              ? 'Semua order sudah pernah di-sync'
              : 'Tidak ada order baru';
        setToast({ type: 'success', message: msg });
        window.dispatchEvent(new Event('transaction-saved'));
      }

      await fetchData();
    } catch {
      setToast({ type: 'error', message: 'Terjadi kesalahan saat sync' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!shopeeConnection) return;
    if (
      !confirm(
        'Yakin ingin memutuskan koneksi Shopee? Data transaksi yang sudah di-sync tidak akan dihapus.'
      )
    )
      return;

    setDisconnecting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('business_ecommerce_connections')
        .update({ is_active: false })
        .eq('id', shopeeConnection.id);

      setToast({ type: 'success', message: 'Koneksi Shopee diputus' });
      await fetchData();
    } catch {
      setToast({ type: 'error', message: 'Gagal memutuskan koneksi' });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasAnyConnection = connections.some((c) => c.is_active);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary-500" />
          Integrasi E-Commerce
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Hubungkan toko online kamu agar order masuk otomatis ke pembukuan AXION.
        </p>
      </div>

      {/* Platform Cards */}
      <div className="space-y-3">
        {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
          const connection = connections.find((c) => c.platform === platform && c.is_active);
          const isConnected = !!connection;

          return (
            <div
              key={platform}
              className={`card-static rounded-xl p-5 ${
                isConnected
                  ? 'border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-gray-800'
                  : 'bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Logo + info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Status dot */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-700">
                      <Image
                        src={config.logo}
                        alt={config.label}
                        width={40}
                        height={40}
                        className="w-full h-full object-contain"
                        unoptimized
                      />
                    </div>
                    {isConnected && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {config.label}
                      </h3>
                      {config.comingSoon && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          Segera
                        </span>
                      )}
                      {isConnected && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                          Terhubung
                        </span>
                      )}
                    </div>

                    {isConnected && connection ? (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {connection.shop_name || `Shop ID: ${connection.shop_id}`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {connection.last_synced_at
                            ? `Sync terakhir: ${formatRelativeTime(connection.last_synced_at)}`
                            : 'Belum pernah di-sync'}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        {config.comingSoon ? 'Integrasi akan tersedia segera' : config.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 sm:pt-0.5">
                  {isConnected ? (
                    <>
                      {canManage && (
                        <button
                          onClick={handleSync}
                          disabled={syncing}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                          {syncing ? 'Sinkronisasi...' : 'Sync Sekarang'}
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={handleDisconnect}
                          disabled={disconnecting}
                          title="Putuskan koneksi"
                          className="btn-icon text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    canManage &&
                    !config.comingSoon && (
                      <button
                        onClick={() => handleConnect(platform)}
                        className="btn-primary flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Hubungkan
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* How it works — hanya untuk Shopee yang belum terhubung */}
              {platform === 'shopee' && !isConnected && !config.comingSoon && (
                <HowItWorksSteps />
              )}

              {/* Connected summary — stats dari sync logs */}
              {isConnected && syncLogs.length > 0 && platform === 'shopee' && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-3 gap-3">
                  {(() => {
                    const successLogs = syncLogs.filter((l) => l.status === 'success' || l.status === 'partial');
                    const totalOrders = successLogs.reduce((s, l) => s + l.orders_fetched, 0);
                    const totalTxns = successLogs.reduce((s, l) => s + l.transactions_created, 0);
                    return (
                      <>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{syncLogs.length}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total sync</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalOrders}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Order diambil</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{totalTxns}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Transaksi dibuat</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Value prop banner — hanya saat belum ada koneksi sama sekali */}
      {!hasAnyConnection && (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 border border-primary-100 dark:border-primary-800/40">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">
                Hemat waktu pembukuan hingga 90%
              </p>
              <p className="mt-0.5 text-sm text-primary-700 dark:text-primary-400">
                Tidak perlu input manual — setiap order Shopee langsung tercatat sebagai jurnal double-entry di AXION secara otomatis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sync History */}
      {syncLogs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            Riwayat Sinkronisasi
          </h3>
          <div className="card-static rounded-xl p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Waktu
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Tipe
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Order
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Transaksi
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {syncLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                      {formatRelativeTime(log.started_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs capitalize">
                      {log.sync_type === 'manual'
                        ? 'Manual'
                        : log.sync_type === 'scheduled'
                          ? 'Otomatis'
                          : 'Webhook'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-medium text-xs">
                      {log.orders_fetched}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-xs">
                      <span className={log.transactions_created > 0 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}>
                        {log.transactions_created}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SyncStatusBadge status={log.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer — link ke transaksi */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <a
                href="/transactions"
                className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline flex items-center gap-1"
              >
                Lihat semua transaksi
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
