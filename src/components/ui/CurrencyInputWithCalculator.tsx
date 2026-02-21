'use client';

import { useState, useRef, useEffect } from 'react';
import { Calculator, Delete, X, Layers } from 'lucide-react';

// ─── helpers ───────────────────────────────────────────────────────────────

function formatNumberWithSeparator(num: number | string): string {
  if (!num && num !== 0) return '';
  const numStr = num.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseFormattedNumber(str: string): number {
  const cleaned = str.replace(/\./g, '');
  return parseInt(cleaned) || 0;
}

// ─── types ─────────────────────────────────────────────────────────────────

export interface CalcMultiplicationInfo {
  operandA: number;
  operandB: number;
}

interface CurrencyInputWithCalculatorProps {
  value: number;
  displayValue: string;
  onChange: (numericValue: number, displayValue: string) => void;
  onMultiplicationResult?: (info: CalcMultiplicationInfo) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  colorVariant?: 'default' | 'green' | 'red' | 'amber' | 'purple';
}

type CalcOp = '+' | '-' | '×' | '÷' | null;

function evalCalc(a: number, op: CalcOp, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : 0;
    default: return b;
  }
}

// ─── component ─────────────────────────────────────────────────────────────

export function CurrencyInputWithCalculator({
  value,
  displayValue,
  onChange,
  onMultiplicationResult,
  className = '',
  inputClassName = '',
  placeholder = '0',
  autoFocus = false,
  error,
  label,
  required = false,
  colorVariant = 'default',
}: CurrencyInputWithCalculatorProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<CalcOp>(null);
  const [calcWaiting, setCalcWaiting] = useState(false);
  // Stores last multiplication operands after = is pressed
  const [lastMultiply, setLastMultiply] = useState<CalcMultiplicationInfo | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync calc display when toggled open
  useEffect(() => {
    if (showCalc) {
      setCalcDisplay(displayValue || '0');
      setCalcPrev(null);
      setCalcOp(null);
      setCalcWaiting(false);
      setLastMultiply(null);
    }
  }, [showCalc]);

  // Close on outside click
  useEffect(() => {
    if (!showCalc) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowCalc(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalc]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numeric = parseFormattedNumber(e.target.value);
    const formatted = formatNumberWithSeparator(numeric);
    onChange(numeric, formatted);
  };

  const borderColorClass =
    colorVariant === 'green' ? 'border-emerald-500 dark:border-emerald-400 focus:ring-emerald-500'
    : colorVariant === 'red' ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
    : colorVariant === 'amber' ? 'border-amber-500 dark:border-amber-400 focus:ring-amber-500'
    : colorVariant === 'purple' ? 'border-purple-500 dark:border-purple-400 focus:ring-purple-500'
    : '';

  // ── Calc actions ──

  const calcNum = () => parseFormattedNumber(calcDisplay);

  const pressDigit = (d: string) => {
    // Reset breakdown suggestion when user continues typing
    setLastMultiply(null);
    if (calcWaiting) {
      setCalcDisplay(d);
      setCalcWaiting(false);
      return;
    }
    const raw = calcDisplay.replace(/\./g, '');
    if (raw === '0') {
      setCalcDisplay(formatNumberWithSeparator(d) || d);
    } else {
      setCalcDisplay(formatNumberWithSeparator(raw + d));
    }
  };

  const pressOperator = (op: CalcOp) => {
    setLastMultiply(null);
    const current = calcNum();
    if (calcOp && !calcWaiting && calcPrev !== null) {
      const result = Math.round(evalCalc(calcPrev, calcOp, current));
      setCalcDisplay(formatNumberWithSeparator(result) || '0');
      setCalcPrev(result);
    } else {
      setCalcPrev(current);
    }
    setCalcOp(op);
    setCalcWaiting(true);
  };

  const pressEquals = () => {
    if (calcOp === null || calcPrev === null) return;
    const current = calcNum();
    const op = calcOp;
    const prev = calcPrev;
    const result = Math.round(evalCalc(prev, op, current));
    const formatted = formatNumberWithSeparator(result) || '0';
    setCalcDisplay(formatted);
    setCalcPrev(null);
    setCalcOp(null);
    setCalcWaiting(false);
    onChange(result, formatted);

    // If multiplication, store operands so breakdown button can appear
    if (op === '×' && onMultiplicationResult) {
      setLastMultiply({ operandA: prev, operandB: current });
    } else {
      setLastMultiply(null);
    }
  };

  const pressClear = () => {
    setCalcDisplay('0');
    setCalcPrev(null);
    setCalcOp(null);
    setCalcWaiting(false);
    setLastMultiply(null);
  };

  const pressBackspace = () => {
    setLastMultiply(null);
    const raw = calcDisplay.replace(/\./g, '');
    if (raw.length <= 1) {
      setCalcDisplay('0');
    } else {
      setCalcDisplay(formatNumberWithSeparator(raw.slice(0, -1)));
    }
  };

  const useResult = () => {
    const num = calcNum();
    const formatted = formatNumberWithSeparator(num);
    onChange(num, formatted);
    setShowCalc(false);
  };

  const useResultWithBreakdown = () => {
    if (!lastMultiply || !onMultiplicationResult) return;
    const num = calcNum();
    const formatted = formatNumberWithSeparator(num);
    onChange(num, formatted);
    onMultiplicationResult(lastMultiply);
    setShowCalc(false);
  };

  // ── Render ──

  const btnBase = 'h-11 rounded-lg text-sm font-semibold transition-colors select-none active:scale-95';
  const btnDigit = `${btnBase} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600`;
  const btnOp = (active: boolean) => active
    ? `${btnBase} bg-indigo-500 text-white`
    : `${btnBase} bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50`;
  const btnAction = `${btnBase} bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500`;

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="label text-base font-semibold">
          {label} {required && '*'}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          className={`input pr-12 ${borderColorClass} ${inputClassName}`}
          placeholder={placeholder}
          inputMode="numeric"
          autoFocus={autoFocus}
        />
        <button
          type="button"
          onClick={() => setShowCalc(!showCalc)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${showCalc ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'}`}
          tabIndex={-1}
          title="Kalkulator"
        >
          <Calculator className="w-5 h-5" />
        </button>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{error}</p>}

      {/* Calculator panel */}
      {showCalc && (
        <div className="absolute left-0 right-0 z-50 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <Calculator className="w-3.5 h-3.5" />
              Kalkulator
            </span>
            <button
              type="button"
              onClick={() => setShowCalc(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Display */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
            <div className="text-xs text-right text-gray-400 dark:text-gray-500 h-4">
              {calcPrev !== null && calcOp ? `${formatNumberWithSeparator(calcPrev)} ${calcOp}` : '\u00A0'}
            </div>
            <div className="text-right text-3xl font-bold text-gray-800 dark:text-gray-100 truncate">
              {calcDisplay}
            </div>
            {/* Breakdown hint */}
            {lastMultiply && (
              <div className="text-right text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                {formatNumberWithSeparator(lastMultiply.operandA)} × {formatNumberWithSeparator(lastMultiply.operandB)}
              </div>
            )}
          </div>

          {/* Buttons - explicit 4-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '10px' }}>
            {/* Row 1: C  ⌫  ÷  × */}
            <button type="button" onClick={pressClear} className={btnAction}>C</button>
            <button type="button" onClick={pressBackspace} className={btnAction}><Delete className="w-4 h-4 mx-auto" /></button>
            <button type="button" onClick={() => pressOperator('÷')} className={btnOp(calcOp === '÷')}>÷</button>
            <button type="button" onClick={() => pressOperator('×')} className={btnOp(calcOp === '×')}>×</button>

            {/* Row 2: 7  8  9  - */}
            <button type="button" onClick={() => pressDigit('7')} className={btnDigit}>7</button>
            <button type="button" onClick={() => pressDigit('8')} className={btnDigit}>8</button>
            <button type="button" onClick={() => pressDigit('9')} className={btnDigit}>9</button>
            <button type="button" onClick={() => pressOperator('-')} className={btnOp(calcOp === '-')}>−</button>

            {/* Row 3: 4  5  6  + */}
            <button type="button" onClick={() => pressDigit('4')} className={btnDigit}>4</button>
            <button type="button" onClick={() => pressDigit('5')} className={btnDigit}>5</button>
            <button type="button" onClick={() => pressDigit('6')} className={btnDigit}>6</button>
            <button type="button" onClick={() => pressOperator('+')} className={btnOp(calcOp === '+')}>+</button>

            {/* Row 4: 1  2  3  = (spans 2 rows) */}
            <button type="button" onClick={() => pressDigit('1')} className={btnDigit}>1</button>
            <button type="button" onClick={() => pressDigit('2')} className={btnDigit}>2</button>
            <button type="button" onClick={() => pressDigit('3')} className={btnDigit}>3</button>
            <button type="button" onClick={pressEquals} style={{ gridRow: 'span 2' }} className={`${btnBase} bg-indigo-500 hover:bg-indigo-600 text-white text-lg`}>=</button>

            {/* Row 5: 000  0 */}
            <button type="button" onClick={() => { pressDigit('0'); pressDigit('0'); pressDigit('0'); }} style={{ gridColumn: 'span 2' }} className={btnDigit}>000</button>
            <button type="button" onClick={() => pressDigit('0')} className={btnDigit}>0</button>
          </div>

          {/* Action buttons */}
          <div className="px-2.5 pb-2.5 flex flex-col gap-2">
            {/* Breakdown button — only shown after multiplication = */}
            {lastMultiply && onMultiplicationResult && (
              <button
                type="button"
                onClick={useResultWithBreakdown}
                className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Layers className="w-4 h-4" />
                Gunakan & Breakdown Unit
              </button>
            )}
            <button
              type="button"
              onClick={useResult}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
            >
              Gunakan Hasil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
