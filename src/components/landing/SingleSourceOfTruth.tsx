'use client';

import Image from 'next/image';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

type Lang = 'id' | 'en';

const copy = {
  id: {
    engineLabel: 'Journal Entry Ledger',
    engineSub: 'Catat sekali',
    engineCaption: 'Sumber tunggal',
    calcCaption: 'Logic engine',
    calcLabel: 'calculations.ts',
    calcSub: 'Query & Aggregate',
    flowLabel: 'mengalir otomatis ke',
    cards: {
      incomeStatement: {
        title: 'Profit & Loss',
        sub: 'Statement 1',
      },
      balanceSheet: {
        title: 'Balance Sheet',
        sub: 'Statement 2',
      },
      cashFlow: {
        title: 'Cash Flow',
        sub: 'Statement 3',
      },
      dashboard: {
        title: 'Financial Dashboard',
        sub: 'Ringkasan Investor',
      },
    },
  },
  en: {
    engineLabel: 'Journal Entry Ledger',
    engineSub: 'Record once',
    engineCaption: 'Single source',
    calcCaption: 'Logic engine',
    calcLabel: 'calculations.ts',
    calcSub: 'Query & Aggregate',
    flowLabel: 'flows automatically into',
    cards: {
      incomeStatement: {
        title: 'Profit & Loss',
        sub: 'Statement 1',
      },
      balanceSheet: {
        title: 'Balance Sheet',
        sub: 'Statement 2',
      },
      cashFlow: {
        title: 'Cash Flow',
        sub: 'Statement 3',
      },
      dashboard: {
        title: 'Financial Dashboard',
        sub: 'Investor View',
      },
    },
  },
} as const;

// Real account codes & metrics from the actual system
const cardRows = {
  incomeStatement: [
    { code: '4100', label: 'Sales Revenue', emphasis: false },
    { code: '5200', label: 'COGS', emphasis: false },
    { code: '5100', label: 'Operating Expenses', emphasis: false },
    { code: '——', label: 'Net Profit', emphasis: true },
  ],
  balanceSheet: [
    { code: '1000', label: 'Assets', emphasis: false },
    { code: '2000', label: 'Liabilities', emphasis: false },
    { code: '3000', label: 'Equity', emphasis: false },
    { code: '——', label: 'Assets = L + E', emphasis: true },
  ],
  cashFlow: [
    { code: 'CFO', label: 'Operating', emphasis: false },
    { code: 'CFI', label: 'Investing', emphasis: false },
    { code: 'CFF', label: 'Financing', emphasis: false },
    { code: '——', label: 'Net Change', emphasis: true },
  ],
  dashboard: [
    { code: 'ROI', label: 'Return on Investment', emphasis: false },
    { code: 'GM%', label: 'Gross Margin', emphasis: false },
    { code: 'OPM%', label: 'Operating Margin', emphasis: false },
    { code: 'EBT', label: 'Earnings Before Tax', emphasis: false },
  ],
} as const;

type AccentKey = 'teal' | 'amber' | 'blue' | 'indigo';

const accent: Record<
  AccentKey,
  {
    stroke: string;
    bar: string;
    iconBg: string;
    iconText: string;
    chip: string;
    emphasisText: string;
    hoverGlow: string;
  }
