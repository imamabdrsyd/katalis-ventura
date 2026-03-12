'use client';

import { FileText, Pencil, Trash2, Download } from 'lucide-react';
import type { Invoice } from '@/types';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

interface InvoiceListProps {
  invoices: Invoice[];
  loading: boolean;
  onRowClick?: (invoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onDownloadPDF?: (invoice: Invoice) => void;
}

export function InvoiceList({
  invoices,
  loading,
  onRowClick,
  onEdit,
  onDelete,
  onDownloadPDF,
}: InvoiceListProps) {
  const showActions = !!(onEdit || onDelete || onDownloadPDF);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Memuat invoice...</p>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Belum ada invoice
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Mulai dengan membuat invoice pertama Anda
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed min-w-[800px]">
        <colgroup>
          <col className="w-12" />
          <col className="w-36" />
          <col className="w-40" />
          <col className="w-28" />
          <col className="w-28" />
          <col className="w-32" />
          <col className="w-28" />
          {showActions && <col className="w-28" />}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <tr className="border-b-2 border-gray-300 dark:border-gray-500">
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              No
            </th>
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              No. Invoice
            </th>
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Customer
            </th>
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Tanggal
            </th>
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Jatuh Tempo
            </th>
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total
            </th>
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Status
            </th>
            {showActions && (
              <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Aksi
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice, index) => (
            <tr
              key={invoice.id}
              onClick={() => onRowClick?.(invoice)}
              className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              <td className="py-3 px-2 md:py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {index + 1}
              </td>
              <td className="py-3 px-2 md:py-4 text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                {invoice.invoice_number}
              </td>
              <td className="py-3 px-2 md:py-4 text-sm text-gray-700 dark:text-gray-300 break-words">
                {invoice.customer_name}
              </td>
              <td className="py-3 px-2 md:py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {formatDateShort(invoice.invoice_date)}
              </td>
              <td className="py-3 px-2 md:py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {invoice.due_date ? formatDateShort(invoice.due_date) : '-'}
              </td>
              <td className="py-3 px-2 md:py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {formatCurrency(invoice.total_amount)}
              </td>
              <td className="py-3 px-2 md:py-4">
                <InvoiceStatusBadge status={invoice.payment_status} />
              </td>
              {showActions && (
                <td className="py-3 px-2 md:py-4">
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(invoice);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {onDownloadPDF && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadPDF(invoice);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(invoice);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
