'use client';

import { useBusinessContext } from '@/context/BusinessContext';
import { ChannelImportTab } from '@/components/agent/ChannelImportTab';
import { Bot, AlertCircle, Table2 } from 'lucide-react';
import { isManagerRole } from '@/lib/roles';
import { useRouter } from 'next/navigation';

export default function AgentPage() {
  const router = useRouter();
  const { activeBusinessId, userRole, activeBusiness } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  if (!canManage) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Akses Terbatas</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Hanya Business Manager yang dapat menggunakan Agentic Workflow.</p>
      </div>
    );
  }

  if (!activeBusinessId) return null;

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
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Agentic Workflow</h1>
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
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
          <Table2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Import Revenue CSV</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Upload CSV dari channel penjualanmu, Agent yang proses</p>
          </div>
        </div>

        <div className="p-5">
          <ChannelImportTab
            businessId={activeBusinessId}
            onImportComplete={() => router.push('/transactions?agentImport=1')}
          />
        </div>
      </div>
    </div>
  );
}
