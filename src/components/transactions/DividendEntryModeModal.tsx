'use client';

import { Modal } from '@/components/ui/Modal';
import { Banknote, FileText, AlertCircle } from 'lucide-react';
import type { Account } from '@/types';
import { findDividendPayableAccount } from '@/lib/accounting/guidance/dividendSettlement';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';
import type { DividendEntryMode } from '@/lib/utils/quickTransactionHelper';

interface DividendEntryModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: DividendEntryMode) => void;
  selectedAccount: Account | null;
  accounts: Account[];
}

/**
 * Popup pilihan saat user pilih akun Dividen / Prive di Quick Add atau Complete Form.
 *   - Cashout: bayar langsung dari Kas/Bank   (Dr Dividen / Cr Bank)
 *   - Declare: commitment, belum dibayar       (Dr Dividen / Cr Hutang Dividen)
 *
 * Kalau akun Hutang Dividen belum ada, opsi Declare disabled dengan instruksi
 * untuk membuatnya di Chart of Accounts.
 */
export function DividendEntryModeModal({
  isOpen,
  onClose,
  onSelect,
  selectedAccount,
  accounts,
}: DividendEntryModeModalProps) {
  if (!selectedAccount) return null;

  const cashAccount = findDefaultCashAccount(accounts);
  const payableAccount = findDividendPayableAccount(accounts);
  const declareAvailable = !!payableAccount;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pilih Cara Pencatatan Dividen">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Akun <strong>{selectedAccount.account_code} {selectedAccount.account_name}</strong> adalah
          akun Dividen / Prive. Pilih cara pencatatan:
        </p>

        {/* Cashout option */}
        <button
          type="button"
          onClick={() => onSelect('cashout')}
          className="w-full text-left p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all group"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Cashout Langsung
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Uang sudah keluar dari rekening saat dicatat. Cocok untuk penarikan tunai langsung.
              </p>
              <div className="mt-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md font-mono text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                Dr {selectedAccount.account_code} {selectedAccount.account_name} &nbsp;|&nbsp;
                Cr {cashAccount?.account_code ?? '1200'} {cashAccount?.account_name ?? 'Bank'}
              </div>
            </div>
          </div>
        </button>

        {/* Declare option */}
        <button
          type="button"
          onClick={() => declareAvailable && onSelect('declare')}
          disabled={!declareAvailable}
          className={`w-full text-left p-4 border-2 rounded-xl transition-all ${
            declareAvailable
              ? 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer'
              : 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Declare (Commitment)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Dividen sudah ditetapkan tapi belum dibayar. Pencatatan pembayaran dilakukan terpisah lewat tombol &quot;Bayar&quot; di detail transaksi.
              </p>
              {declareAvailable ? (
                <div className="mt-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md font-mono text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  Dr {selectedAccount.account_code} {selectedAccount.account_name} &nbsp;|&nbsp;
                  Cr {payableAccount!.account_code} {payableAccount!.account_name}
                </div>
              ) : (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-semibold">Akun Hutang Dividen belum tersedia.</p>
                    <p className="mt-0.5">
                      Buka <strong>Chart of Accounts</strong>, buat akun LIABILITY (mis. <em>2300 Hutang Dividen</em>), lalu aktifkan toggle <em>&quot;Akun Hutang Dividen&quot;</em>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          Batal
        </button>
      </div>
    </Modal>
  );
}
