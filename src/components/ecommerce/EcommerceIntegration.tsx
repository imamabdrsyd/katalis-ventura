'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import {
  ShoppingBag,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ExternalLink,
  Store,
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

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode; comingSoon?: boolean }> = {
  shopee: {
    label: 'Shopee',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    icon: <ShoppingBag className="w-5 h-5" />,
  },
  tokopedia: {
    label: 'Tokopedia',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    icon: <Store className="w-5 h-5" />,
    comingSoon: true,
  },
  tiktok: {
    label: 'TikTok Shop',
    color: 'text-gray-800 dark:text-gray-200',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    icon: <ShoppingBag className="w-5 h-5" />,
    comingSoon: true,
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
      className: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    partial: {
      label: 'Sebagian',
      className: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    failed: {
      label: 'Gagal',
      className: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    running: {
      label: 'Berjalan',
      className: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
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

export function EcommerceIntegration({ businessId, canManage }: Props) {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<EcommerceConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Toast dari redirect callback
  useEffect(() => {
    if (searchParams.get('shopee_connected') === '1') {
      setToast({ type: 'success', message: 'Shopee berhasil terhubung!' });
    }
    const err = searchParams.get('shopee_error');
    if (err) {
      setToast({ type: 'error', message: decodeURIComponent(err) });
    }
  }, [searchParams]);

  // Auto-dismiss toast
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

  const shopeeConnection = connections.find((c) => c.platform === 'shopee');

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
        const msg = data.transactionsCreated > 0
          ? `${data.transactionsCreated} transaksi baru dari ${data.ordersFound} order`
          : data.ordersFound > 0
            ? 'Semua order sudah pernah di-sync'
            : 'Tidak ada order baru';
        setToast({ type: 'success', message: msg });

        // Dispatch event agar halaman transaksi refresh
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
    if (!confirm('Yakin ingin memutuskan koneksi Shopee? Data transaksi yang sudah di-sync tidak akan dihapus.')) return;

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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Platform Cards */}
      <div className="space-y-4">
        {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
          const connection = connections.find((c) => c.platform === platform && c.is_active);
          const isConnected = !!connection;

          return (
            <div
              key={platform}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            >
              <div className="flex items-center justify-between">
                {/* Left: platform info */}
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bgColor} ${config.color}`}>
                    {config.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {config.label}
                      </h3>
                      {config.comingSoon && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          Segera
                        </span>
                      )}
                    </div>
                    {isConnected && connection ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {connection.shop_name || `Shop ID: ${connection.shop_id}`}
                        {connection.last_synced_at && (
                          <span className="ml-2 text-xs">
                            &middot; Sync terakhir: {formatRelativeTime(connection.last_synced_at)}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        {config.comingSoon ? 'Integrasi akan tersedia' : 'Belum terhubung'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      {canManage && (
                        <button
                          onClick={handleSync}
                          disabled={syncing}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                          {syncing ? 'Syncing...' : 'Sync Sekarang'}
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={handleDisconnect}
                          disabled={disconnecting}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    canManage && !config.comingSoon && (
                      <button
                        onClick={() => handleConnect(platform)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors shadow-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Hubungkan
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync History */}
      {syncLogs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Riwayat Sinkronisasi
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Waktu</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Order</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Transaksi Baru</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {formatRelativeTime(log.started_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">
                      {log.sync_type === 'manual' ? 'Manual' : log.sync_type === 'scheduled' ? 'Otomatis' : 'Webhook'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {log.orders_fetched}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {log.transactions_created}
                    </td>
                    <td className="px-4 py-3">
                      <SyncStatusBadge status={log.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
