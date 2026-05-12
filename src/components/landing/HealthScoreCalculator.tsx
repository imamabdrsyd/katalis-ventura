'use client';

import { useEffect, useState } from 'react';

type Step = 'input' | 'result';

type Grade = {
  label: string;
  emoji: string;
  color: string;
  ring: string;
  glow: string;
  text: string;
};

const formatRupiah = (value: string): string => {
  const numeric = value.replace(/\D/g, '');
  if (!numeric) return '';
  return parseInt(numeric, 10).toLocaleString('id-ID');
};

const parseRupiah = (value: string): number => {
  return parseInt(value.replace(/\D/g, '') || '0', 10);
};

const formatCurrency = (n: number): string => {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
};

const getGrade = (score: number): Grade => {
  if (score >= 80)
    return {
      label: 'Sangat Sehat',
      emoji: '🎉',
      color: 'from-emerald-400 to-teal-500',
      ring: 'stroke-emerald-400',
      glow: 'shadow-[0_0_60px_-10px_rgba(52,211,153,0.6)]',
      text: 'text-emerald-400',
    };
  if (score >= 60)
    return {
      label: 'Sehat',
      emoji: '✅',
      color: 'from-teal-400 to-cyan-500',
      ring: 'stroke-teal-400',
      glow: 'shadow-[0_0_60px_-10px_rgba(45,212,191,0.55)]',
      text: 'text-teal-400',
    };
  if (score >= 40)
    return {
      label: 'Perlu Perhatian',
      emoji: '⚠️',
      color: 'from-amber-400 to-orange-500',
      ring: 'stroke-amber-400',
      glow: 'shadow-[0_0_60px_-10px_rgba(251,191,36,0.55)]',
      text: 'text-amber-400',
    };
  return {
    label: 'Kritis',
    emoji: '🚨',
    color: 'from-rose-400 to-red-500',
    ring: 'stroke-rose-400',
    glow: 'shadow-[0_0_60px_-10px_rgba(251,113,133,0.55)]',
    text: 'text-rose-400',
  };
};

const generateRecommendations = (
  margin: number,
  buffer: number,
  profit: number,
): string[] => {
  const recs: string[] = [];

  if (profit < 0) {
    recs.push(
      'Bisnismu sedang merugi. Audit pengeluaran terbesar dan cari yang bisa dipotong minggu ini.',
    );
  }
  if (buffer < 1) {
    recs.push(
      'Saldo kas sangat tipis — kurang dari 1 bulan. Prioritaskan menambah cash buffer sebelum ekspansi.',
    );
  } else if (buffer < 3) {
    recs.push(
      'Cash buffer masih di bawah 3 bulan. Target ideal adalah 3 bulan pengeluaran sebagai safety net.',
    );
  }
  if (margin > 0 && margin < 5) {
    recs.push(
      'Net margin di bawah 5% artinya rentan. Review 3 pengeluaran terbesar kamu bulan ini.',
    );
  }
  if (margin >= 20 && buffer >= 3) {
    recs.push(
      'Fundamental bisnis kamu kuat. Ini saat yang tepat untuk scaling terukur.',
    );
  }
  if (recs.length === 0) {
    recs.push(
      'Bisnis kamu dalam kondisi sehat. Jaga konsistensi dan mulai tracking lebih detail.',
    );
  }

  return recs.slice(0, 3);
};

const getMarginLabel = (margin: number): { text: string; tone: string } => {
  if (margin < 0) return { text: 'Merugi', tone: 'text-rose-400' };
  if (margin < 5) return { text: 'Tipis (<5%)', tone: 'text-amber-400' };
  if (margin <= 15) return { text: 'Cukup (5–15%)', tone: 'text-teal-400' };
  return { text: 'Bagus (>15%)', tone: 'text-emerald-400' };
};

const getBufferLabel = (buffer: number): { text: string; tone: string } => {
  if (buffer < 1) return { text: 'Risiko (<1 bln)', tone: 'text-rose-400' };
  if (buffer <= 3) return { text: 'Cukup (1–3 bln)', tone: 'text-amber-400' };
  return { text: 'Aman (>3 bln)', tone: 'text-emerald-400' };
};

