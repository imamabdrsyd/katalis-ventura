'use client';

import { useState, useEffect, useCallback } from 'react';
import { Globe, ExternalLink, Link2 } from 'lucide-react';
import type { BusinessOmniChannel, OmniChannelLink } from '@/types';
import { getOmniChannel } from '@/lib/api/omniChannel';
import { OmniChannelPageConfig } from './OmniChannelPageConfig';
import { OmniChannelLinkList } from './OmniChannelLinkList';

interface Props {
  businessId: string;
  businessName: string;
  userId: string;
}

export function OmniChannelManager({ businessId, businessName, userId }: Props) {
  const [channel, setChannel] = useState<BusinessOmniChannel | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChannel = useCallback(async () => {
    try {
      const data = await getOmniChannel(businessId);
      setChannel(data);
    } catch (err) {
      console.error('Failed to fetch omni-channel:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with link preview */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Halaman Publik
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tampilkan semua link bisnis dalam satu halaman
            </p>
          </div>
        </div>

        {channel?.is_published && channel.slug && (
          <a
            href={`/${channel.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Lihat Halaman
          </a>
        )}
      </div>

      {/* Page Config */}
      <OmniChannelPageConfig
        businessId={businessId}
        businessName={businessName}
        userId={userId}
        channel={channel}
        onSaved={fetchChannel}
      />

      {/* Links Section */}
      {channel && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">
              Daftar Link
            </h3>
          </div>
          <OmniChannelLinkList
            omniChannelId={channel.id}
            businessId={businessId}
            links={channel.links ?? []}
            onChanged={fetchChannel}
          />
        </div>
      )}
    </div>
  );
}
