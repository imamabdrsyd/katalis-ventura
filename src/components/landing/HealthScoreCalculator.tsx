'use client';

import { useEffect, useRef, useState } from 'react';

type Step = 'input' | 'result';

type Grade = {
  label: string;
  emoji: string;
  color: string;        // Tailwind gradient
  ring: string;         // SVG stroke class
  glow: string;         // shadow class
  text: string;         // text color class
  cardBg: string;       // hex for share card
};

const formatRupiah = (value: string): string => {
  const numeric = value.replace(/\D/g, '');
  if (!numeric) return '';
  return parseInt(numeric, 10).toLocaleString('id-ID');
};

const parseRupiah = (value: string): number =>
  parseInt(value.replace(/\D/g, '') || '0', 10);

const formatCurrency = (n: number): string =>
  'Rp ' + Math.round(n).toLocaleString('id-ID');

const getGrade = (score: number): Grade => {
  if (score >= 80)
    return {
      label: 'Sangat Sehat', emoji: '🎉',
      color: 'from-emerald-400 to-teal-400',
      ring: 'stroke-emerald-400',
      glow: 'shadow-[0_0_60px_-10px_rgba(52,211,153,0.5)]',
      text: 'text-emerald-400', cardBg: '#34d399',
    };
  if (score >= 60)
    return {
      label: 'Sehat', emoji: '✅',
      color: 'from-indigo-400 to-violet-400',
      ring: 'stroke-indigo-400',
      glow: 'shadow-[0_0_60px_-10px_rgba(99,102,241,0.55)]',
      text: 'text-indigo-400', cardBg: '#818cf8',
    };
  if (score >= 40)
    return {
      label: 'Perlu Perhatian', emoji: '⚠️',
      color: 'from-amber-400 to-orange-400',
      ring: 'stroke-amber-400',
      glow: 'shadow-[0_0_60px_-10px_rgba(251,191,36,0.5)]',
      text: 'text-amber-400', cardBg: '#fbbf24',
    };
  return {
    label: 'Kritis', emoji: '🚨',
    color: 'from-rose-400 to-red-400',
    ring: 'stroke-rose-400',
    glow: 'shadow-[0_0_60px_-10px_rgba(251,113,133,0.5)]',
    text: 'text-rose-400', cardBg: '#fb7185',
  };
};

const generateRecommendations = (margin: number, buffer: number, profit: number): string[] => {
  const recs: string[] = [];
  if (profit < 0)
    recs.push('Bisnismu sedang merugi. Audit pengeluaran terbesar dan cari yang bisa dipotong minggu ini.');
  if (buffer < 1)
    recs.push('Saldo kas sangat tipis — kurang dari 1 bulan. Prioritaskan menambah cash buffer sebelum ekspansi.');
  else if (buffer < 3)
    recs.push('Cash buffer masih di bawah 3 bulan. Target ideal adalah 3 bulan pengeluaran sebagai safety net.');
  if (margin > 0 && margin < 5)
    recs.push('Net margin di bawah 5% artinya rentan. Review 3 pengeluaran terbesar kamu bulan ini.');
  if (margin >= 20 && buffer >= 3)
    recs.push('Fundamental bisnis kamu kuat. Ini saat yang tepat untuk scaling terukur.');
  if (recs.length === 0)
    recs.push('Bisnis kamu dalam kondisi sehat. Jaga konsistensi dan mulai tracking lebih detail.');
  return recs.slice(0, 3);
};

const getMarginLabel = (m: number) => {
  if (m < 0)  return { text: 'Merugi',        tone: 'text-rose-400' };
  if (m < 5)  return { text: 'Tipis (<5%)',   tone: 'text-amber-400' };
  if (m <= 15) return { text: 'Cukup (5–15%)', tone: 'text-indigo-400' };
  return           { text: 'Bagus (>15%)',  tone: 'text-emerald-400' };
};

