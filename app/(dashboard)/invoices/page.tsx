'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Settings, Plus, Trash2, Receipt } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import { InvoiceSettingsModal } from '@/components/invoices/InvoiceSettingsModal';
import { TransactionPickerModal } from '@/components/invoices/TransactionPickerModal';
import { CreateInvoiceFromTransactionsModal } from '@/components/invoices/CreateInvoiceFromTransactionsModal';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import type { InvoicePaymentStatus, Transaction } from '@/types';

const STATUS_TAB_VALUES: ('' | InvoicePaymentStatus)[] = ['', 'draft', 'unpaid', 'paid', 'overdue'];

function InvoicesPageInner() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const {
    filteredInvoices,
    loading,
    saving,
    error,
    statusCounts,
    activeBusiness,
    businessLoading,
    businessError,
    canManageInvoices,
    showAddModal, setShowAddModal,
    editInvoice, setEditInvoice,
    deleteInvoiceTarget, setDeleteInvoiceTarget,
    showSettingsModal, setShowSettingsModal,
    invoiceSettings,
    nextInvoiceNumber,
    statusFilter, setStatusFilter,
    handleCreateInvoice,
    handleUpdateInvoice,
    handleDeleteInvoice,
    handleDownloadPDF,
    handleSaveSettings,
    fetchInvoices,
  } = useInvoices();

  // "Buat dari Transaksi" picker → preview/edit flow
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<Transaction[]>([]);
  const [showInvoiceFromTxnsModal, setShowInvoiceFromTxnsModal] = useState(false);

  // Auto-open create modal when navigated from Journal Entry (?create=true)
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowAddModal(true);
    }
  }, [searchParams, setShowAddModal]);

  // Loading state
  if (businessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (businessError) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Bisnis Tidak Ditemukan</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{businessError}</p>
          <a href="/setup-business" className="btn-primary">Setup Bisnis</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <FileText className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            Invoice
          </h1>
        </div>
        {canManageInvoices && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="btn-icon"
              title={t.invoices.settings}
              aria-label={t.invoices.settings}
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowPickerModal(true)}
              className="btn-ghost flex items-center gap-2"
              title="Pilih transaksi piutang untuk dijadikan invoice"
            >
              <Receipt className="h-4 w-4" />
              Buat dari Transaksi
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t.invoices.createInvoice}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          <button onClick={fetchInvoices} className="text-red-500 dark:text-red-400 underline text-sm mt-2">
            Coba lagi
          </button>
        </div>
      )}

      {/* Invoice List */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] p-5">

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {STATUS_TAB_VALUES.map((value) => {
            const statusLabels: Record<string, string> = {
              '': t.invoices.allTab,
              draft: t.invoices.draftTab,
              unpaid: t.invoices.unpaid,
              paid: t.invoices.paid,
              overdue: t.invoices.overdue,
            };
            const count = value ? statusCounts[value] : 0;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  statusFilter === value
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {statusLabels[value]}
                {value && count > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="overflow-auto max-h-[70vh]">
          <InvoiceList
            invoices={filteredInvoices}
            loading={loading}
            onRowClick={canManageInvoices ? setEditInvoice : undefined}
            onEdit={canManageInvoices ? setEditInvoice : undefined}
            onDelete={canManageInvoices ? setDeleteInvoiceTarget : undefined}
            onDownloadPDF={handleDownloadPDF}
          />
        </div>
      </div>

      {/* Add Invoice Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t.invoices.createInvoice}
        size="3xl"
      >
        <InvoiceForm
          onSubmit={handleCreateInvoice}
          onCancel={() => setShowAddModal(false)}
          loading={saving}
          defaultInvoiceNumber={nextInvoiceNumber}
          defaultDueDays={invoiceSettings?.default_due_days ?? 7}
          defaultTaxRate={invoiceSettings?.default_tax_rate ?? 11}
          defaultTaxType={invoiceSettings?.default_tax_type ?? 'none'}
          businessCategory={activeBusiness?.business_type}
        />
      </Modal>

      {/* {t.invoices.editInvoice} Modal */}
      <Modal
        isOpen={!!editInvoice}
        onClose={() => setEditInvoice(null)}
        title={t.invoices.editInvoice}
        size="3xl"
      >
        {editInvoice && (
          <InvoiceForm
            onSubmit={handleUpdateInvoice}
            onCancel={() => setEditInvoice(null)}
            loading={saving}
            invoice={editInvoice}
            businessCategory={activeBusiness?.business_type}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteInvoiceTarget}
        onClose={() => setDeleteInvoiceTarget(null)}
        title="Hapus Invoice"
      >
        <div className="p-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Yakin ingin menghapus invoice <strong>{deleteInvoiceTarget?.invoice_number}</strong>?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Invoice untuk {deleteInvoiceTarget?.customer_name} akan dihapus.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteInvoiceTarget(null)}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Batal
            </button>
            <button
              onClick={handleDeleteInvoice}
              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Invoice Settings Modal */}
      <InvoiceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={invoiceSettings}
        onSave={handleSaveSettings}
        loading={saving}
      />

      {/* "Buat dari Transaksi" — picker, then create-from-txn modal */}
      <TransactionPickerModal
        isOpen={showPickerModal}
        onClose={() => setShowPickerModal(false)}
        onProceed={(transactions) => {
          setPickerSelection(transactions);
          setShowPickerModal(false);
          setShowInvoiceFromTxnsModal(true);
        }}
      />
      <CreateInvoiceFromTransactionsModal
        isOpen={showInvoiceFromTxnsModal}
        onClose={() => {
          setShowInvoiceFromTxnsModal(false);
          setPickerSelection([]);
        }}
        transactions={pickerSelection}
        onSuccess={() => {
          setShowInvoiceFromTxnsModal(false);
          setPickerSelection([]);
          fetchInvoices();
        }}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <InvoicesPageInner />
    </Suspense>
  );
}
