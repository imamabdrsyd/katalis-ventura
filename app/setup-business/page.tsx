'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ArrowLeft, ArrowRight, Building2, Check, ListChecks, Wallet } from 'lucide-react';
import { createBusiness } from '@/lib/api/businesses';
import FloatingField, { FloatingSelect } from '@/components/ui/FloatingField';
import { CardFormSkeleton } from '@/components/ui/PageSkeleton';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { useLanguage } from '@/context/LanguageContext';
import { BUSINESS_SECTOR_PRESETS, BUSINESS_TYPE_PRESETS } from '@/lib/businessSectors';
import { formatCurrency } from '@/lib/utils';

// Preset resmi dari businessSectors.ts + opsi free-text khusus UI.
const SECTOR_OPTIONS = [
  ...BUSINESS_SECTOR_PRESETS,
  { value: 'other', label: 'Lainnya (Custom)' },
];

const TOTAL_STEPS = 2;

type Step = 1 | 2 | 'done';

export default function SetupBusinessPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);

  // Langkah 1 — identitas
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<string>(BUSINESS_TYPE_PRESETS[0].value);
  const [sector, setSector] = useState<string>(BUSINESS_SECTOR_PRESETS[0].value);
  const [customSector, setCustomSector] = useState('');

  // Langkah 2 — modal & lokasi
  const [capital, setCapital] = useState(0);
  const [capitalDisplay, setCapitalDisplay] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Hasil pembuatan — dipakai layar ringkasan
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [createdCapital, setCreatedCapital] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
        } else {
          setIsCheckingAuth(false);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, supabase]);

  const step1Valid =
    businessName.trim().length > 0 && (sector !== 'other' || customSector.trim().length > 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enter di field langkah 1 ikut men-submit form — perlakukan sebagai "Lanjut",
    // jangan langsung membuat bisnis dengan modal yang belum sempat diisi.
    if (step === 1) {
      if (step1Valid) setStep(2);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const finalSector = sector === 'other' ? customSector.trim() : sector;

      // Server juga menyiapkan bagan akun default + transaksi modal awal.
      const business = await createBusiness(
        {
          business_name: businessName.trim(),
          business_sector: finalSector,
          business_type: businessType,
          capital_investment: capital,
          property_address: propertyAddress.trim(),
        },
        user.id
      );

      // Jumlah akun untuk layar ringkasan — sekadar pemanis, jangan gagalkan alur.
      try {
        const { count } = await supabase
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', business.id);
        setAccountCount(count ?? null);
      } catch {
        setAccountCount(null);
      }

      setCreatedCapital(capital);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.onboarding.createFailed);
    } finally {
      setLoading(false);
    }
  };

  const goTo = (path: string) => {
    router.push(path);
    router.refresh();
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <CardFormSkeleton />
      </div>
    );
  }

  const currentStep = step === 'done' ? TOTAL_STEPS : step;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
        {step === 'done' ? (
          <DoneScreen
            accountCount={accountCount}
            capital={createdCapital}
            onDashboard={() => goTo('/dashboard')}
            onRecordTransaction={() => goTo('/transactions')}
          />
        ) : (
          <>
            {/* Header — nilai dulu, baru form */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl mx-auto mb-4 flex items-center justify-center text-white">
                <Building2 className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {t.onboarding.title}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 max-w-md mx-auto">
                {t.onboarding.subtitle}
              </p>
            </div>

            {/* Indikator langkah */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-primary-400">
                  {t.onboarding.stepLabel
                    .replace('{current}', String(currentStep))
                    .replace('{total}', String(TOTAL_STEPS))}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {step === 1 ? t.onboarding.step1Title : t.onboarding.step2Title}
                </span>
              </div>
              <div className="flex gap-1.5" role="presentation">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                      i < currentStep
                        ? 'bg-primary-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-6">
              {step === 1 ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1">
                    {t.onboarding.step1Desc}
                  </p>

                  <FloatingField
                    label={`${t.onboarding.businessName} *`}
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t.onboarding.businessNameHint}
                    autoFocus
                    required
                  />

                  <div>
                    <FloatingSelect
                      label={t.onboarding.businessCategory}
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                    >
                      {BUSINESS_TYPE_PRESETS.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </FloatingSelect>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      {t.onboarding.businessCategoryHint}
                    </p>
                  </div>

                  <div>
                    <FloatingSelect
                      label={t.onboarding.sector}
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                    >
                      {SECTOR_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </FloatingSelect>
                    {sector === 'other' && (
                      <div className="mt-3">
                        <FloatingField
                          label={`${t.onboarding.customSector} *`}
                          type="text"
                          value={customSector}
                          onChange={(e) => setCustomSector(e.target.value)}
                          placeholder={t.onboarding.customSectorHint}
                          required
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!step1Valid}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                  >
                    {t.onboarding.next}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1">
                    {t.onboarding.step2Desc}
                  </p>

                  <div>
                    <CurrencyInputWithCalculator
                      label={t.onboarding.capital}
                      displayValue={capitalDisplay}
                      onChange={(numericValue, display) => {
                        setCapital(numericValue);
                        setCapitalDisplay(display);
                      }}
                      placeholder="0"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      {capital > 0 ? t.onboarding.capitalHint : t.onboarding.capitalSkipHint}
                    </p>
                  </div>

                  <div>
                    <label className="label">
                      {t.onboarding.address}{' '}
                      <span className="text-gray-400 font-normal">({t.onboarding.optional})</span>
                    </label>
                    <textarea
                      value={propertyAddress}
                      onChange={(e) => setPropertyAddress(e.target.value)}
                      placeholder={t.onboarding.addressHint}
                      rows={3}
                      className="input"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
                      disabled={loading}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t.onboarding.back}
                    </button>
                    <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
                      {loading ? t.onboarding.creating : t.onboarding.createBusiness}
                    </button>
                  </div>
                </>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Layar ringkasan — menyebut apa yang sudah disiapkan sistem sebelum pengguna
 * masuk dashboard, supaya kerja yang tak terlihat (bagan akun, transaksi modal)
 * terbaca sebagai hasil.
 */
function DoneScreen({
  accountCount,
  capital,
  onDashboard,
  onRecordTransaction,
}: {
  accountCount: number | null;
  capital: number;
  onDashboard: () => void;
  onRecordTransaction: () => void;
}) {
  const { t } = useLanguage();
  const hasCapital = capital > 0;

  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white">
          <Check className="w-8 h-8" strokeWidth={3} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {t.onboarding.doneTitle}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
          {t.onboarding.doneSubtitle}
        </p>
      </div>

      <div className="space-y-3 mb-8">
        <SummaryRow
          icon={<ListChecks className="w-5 h-5" />}
          title={t.onboarding.doneAccounts}
          description={t.onboarding.doneAccountsDesc}
          meta={
            accountCount
              ? t.onboarding.doneAccountsCount.replace('{count}', String(accountCount))
              : undefined
          }
        />
        <SummaryRow
          icon={<Wallet className="w-5 h-5" />}
          title={hasCapital ? t.onboarding.doneCapital : t.onboarding.doneNoCapital}
          description={hasCapital ? t.onboarding.doneCapitalDesc : t.onboarding.doneNoCapitalDesc}
          meta={hasCapital ? formatCurrency(capital) : undefined}
          muted={!hasCapital}
        />
      </div>

      <div className="space-y-3">
        {hasCapital ? (
          <>
            <button onClick={onDashboard} className="btn-primary w-full py-3">
              {t.onboarding.goToDashboard}
            </button>
            <button onClick={onRecordTransaction} className="btn-secondary w-full py-3">
              {t.onboarding.recordTransaction}
            </button>
          </>
        ) : (
          <>
            <button onClick={onRecordTransaction} className="btn-primary w-full py-3">
              {t.onboarding.recordFirstTransaction}
            </button>
            <button onClick={onDashboard} className="btn-secondary w-full py-3">
              {t.onboarding.goToDashboard}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  title,
  description,
  meta,
  muted = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  meta?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
          muted
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300'
            : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{title}</p>
          {meta && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
              {meta}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