> = {
  teal: {
    stroke: 'rgb(20 184 166)',
    bar: 'bg-teal-500 dark:bg-teal-400',
    iconBg: 'bg-teal-50 dark:bg-teal-500/10',
    iconText: 'text-teal-600 dark:text-teal-400',
    chip: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/10 ring-1 ring-inset ring-teal-200/60 dark:ring-teal-500/20',
    emphasisText: 'text-teal-700 dark:text-teal-300',
    hoverGlow: 'hover:shadow-[0_8px_30px_-12px_rgba(20,184,166,0.35)]',
  },
  amber: {
    stroke: 'rgb(245 158 11)',
    bar: 'bg-amber-500 dark:bg-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-500/10',
    iconText: 'text-amber-600 dark:text-amber-400',
    chip: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 ring-1 ring-inset ring-amber-200/60 dark:ring-amber-500/20',
    emphasisText: 'text-amber-700 dark:text-amber-300',
    hoverGlow: 'hover:shadow-[0_8px_30px_-12px_rgba(245,158,11,0.35)]',
  },
  blue: {
    stroke: 'rgb(59 130 246)',
    bar: 'bg-blue-500 dark:bg-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-500/10',
    iconText: 'text-blue-600 dark:text-blue-400',
    chip: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-inset ring-blue-200/60 dark:ring-blue-500/20',
    emphasisText: 'text-blue-700 dark:text-blue-300',
    hoverGlow: 'hover:shadow-[0_8px_30px_-12px_rgba(59,130,246,0.35)]',
  },
  indigo: {
    stroke: 'rgb(99 102 241)',
    bar: 'bg-primary-500 dark:bg-primary-400',
    iconBg: 'bg-primary-50 dark:bg-primary-500/10',
    iconText: 'text-primary-600 dark:text-primary-400',
    chip: 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10 ring-1 ring-inset ring-primary-200/60 dark:ring-primary-500/20',
    emphasisText: 'text-primary-700 dark:text-primary-300',
    hoverGlow: 'hover:shadow-[0_8px_30px_-12px_rgba(99,102,241,0.35)]',
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function SingleSourceOfTruth({ lang }: { lang: Lang }) {
  const reduce = useReducedMotion();
  const t = copy[lang];

  const cardsMeta: Array<{
    key: keyof typeof cardRows;
    title: string;
    sub: string;
    accent: AccentKey;
    icon: React.ReactNode;
  }> = [
    {
      key: 'incomeStatement',
      title: t.cards.incomeStatement.title,
      sub: t.cards.incomeStatement.sub,
      accent: 'teal',
      icon: <IconTrendingUp />,
    },
    {
      key: 'balanceSheet',
      title: t.cards.balanceSheet.title,
      sub: t.cards.balanceSheet.sub,
      accent: 'amber',
      icon: <IconScale />,
    },
    {
      key: 'cashFlow',
      title: t.cards.cashFlow.title,
      sub: t.cards.cashFlow.sub,
      accent: 'blue',
      icon: <IconWaves />,
    },
    {
      key: 'dashboard',
      title: t.cards.dashboard.title,
      sub: t.cards.dashboard.sub,
      accent: 'indigo',
      icon: <IconGauge />,
    },
  ];

  return (
    <div className="relative rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Soft grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-[0.32]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(99,102,241,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.14) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage:
            'radial-gradient(ellipse at 50% 30%, black 40%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 50% 30%, black 40%, transparent 75%)',
        }}
      />

      <div className="relative px-5 md:px-10 pt-8 md:pt-12 pb-6 md:pb-10">
        {/* ─── Center engine node ─── */}
        <div className="flex flex-col items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="relative w-full max-w-md"
          >
            {/* Caption pill */}
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium tracking-[0.18em] uppercase text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10 ring-1 ring-inset ring-primary-200/60 dark:ring-primary-500/20 rounded-full px-3 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  {!reduce && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                  )}
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                {t.engineCaption}
              </span>
            </div>

            {/* Engine card (with sonar pulse rings behind) */}
            <div className="relative">
              {!reduce && (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-primary-400/50 dark:ring-primary-400/40"
                    style={{
                      animation: 'axion-ssot-sonar 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
                    }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-primary-400/40 dark:ring-primary-400/30"
                    style={{
                      animation: 'axion-ssot-sonar 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
                      animationDelay: '1.2s',
                    }}
                  />
                </>
              )}
              <div className="relative rounded-2xl border border-primary-200 dark:border-primary-800/60 bg-gradient-to-b from-primary-50/80 to-white dark:from-primary-950/60 dark:via-gray-900 dark:to-gray-900 p-5 md:p-6 shadow-[0_12px_40px_-16px_rgba(99,102,241,0.45)] dark:shadow-[0_12px_40px_-16px_rgba(99,102,241,0.55)]">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                    {t.engineLabel}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {t.engineSub}
                  </p>
                </div>
                <div className="shrink-0">
                  <Image src="/images/favicon.png" alt="AXION" width={28} height={28} className="dark:hidden" />
                  <Image src="/images/favicon-dark.png" alt="AXION" width={28} height={28} className="hidden dark:block" />
                </div>
              </div>

              {/* Live ledger rows */}
              <div className="rounded-lg bg-white/80 dark:bg-gray-950/60 ring-1 ring-inset ring-primary-200/50 dark:ring-primary-800/40 px-3 py-2.5 space-y-1.5 font-mono text-[11px] md:text-[12px]">
                <LedgerRow side="Dr" code="1100" name="Cash" amount="5.000.000" />
                <LedgerRow side="Cr" code="4100" name="Sales Revenue" amount="5.000.000" muted />
              </div>

              {/* Data sources */}
              <div className="mt-3.5 pt-3.5 border-t border-primary-100/80 dark:border-primary-900/40 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-primary-400 dark:text-primary-600 mr-1">
                  sources
                </span>
                <SourceBadge icon={<IconShopee />} label="Shopee" color="text-orange-500" />
                <SourceBadge icon={<IconTelegram />} label="Telegram Bot" color="text-sky-500" />
                <SourceBadge icon={<IconOCR />} label="OCR Scan" color="text-violet-500" />
              </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ─── Connector 1: Engine → Calculation card (desktop only) ─── */}
        <div className="hidden md:block" aria-hidden>
          <FlowLineSingle />
        </div>

        {/* Mobile rail (engine → calc) */}
        <div className="md:hidden flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
          <span className="text-[10px] font-mono tracking-[0.16em] uppercase text-gray-500 dark:text-gray-400">
            ↓
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        </div>

        {/* ─── Calculation Engine card ─── */}
        <div className="flex flex-col items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0.5}
            className="relative w-full max-w-2xl"
          >
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium tracking-[0.18em] uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 rounded-full px-3 py-1">
                {'{}'}
                {t.calcCaption}
              </span>
            </div>

            <div className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/60 p-4 md:p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3.5">
                <div className="min-w-0">
                  <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight flex items-center gap-2">
                    <IconTypescript />
                    {t.calcLabel}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t.calcSub}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-mono font-semibold tracking-tight text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10 ring-1 ring-inset ring-primary-200/60 dark:ring-primary-500/20 rounded-md px-2 py-1">
                  Σ Dr = Σ Cr
                </span>
              </div>

              {/* Operation tags */}
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  'filter by period',
                  'sum by account',
                  'PSAK 16 / IAS 7',
                  'cumulative balance',
                ].map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[11px] text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 rounded-md px-2.5 py-1"
                  >
                    {tag}
                  </span>
                ))}
              </div>

            </div>
          </motion.div>
        </div>

        {/* ─── Connector 2: Calculation → 4 reports (desktop only) ─── */}
        <div className="hidden md:block" aria-hidden>
          <FlowLines reduce={!!reduce} />
        </div>

        {/* Mobile rail (calc → reports) */}
        <div className="md:hidden flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
          <span className="text-[10px] font-mono tracking-[0.16em] uppercase text-gray-500 dark:text-gray-400">
            {t.flowLabel}
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        </div>

        {/* ─── 4 destination cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 md:-mt-2">
          {cardsMeta.map((card, idx) => {
            const tone = accent[card.accent];
            const rows = cardRows[card.key];
            return (
              <motion.div
                key={card.key}
                custom={idx + 1}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
                className={`group relative rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${tone.hoverGlow}`}
              >
                {/* Accent top bar */}
                <div className={`absolute inset-x-0 top-0 h-[3px] ${tone.bar}`} />

                <div className="p-4 md:p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="min-w-0">
                      <p className="text-[13px] md:text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">
                        {card.title}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {card.sub}
                      </p>
                    </div>
                    <div className={`shrink-0 ${tone.iconText}`}>
                      {card.icon}
                    </div>
                  </div>

                  {/* Account / metric rows */}
                  <ul className="space-y-1.5">
                    {rows.map((row) => (
                      <li
                        key={`${card.key}-${row.code}-${row.label}`}
                        className="flex items-center justify-between gap-2 text-[11px] md:text-[12px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`shrink-0 font-mono tabular-nums tracking-tight px-1.5 py-px rounded ${
                              row.emphasis ? tone.chip : 'text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/60 ring-1 ring-inset ring-gray-200/60 dark:ring-gray-700/60'
                            }`}
                          >
                            {row.code}
                          </span>
                          <span
                            className={`truncate ${
                              row.emphasis
                                ? `font-semibold ${tone.emphasisText}`
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {row.label}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────

function LedgerRow({
  side,
  code,
  name,
  amount,
  muted,
}: {
  side: 'Dr' | 'Cr';
  code: string;
  name: string;
  amount: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`font-semibold tracking-tight ${
            side === 'Dr'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {side}
        </span>
        <span className="text-gray-400 dark:text-gray-600 tabular-nums">{code}</span>
        <span className={`truncate ${muted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
          {name}
        </span>
      </div>
      <span className="tabular-nums text-gray-700 dark:text-gray-300 shrink-0">
        {amount}
      </span>
    </div>
  );
}

function FlowLines({ reduce }: { reduce: boolean }) {
  // 4 endpoints horizontally distributed (matches the lg:grid-cols-4 layout)
  // viewBox: 0..1000 wide, 0..160 tall
  // Source: top center (500, 0). Targets: bottoms at y=160.
  // Card centers at x = 125, 375, 625, 875 (quarters of 1000)
  const lines: Array<{ x: number; color: string; delay: number }> = [
    { x: 125, color: 'rgb(20 184 166)', delay: 0 },
    { x: 375, color: 'rgb(245 158 11)', delay: 0.25 },
    { x: 625, color: 'rgb(59 130 246)', delay: 0.5 },
    { x: 875, color: 'rgb(99 102 241)', delay: 0.75 },
  ];

  return (
    <svg
      viewBox="0 0 1000 160"
      preserveAspectRatio="none"
      className="w-full h-20 md:h-24"
    >
      {lines.map((ln, i) => {
        // Cubic curve from (500, 0) downward, easing out toward target x at y=160
        const d = `M 500 0 C 500 80, ${ln.x} 80, ${ln.x} 160`;
        return (
          <g key={i}>
            {/* Faint static rail */}
            <path
              d={d}
              fill="none"
              stroke={ln.color}
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeLinecap="round"
            />
            {/* Animated dashed flow */}
            <path
              d={d}
              fill="none"
              stroke={ln.color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 6"
              style={
                reduce
                  ? undefined
                  : {
                      animation: `axion-ssot-flow 2.4s linear infinite`,
                      animationDelay: `${ln.delay}s`,
                    }
              }
            />
            {/* Arrival pulse */}
            {!reduce && (
              <circle cx={ln.x} cy={160} r="3" fill={ln.color}>
                <animate
                  attributeName="opacity"
                  values="0;1;0"
                  keyTimes="0;0.5;1"
                  dur="2.4s"
                  begin={`${ln.delay + 1.2}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="2;5;2"
                  keyTimes="0;0.5;1"
                  dur="2.4s"
                  begin={`${ln.delay + 1.2}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Single connector: Engine → Calculation card ──────────────────

function FlowLineSingle() {
  // Vertical connector: faint static rail + traveling dot (like the reference screenshot).
  // Uses pure SMIL — no CSS animation dependency.
  return (
    <svg viewBox="0 0 20 56" className="block mx-auto h-14 w-5">
      {/* Static faint rail */}
      <line
        x1="10" y1="0"
        x2="10" y2="56"
        stroke="rgb(99 102 241)"
        strokeOpacity="0.25"
        strokeWidth="1"
      />

      {/* Traveling dots — 3 dots staggered 0.33s apart */}
      {[0, 0.33, 0.66].map((delay) => (
        <circle key={delay} cx="10" cy="0" r="2" fill="rgb(99 102 241)">
          <animate
            attributeName="cy"
            from="4" to="52"
            dur="1s"
            begin={`${delay}s`}
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;1"
            keySplines="0.4 0 0.6 1"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.08;0.88;1"
            dur="1s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="1;2;2;1"
            keyTimes="0;0.08;0.88;1"
            dur="1s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* Static dot at the bottom arrival point */}
      <circle cx="10" cy="52" r="2" fill="rgb(99 102 241)" opacity="0.3" />
    </svg>
  );
}

// ─── Icons (minimal, 16px) ──────────────────────────────────────────

function IconTypescript() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
      <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
    </svg>
  );
}



function IconTrendingUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </svg>
  );
}

function IconScale() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 3v18" />
      <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
      <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M7 21h10" />
    </svg>
  );
}

function IconWaves() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  );
}

function IconGauge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 14l4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      <circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─── Source badge ────────────────────────────────────────────────────

function SourceBadge({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 rounded-md px-2.5 py-1">
      <span className={color}>{icon}</span>
      {label}
    </span>
  );
}

function IconShopee() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
      <path d="M15.9414 17.9633c.229-1.879-.981-3.077-4.1758-4.0969-1.548-.528-2.277-1.22-2.26-2.1719.065-1.056 1.048-1.825 2.352-1.85a5.2898 5.2898 0 0 1 2.8838.89c.116.072.197.06.263-.039.09-.145.315-.494.39-.62.051-.081.061-.187-.068-.281-.185-.1369-.704-.4149-.983-.5319a6.4697 6.4697 0 0 0-2.5118-.514c-1.909.008-3.4129 1.215-3.5389 2.826-.082 1.1629.494 2.1078 1.73 2.8278.262.152 1.6799.716 2.2438.892 1.774.552 2.695 1.5419 2.478 2.6969-.197 1.047-1.299 1.7239-2.818 1.7439-1.2039-.046-2.2878-.537-3.1278-1.19l-.141-.11c-.104-.08-.218-.075-.287.03-.05.077-.376.547-.458.67-.077.108-.035.168.045.234.35.293.817.613 1.134.775a6.7097 6.7097 0 0 0 2.8289.727 4.9048 4.9048 0 0 0 2.0759-.354c1.095-.465 1.8029-1.394 1.9449-2.554zM11.9986 1.4009c-2.068 0-3.7539 1.95-3.8329 4.3899h7.6657c-.08-2.44-1.765-4.3899-3.8328-4.3899zm7.8516 22.5981-.08.001-15.7843-.002c-1.074-.04-1.863-.91-1.971-1.991l-.01-.195L1.298 6.2858a.459.459 0 0 1 .45-.494h4.9748C6.8448 2.568 9.1607 0 11.9996 0c2.8388 0 5.1537 2.5689 5.2757 5.7898h4.9678a.459.459 0 0 1 .458.483l-.773 15.5883-.007.131c-.094 1.094-.979 1.9769-2.0709 2.0059z" />
    </svg>
  );
}

function IconTelegram() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function IconOCR() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 8h8" />
      <path d="M7 12h8" />
      <path d="M7 16h4" />
    </svg>
  );
}
