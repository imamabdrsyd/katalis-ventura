'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import type { BankCode, BankStatementParsed, StatementSource } from '@/lib/bankStatements';

type CashBankAccount = {
  id: string;
  account_code: string;
  account_name: string;
};

type ParseResponse = {
  data: {
    file_hash: string;
    file_name: string | null;
    source: StatementSource;
    cached: boolean;
    raw_text: string;
    parsed: BankStatementParsed;
  };
};

type CommitResponse = {
  data: {
    import_id: string;
    inserted_rows: number;
    skipped_duplicates: number;
    total_rows: number;
  };
};

const BANK_OPTIONS: { value: BankCode; label: string }[] = [
  { value: 'BCA', label: 'BCA' },
  { value: 'MANDIRI', label: 'Mandiri' },
  { value: 'BRI', label: 'BRI' },
  { value: 'BNI', label: 'BNI' },
  { value: 'GENERIC', label: 'Generic / Lainnya' },
];

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BankStatementImportModal({ businessId, isOpen, onClose, onSuccess }: Props) {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [bankCode, setBankCode] = useState<BankCode>('BCA');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form');

  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parseResult, setParseResult] = useState<ParseResponse['data'] | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse['data'] | null>(null);

  useEffect(() => {
    if (!isOpen || !businessId) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_code, account_name')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .or('account_code.like.11%,account_code.like.12%')
        .order('account_code');
      setAccounts((data ?? []) as CashBankAccount[]);
      if (data && data.length > 0 && !accountId) {
        setAccountId(data[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, businessId]);

  const handleClose = () => {
    setStep('form');
    setFile(null);
    setParseResult(null);
    setCommitResult(null);
    setError(null);
    setParsing(false);
    setCommitting(false);
    onClose();
  };

  const handleParse = async () => {
    setError(null);
    if (!accountId) return setError(t.reconciliation.importMutasiErrorNoAccount);
    if (!file) return setError(t.reconciliation.importMutasiErrorNoFile);

    setParsing(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('business_id', businessId);
      form.append('bank_code', bankCode);

      const res = await fetch('/api/bank-statements/parse', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Parse gagal');
      }
      setParseResult((json as ParseResponse).data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse gagal');
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    if (!parseResult) return;
    setError(null);
    setCommitting(true);
    try {
      const res = await fetch('/api/bank-statements/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          account_id: accountId,
          source: parseResult.source,
          file_name: parseResult.file_name,
          file_hash: parseResult.file_hash,
          raw_text: parseResult.raw_text,
          parsed: parseResult.parsed,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Commit gagal');
      }
      setCommitResult((json as CommitResponse).data);
      setStep('success');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit gagal');
    } finally {
      setCommitting(false);
    }
  };

  const title = useMemo(() => {
    if (step === 'preview') return t.reconciliation.importMutasiPreviewTitle;
    if (step === 'success') return t.reconciliation.importMutasiCommitSuccess.replace(
      '{n}',
      String(commitResult?.inserted_rows ?? 0)
    );
    return t.reconciliation.importMutasiTitle;
  }, [step, t, commitResult]);

  const footer = useMemo(() => {
    if (step === 'form') {
      return (
        <div className="flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            {t.common.cancel}
          </button>
          <button
            onClick={handleParse}
            disabled={parsing || !file || !accountId}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {parsing ? t.reconciliation.importMutasiParsing : t.reconciliation.importMutasiParseButton}
          </button>
        </div>
      );
    }
    if (step === 'preview') {
      return (
        <div className="flex justify-between gap-2">
          <button
            onClick={() => setStep('form')}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.reconciliation.importMutasiBackButton}
          </button>
          <button
            onClick={handleCommit}
            disabled={committing}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {committing ? t.reconciliation.importMutasiCommitting : t.reconciliation.importMutasiCommitButton}
          </button>
        </div>
      );
    }
    return (
      <div className="flex justify-end">
        <button onClick={handleClose} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          {t.common.close}
        </button>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, parsing, committing, file, accountId, t]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} footer={footer} size="3xl">
      {step === 'form' && (
        <FormStep
          accounts={accounts}
          accountId={accountId}
          onAccountChange={setAccountId}
          bankCode={bankCode}
          onBankChange={setBankCode}
          file={file}
          onFileChange={setFile}
          error={error}
        />
      )}
      {step === 'preview' && parseResult && (
        <PreviewStep parsed={parseResult.parsed} error={error} />
      )}
      {step === 'success' && commitResult && (
        <SuccessStep result={commitResult} />
      )}
    </Modal>
  );
}

function FormStep({
  accounts,
  accountId,
  onAccountChange,
  bankCode,
  onBankChange,
  file,
  onFileChange,
  error,
}: {
  accounts: CashBankAccount[];
  accountId: string;
  onAccountChange: (id: string) => void;
  bankCode: BankCode;
  onBankChange: (code: BankCode) => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
  error: string | null;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t.reconciliation.importMutasiDesc}</p>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.reconciliation.importMutasiBankAccount}
        </label>
        <select
          value={accountId}
          onChange={(e) => onAccountChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
        >
          {accounts.length === 0 && <option value="">(Tidak ada akun kas/bank)</option>}
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.account_code} — {acc.account_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.reconciliation.importMutasiBank}
        </label>
        <select
          value={bankCode}
          onChange={(e) => onBankChange(e.target.value as BankCode)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
        >
          {BANK_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.reconciliation.importMutasiFile}
        </label>
        <label className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <FileText className="w-8 h-8 text-gray-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400 text-center px-4">
            {file ? file.name : t.reconciliation.importMutasiDropFile}
          </span>
          <input
            type="file"
            accept=".pdf,image/*,.csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function PreviewStep({ parsed, error }: { parsed: BankStatementParsed; error: string | null }) {
  const { t } = useLanguage();
  const validation = parsed.validation;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label={t.reconciliation.importMutasiOpeningBalance}
          value={parsed.opening_balance}
        />
        <SummaryCard
          label={t.reconciliation.importMutasiClosingBalance}
          value={parsed.closing_balance}
        />
        <SummaryCard
          label={t.reconciliation.importMutasiTotalCredit}
          value={parsed.total_credit}
          color="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          label={t.reconciliation.importMutasiTotalDebit}
          value={parsed.total_debit}
          color="text-red-600 dark:text-red-400"
        />
      </div>

      {/* Warnings */}
      {validation && validation.warnings.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {t.reconciliation.importMutasiWarnings}
            </p>
          </div>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
            {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Rows */}
      <div>
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t.reconciliation.importMutasiPreviewRows.replace('{n}', String(parsed.rows.length))}
        </p>
        <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Tanggal</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Keterangan</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Counterparty</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {parsed.rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.posted_at}</td>
                  <td className="px-3 py-1.5">
                    <p className="text-gray-900 dark:text-gray-100">{r.description}</p>
                    {r.reference_code && (
                      <p className="text-[10px] text-gray-400">{r.reference_code}</p>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{r.counterparty_name ?? '—'}</td>
                  <td className={`px-3 py-1.5 text-right font-medium whitespace-nowrap ${
                    r.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {r.amount >= 0 ? '+' : ''}{formatCurrency(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value?: number; color?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
      <p className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      <p className={`text-sm font-bold mt-1 ${color ?? 'text-gray-900 dark:text-gray-100'}`}>
        {value !== undefined ? formatCurrency(value) : '—'}
      </p>
    </div>
  );
}

function SuccessStep({ result }: { result: CommitResponse['data'] }) {
  const { t } = useLanguage();
  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {t.reconciliation.importMutasiInsertedRows.replace('{n}', String(result.inserted_rows))}
      </p>
      {result.skipped_duplicates > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t.reconciliation.importMutasiSkippedDuplicates.replace('{n}', String(result.skipped_duplicates))}
        </p>
      )}
    </div>
  );
}
