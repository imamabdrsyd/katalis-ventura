'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGoogleConnectionStatus, type GoogleConnectionStatus } from '@/lib/api/googleSheets';

export const GOOGLE_SHEETS_STATUS_KEY = ['google-sheets', 'status'] as const;

const DISCONNECTED: GoogleConnectionStatus = {
  connected: false,
  email: null,
  connected_at: null,
  needs_reconnect: false,
};

/**
 * Status koneksi Google milik user yang sedang masuk.
 *
 * Dipakai dua tempat: kartu koneksi di Pengaturan, dan gating tombol
 * "Export ke Google Sheets" di halaman laporan (tombolnya tidak dirender sama
 * sekali bila belum terhubung — tanpa jalan buntu).
 *
 * Statusnya jarang berubah, jadi staleTime 5 menit sudah cukup dan menghindari
 * request berulang tiap kali halaman laporan dibuka.
 */
export function useGoogleSheetsConnection() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: GOOGLE_SHEETS_STATUS_KEY,
    queryFn: fetchGoogleConnectionStatus,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    status: data ?? DISCONNECTED,
    /** Terhubung DAN tidak perlu dihubungkan ulang — aman untuk memanggil API. */
    isConnected: Boolean(data?.connected),
    needsReconnect: Boolean(data?.needs_reconnect),
    loading: isLoading,
    error,
    refresh: () => queryClient.invalidateQueries({ queryKey: GOOGLE_SHEETS_STATUS_KEY }),
  };
}