export default function HealthScoreCalculator() {
  const [step, setStep] = useState<Step>('input');
  const [revenue, setRevenue] = useState('');
  const [expense, setExpense] = useState('');
  const [cash, setCash] = useState('');
  const [error, setError] = useState('');

  const [animatedScore, setAnimatedScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [metrics, setMetrics] = useState({
    netProfit: 0,
    netMargin: 0,
    cashBuffer: 0,
  });
  const [recs, setRecs] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseRupiah(revenue);
    const ex = parseRupiah(expense);
    const c = parseRupiah(cash);

    if (r <= 0 || ex <= 0 || c <= 0) {
      setError('Mohon isi semua kolom dengan angka lebih dari 0.');
      return;
    }
    setError('');

    const netProfit = r - ex;
    const netMargin = r > 0 ? (netProfit / r) * 100 : 0;
    const monthlyBurn = ex > 0 ? ex : 1;
    const cashBuffer = c / monthlyBurn;

    const marginScore = Math.min(40, Math.max(0, netMargin * 2));
    const bufferScore = Math.min(40, cashBuffer * 13.33);
    const profitBonus = netProfit > 0 ? 20 : 0;
    const totalScore = Math.round(marginScore + bufferScore + profitBonus);

    setMetrics({ netProfit, netMargin, cashBuffer });
    setRecs(generateRecommendations(netMargin, cashBuffer, netProfit));
    setFinalScore(totalScore);
    setAnimatedScore(0);
    setStep('result');
  };

  useEffect(() => {
    if (step !== 'result') return;
    let current = 0;
    const target = finalScore;
    const duration = 1100;
    const steps = 40;
    const stepValue = target / steps;
    const interval = duration / steps;
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= target) {
        setAnimatedScore(target);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, interval);
    return () => clearInterval(timer);
  }, [step, finalScore]);

  const reset = () => {
    setStep('input');
    setError('');
  };

  const grade = getGrade(finalScore);
  const marginInfo = getMarginLabel(metrics.netMargin);
  const bufferInfo = getBufferLabel(metrics.cashBuffer);

  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-slate-950 p-6 sm:p-10 ring-1 ring-white/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.12),transparent_50%)]" />

      <div className="relative">
        {step === 'input' && (
          <div className="mx-auto max-w-xl animate-[fadeUp_0.5s_ease-out]">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Gratis • Tanpa daftar
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Cek Kesehatan Keuangan{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Bisnismu
              </span>
            </h2>
            <p className="mt-3 text-base text-slate-400">
              Gratis. 3 angka. 10 detik.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <InputField
                label="Pendapatan bulan ini"
                value={revenue}
                onChange={setRevenue}
                placeholder="contoh: 25.000.000"
              />
              <InputField
                label="Total pengeluaran bulan ini"
                value={expense}
                onChange={setExpense}
                placeholder="contoh: 18.000.000"
              />
              <InputField
                label="Saldo kas / tabungan bisnis sekarang"
                value={cash}
                onChange={setCash}
                placeholder="contoh: 35.000.000"
              />

              {error && (
                <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Hitung Sekarang
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M3 8h10m0 0L8 3m5 5l-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Data hanya diproses di browser-mu. Tidak disimpan, tidak dikirim
              kemana-mana.
            </p>
          </div>
        )}

        {step === 'result' && (
          <div className="animate-[fadeUp_0.5s_ease-out]">
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 text-sm font-medium text-slate-400">
                Skor Kesehatan Keuangan
              </div>

              <div
                className={`relative inline-flex items-center justify-center rounded-full ${grade.glow}`}
              >
                <svg width="220" height="220" className="-rotate-90">
                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="14"
                  />
                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    strokeWidth="14"
                    strokeLinecap="round"
                    className={grade.ring}
                    style={{
                      strokeDasharray: circumference,
                      strokeDashoffset: circumference - progress,
                      transition: 'stroke-dashoffset 0.1s linear',
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div
                    className={`bg-gradient-to-br ${grade.color} bg-clip-text text-6xl font-bold leading-none tracking-tight text-transparent sm:text-7xl`}
                  >
                    {animatedScore}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">dari 100</div>
                </div>
              </div>

              <div
                className={`mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-base font-semibold ${grade.text} ring-1 ring-white/10`}
              >
                <span className="text-xl">{grade.emoji}</span>
                {grade.label}
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <MetricCard
                delay={0}
                label="Net Margin"
                value={`${metrics.netMargin.toFixed(1)}%`}
                hint={marginInfo.text}
                tone={marginInfo.tone}
              />
              <MetricCard
                delay={100}
                label="Cash Buffer"
                value={`${metrics.cashBuffer.toFixed(1)} bulan`}
                hint={bufferInfo.text}
                tone={bufferInfo.tone}
              />
              <MetricCard
                delay={200}
                label="Net Profit"
                value={formatCurrency(metrics.netProfit)}
                hint={metrics.netProfit >= 0 ? 'Untung' : 'Rugi'}
                tone={
                  metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }
                valueClass={
                  metrics.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }
              />
            </div>

            <div className="mt-8 rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white">
                  Rekomendasi untukmu
                </h3>
              </div>
              <ul className="space-y-3">
                {recs.map((rec, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-sm text-slate-300 animate-[fadeUp_0.4s_ease-out]"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <span className="mt-1 flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/signup"
                className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-center text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 hover:scale-[1.01]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Lacak Otomatis dengan AXION — Gratis 14 Hari
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M3 8h10m0 0L8 3m5 5l-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </a>
              <button
                onClick={reset}
                className="rounded-xl bg-white/5 px-6 py-4 text-base font-medium text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
              >
                Hitung Ulang
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(formatRupiah(e.target.value))}
          placeholder={placeholder}
          className="w-full rounded-xl bg-white/[0.04] py-4 pl-12 pr-4 text-base font-semibold text-white placeholder:text-slate-600 ring-1 ring-white/10 transition-all focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
  delay,
  valueClass,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
  delay: number;
  valueClass?: string;
}) {
  return (
    <div
      className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 opacity-0 animate-[fadeUp_0.5s_ease-out_forwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-bold tracking-tight ${
          valueClass ?? 'text-white'
        }`}
      >
        {value}
      </div>
      <div className={`mt-1 text-xs font-medium ${tone}`}>{hint}</div>
    </div>
  );
}