const getBufferLabel = (b: number) => {
  if (b < 1)  return { text: 'Risiko (<1 bln)', tone: 'text-rose-400' };
  if (b <= 3) return { text: 'Cukup (1–3 bln)', tone: 'text-amber-400' };
  return         { text: 'Aman (>3 bln)',    tone: 'text-emerald-400' };
};

export default function HealthScoreCalculator({
  showShareButtons = false,
}: {
  showShareButtons?: boolean;
}) {
  const [step, setStep]       = useState<Step>('input');
  const [revenue, setRevenue] = useState('');
  const [expense, setExpense] = useState('');
  const [cash, setCash]       = useState('');
  const [error, setError]     = useState('');

  const [animatedScore, setAnimatedScore] = useState(0);
  const [finalScore, setFinalScore]       = useState(0);
  const [metrics, setMetrics] = useState({ netProfit: 0, netMargin: 0, cashBuffer: 0 });
  const [recs, setRecs]       = useState<string[]>([]);

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r  = parseRupiah(revenue);
    const ex = parseRupiah(expense);
    const c  = parseRupiah(cash);
    if (r <= 0 || ex <= 0 || c <= 0) {
      setError('Mohon isi semua kolom dengan angka lebih dari 0.');
      return;
    }
    setError('');
    const netProfit  = r - ex;
    const netMargin  = r > 0 ? (netProfit / r) * 100 : 0;
    const monthlyBurn = ex > 0 ? ex : 1;
    const cashBuffer = c / monthlyBurn;
    const marginScore = Math.min(40, Math.max(0, netMargin * 2));
    const bufferScore = Math.min(40, cashBuffer * 13.33);
    const profitBonus = netProfit > 0 ? 20 : 0;
    const totalScore  = Math.round(marginScore + bufferScore + profitBonus);
    setMetrics({ netProfit, netMargin, cashBuffer });
    setRecs(generateRecommendations(netMargin, cashBuffer, netProfit));
    setFinalScore(totalScore);
    setAnimatedScore(0);
    setStep('result');
  };

  useEffect(() => {
    if (step !== 'result') return;
    let current = 0;
    const target   = finalScore;
    const steps    = 40;
    const stepVal  = target / steps;
    const ms       = 1100 / steps;
    const timer = setInterval(() => {
      current += stepVal;
      if (current >= target) { setAnimatedScore(target); clearInterval(timer); }
      else setAnimatedScore(Math.round(current));
    }, ms);
    return () => clearInterval(timer);
  }, [step, finalScore]);

  const reset = () => { setStep('input'); setError(''); };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText('https://axionventura.com/cek-bisnis');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveImage = async () => {
    if (!shareCardRef.current || saving) return;
    setSaving(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#0f172a', scale: 2, useCORS: true, logging: false,
      });
      const link = document.createElement('a');
      link.download = 'skor-bisnis-axion.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsApp = () => {
    const grade = getGrade(finalScore);
    const text  = encodeURIComponent(
      `Aku baru cek kesehatan keuangan bisnismu di AXION, dapat skor ${finalScore}/100 (${grade.label} ${grade.emoji}).\n\nCoba juga yuk di axionventura.com/cek-bisnis`,
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const grade      = getGrade(finalScore);
  const marginInfo = getMarginLabel(metrics.netMargin);
  const bufferInfo = getBufferLabel(metrics.cashBuffer);

  const radius       = 88;
  const circumference = 2 * Math.PI * radius;
  const progress     = (animatedScore / 100) * circumference;

  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-gray-900 p-6 sm:p-10 ring-1 ring-white/10">
      {/* Brand gradient: indigo top-right, purple bottom-left */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.12),transparent_50%)]" />

      <div className="relative">
        {/* ── STEP 1: INPUT ── */}
        {step === 'input' && (
          <div className="mx-auto max-w-xl animate-[fadeUp_0.5s_ease-out]">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              Gratis • Tanpa daftar
            </div>

            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Cek Kesehatan Keuangan{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Bisnismu
              </span>
            </h2>
            <p className="mt-3 text-base text-gray-400">Gratis. 3 angka. 10 detik.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <InputField label="Pendapatan bulan ini"              value={revenue} onChange={setRevenue} placeholder="contoh: 25.000.000" />
              <InputField label="Total pengeluaran bulan ini"       value={expense} onChange={setExpense} placeholder="contoh: 18.000.000" />
              <InputField label="Saldo kas / tabungan bisnis sekarang" value={cash} onChange={setCash}    placeholder="contoh: 35.000.000" />

              {error && (
                <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Hitung Sekarang
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10m0 0L8 3m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-500">
              Data hanya diproses di browser-mu. Tidak disimpan, tidak dikirim kemana-mana.
            </p>
          </div>
        )}

        {/* ── STEP 2: RESULT ── */}
        {step === 'result' && (
          <div className="animate-[fadeUp_0.5s_ease-out]">
            {/* Score gauge */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 text-sm font-medium text-gray-400">Skor Kesehatan Keuangan</div>

              <div className={`relative inline-flex items-center justify-center rounded-full ${grade.glow}`}>
                <svg width="220" height="220" className="-rotate-90">
                  <circle cx="110" cy="110" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
                  <circle
                    cx="110" cy="110" r={radius} fill="none" strokeWidth="14" strokeLinecap="round"
                    className={grade.ring}
                    style={{ strokeDasharray: circumference, strokeDashoffset: circumference - progress, transition: 'stroke-dashoffset 0.1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={`bg-gradient-to-br ${grade.color} bg-clip-text text-6xl font-bold leading-none tracking-tight text-transparent sm:text-7xl`}>
                    {animatedScore}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">dari 100</div>
                </div>
              </div>

              <div className={`mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-base font-semibold ${grade.text} ring-1 ring-white/10`}>
                <span className="text-xl">{grade.emoji}</span>
                {grade.label}
              </div>
            </div>

            {/* Metric cards */}
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <MetricCard delay={0}   label="Net Margin"   value={`${metrics.netMargin.toFixed(1)}%`}     hint={marginInfo.text} tone={marginInfo.tone} />
              <MetricCard delay={100} label="Cash Buffer"  value={`${metrics.cashBuffer.toFixed(1)} bulan`} hint={bufferInfo.text} tone={bufferInfo.tone} />
              <MetricCard
                delay={200} label="Net Profit" value={formatCurrency(metrics.netProfit)}
                hint={metrics.netProfit >= 0 ? 'Untung' : 'Rugi'}
                tone={metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                valueClass={metrics.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}
              />
            </div>

            {/* Recommendations */}
            <div className="mt-8 rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white">Rekomendasi untukmu</h3>
              </div>
              <ul className="space-y-3">
                {recs.map((rec, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-300 animate-[fadeUp_0.4s_ease-out]" style={{ animationDelay: `${i * 100}ms` }}>
                    <span className="mt-1 flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Share Panel */}
            {showShareButtons && (
              <div className="mt-8 rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
                <p className="mb-4 text-sm font-semibold text-gray-300">Bagikan hasilmu</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  {/* Save image */}
                  <button
                    onClick={handleSaveImage}
                    disabled={saving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-medium text-gray-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-60"
                  >
                    {saving ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                    {saving ? 'Menyimpan...' : 'Simpan Gambar'}
                  </button>

                  {/* Copy link */}
                  <button
                    onClick={handleCopyLink}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-medium text-gray-200 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                  >
                    {copied ? (
                      <svg className="h-4 w-4 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    )}
                    {copied ? 'Disalin!' : 'Salin Link'}
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={handleWhatsApp}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366]/10 px-4 py-3 text-sm font-medium text-[#25D366] ring-1 ring-[#25D366]/20 transition-colors hover:bg-[#25D366]/20"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </button>
                </div>
              </div>
            )}

            {/* Hidden share card for html2canvas */}
            {showShareButtons && (
              <div className="pointer-events-none absolute -left-[9999px] top-0">
                <div
                  ref={shareCardRef}
                  style={{
                    width: 540, height: 960,
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '48px 40px',
                    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {/* Glow blobs */}
                  <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:`radial-gradient(circle, ${grade.cardBg}44 0%, transparent 70%)`, pointerEvents:'none' }} />
                  <div style={{ position:'absolute', bottom:-80, left:-80, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle, #6366f144 0%, transparent 70%)', pointerEvents:'none' }} />

                  {/* AXION wordmark */}
                  <div style={{ marginBottom: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.15em', color: '#fff', opacity: 0.9 }}>AXION</div>
                    <div style={{ fontSize: 10, color: '#6366f1', letterSpacing: '0.1em', marginTop: 3, textTransform: 'uppercase' }}>Business Finance Platform</div>
                  </div>

                  {/* Label */}
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 20, textTransform: 'uppercase' }}>
                    Skor Kesehatan Bisnismu
                  </div>

                  {/* Score */}
                  <div style={{ fontSize: 96, fontWeight: 800, color: grade.cardBg, lineHeight: 1, marginBottom: 8 }}>
                    {finalScore}
                  </div>
                  <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>dari 100</div>

                  {/* Grade badge */}
                  <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.06)', borderRadius:100, padding:'8px 20px', marginBottom:40, border:`1px solid ${grade.cardBg}44` }}>
                    <span style={{ fontSize: 20 }}>{grade.emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: grade.cardBg }}>{grade.label}</span>
                  </div>

                  {/* Divider */}
                  <div style={{ width:'100%', height:1, background:'rgba(255,255,255,0.07)', marginBottom:32 }} />

                  {/* Metrics */}
                  <div style={{ display:'flex', gap:0, width:'100%', marginBottom:40 }}>
                    {[
                      { label: 'Net Margin',  value: `${metrics.netMargin.toFixed(1)}%` },
                      { label: 'Cash Buffer', value: `${metrics.cashBuffer.toFixed(1)} bln` },
                      { label: 'Net Profit',  value: metrics.netProfit >= 0 ? `+Rp ${(metrics.netProfit/1e6).toFixed(1)}jt` : `-Rp ${(Math.abs(metrics.netProfit)/1e6).toFixed(1)}jt` },
                    ].map((m, i) => (
                      <div key={i} style={{ flex:1, textAlign:'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', padding:'0 16px' }}>
                        <div style={{ fontSize:11, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{m.label}</div>
                        <div style={{ fontSize:18, fontWeight:700, color:'#e2e8f0' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Watermark */}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'#475569', marginBottom:4 }}>Coba juga di</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#6366f1' }}>axionventura.com/cek-bisnis</div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/signup"
                className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-4 text-center text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.01]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Lacak Otomatis dengan AXION — Gratis 14 Hari
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10m0 0L8 3m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </a>
              <button
                onClick={reset}
                className="rounded-xl bg-white/5 px-6 py-4 text-base font-medium text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
              >
                Hitung Ulang
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

function InputField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">Rp</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(formatRupiah(e.target.value))}
          placeholder={placeholder}
          className="w-full rounded-xl bg-white/[0.04] py-4 pl-12 pr-4 text-base font-semibold text-white placeholder:text-gray-600 ring-1 ring-white/10 transition-all focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint, tone, delay, valueClass }: {
  label: string; value: string; hint: string; tone: string; delay: number; valueClass?: string;
}) {
  return (
    <div
      className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 opacity-0 animate-[fadeUp_0.5s_ease-out_forwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold tracking-tight ${valueClass ?? 'text-white'}`}>{value}</div>
      <div className={`mt-1 text-xs font-medium ${tone}`}>{hint}</div>
    </div>
  );
}
