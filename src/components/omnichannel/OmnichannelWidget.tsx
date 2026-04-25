'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BusinessInitialsAvatar } from './BusinessInitialsAvatar';
import { PublicBusiness, formatCategory, formatSector } from './types';

interface Props {
  business: PublicBusiness | null;
  index: number;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function OmnichannelWidget({ business, index }: Props) {
  const [date, setDate] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  if (!business) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
        <p className="text-sm text-gray-400">Pilih bisnis untuk melihat info kontak.</p>
      </div>
    );
  }

  const isJasa = (business.business_category ?? 'jasa') === 'jasa';
  const hasWhatsApp = !!business.whatsapp_number?.trim();
  const dateMode = business.widget_date_mode ?? 'double';
  const labels = business.widget_labels ?? {};

  const dateLabel = labels.date_label || 'Tanggal Kunjungan';
  const checkinLabel = labels.checkin_label || 'Check-in';
  const checkoutLabel = labels.checkout_label || 'Check-out';
  const noteLabel = labels.note_label || 'Catatan (opsional)';
  const notePlaceholder = labels.note_placeholder || 'misal: 2 tamu, butuh parkir';
  const ctaLabel = labels.cta_label || 'Kirim rencana via WhatsApp';
  const actionLabel = labels.action_label || business.widget_action_label || 'kunjungan';

  function handleSend() {
    if (!business) return;

    if (dateMode === 'single') {
      if (!date) {
        setError(`Pilih ${dateLabel.toLowerCase()} terlebih dahulu.`);
        return;
      }
    } else {
      if (!checkin || !checkout) {
        setError(`Pilih ${checkinLabel.toLowerCase()} dan ${checkoutLabel.toLowerCase()} terlebih dahulu.`);
        return;
      }
    }

    if (!hasWhatsApp) {
      setError('Nomor WhatsApp belum tersedia untuk bisnis ini.');
      return;
    }

    setError('');

    let msg = `Halo, saya tertarik untuk *${actionLabel}* di *${business.business_name}*.`;

    if (dateMode === 'single') {
      msg += `\n\n${dateLabel}: ${formatDate(date)}`;
    } else {
      msg += `\n\n${checkinLabel}: ${formatDate(checkin)}\n${checkoutLabel}: ${formatDate(checkout)}`;
    }

    if (note.trim()) msg += `\n\nCatatan: ${note.trim()}`;
    msg += `\n\nBoleh konfirmasi ketersediaan?`;

    const url = `https://wa.me/${business.whatsapp_number}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  const metaLine = [
    formatCategory(business.business_category),
    formatSector(business.business_type),
    business.city,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-lg shadow-gray-200/60 dark:shadow-gray-900/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {business.logo_url ? (
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
            <Image
              src={business.logo_url}
              alt={business.business_name}
              width={44}
              height={44}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        ) : (
          <BusinessInitialsAvatar name={business.business_name} index={index} />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {business.business_name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {metaLine}
          </p>
        </div>
      </div>

      <hr className="border-gray-100 dark:border-gray-800 mb-4" />

      {isJasa ? (
        <>
          {dateMode === 'single' ? (
            <div className="mb-3">
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                {dateLabel}
              </label>
              <input
                type="date"
                min={today}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setError('');
                }}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {checkinLabel}
                </label>
                <input
                  type="date"
                  min={today}
                  value={checkin}
                  onChange={(e) => {
                    setCheckin(e.target.value);
                    setError('');
                  }}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {checkoutLabel}
                </label>
                <input
                  type="date"
                  min={checkin || today}
                  value={checkout}
                  onChange={(e) => {
                    setCheckout(e.target.value);
                    setError('');
                  }}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              {noteLabel}
            </label>
            <input
              type="text"
              placeholder={notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <button
            onClick={handleSend}
            disabled={!hasWhatsApp}
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all"
          >
            <WhatsAppIcon />
            {ctaLabel}
          </button>
          <p className="text-[11px] text-center text-gray-400 mt-2.5">
            {hasWhatsApp
              ? 'Tidak ada komitmen — pemilik akan konfirmasi ketersediaan'
              : 'Nomor WhatsApp belum dikonfigurasi'}
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          Widget kontak tersedia untuk bisnis jasa.
        </p>
      )}
    </div>
  );
}
