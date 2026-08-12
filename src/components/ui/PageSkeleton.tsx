'use client';

import type { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Pembungkus bersama semua skeleton.
 * Mengumumkan status memuat ke screen reader — menggantikan teks "Memuat…"
 * yang dulu menyertai spinner terpusat.
 */
function SkeletonRoot({ className, children }: { className?: string; children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t.common.loading}</span>
      {children}
    </div>
  );
}

const PULSE = 'animate-pulse motion-reduce:animate-none';

export function PageSkeleton() {
  return (
    <SkeletonRoot className={`p-6 space-y-6 ${PULSE}`}>
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    </SkeletonRoot>
  );
}

export function TableSkeleton() {
  return (
    <SkeletonRoot className={`p-6 space-y-4 ${PULSE}`}>
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    </SkeletonRoot>
  );
}

export function ReportSkeleton() {
  return (
    <SkeletonRoot className={`p-6 space-y-6 ${PULSE}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-4 w-56 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          <div className="h-9 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-72 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        <div className="h-72 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl" />
    </SkeletonRoot>
  );
}

/** Halaman form/pengaturan — header + panel kiri (profil) & tumpukan kartu isian kanan. */
export function FormSkeleton() {
  return (
    <SkeletonRoot className={`p-8 max-w-7xl mx-auto space-y-8 ${PULSE}`}>
      <div className="space-y-2">
        <div className="h-8 w-44 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-[380px] flex-shrink-0 h-80 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        <div className="flex-1 w-full space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}

/**
 * Kartu form terpusat — halaman onboarding di luar layout dashboard
 * (`setup-business`, `join-business`). Dipakai di dalam pembungkus gradient halaman.
 */
export function CardFormSkeleton() {
  return (
    <SkeletonRoot
      className={`w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 space-y-6 ${PULSE}`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-6 w-52 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
      <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </SkeletonRoot>
  );
}

/**
 * Grid kartu **tanpa header** — untuk region daftar di dalam halaman yang
 * header/tab-nya sudah ter-render (mis. daftar bisnis).
 */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonRoot className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 ${PULSE}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-44 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
      ))}
    </SkeletonRoot>
  );
}

/**
 * Baris list vertikal **tanpa header** — untuk panel/daftar sempit di dalam
 * halaman (mis. daftar akun di sidebar buku besar).
 */
export function ListSkeleton({ rows = 6, className = '' }: { rows?: number; className?: string }) {
  return (
    <SkeletonRoot className={`space-y-2 ${PULSE} ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      ))}
    </SkeletonRoot>
  );
}
