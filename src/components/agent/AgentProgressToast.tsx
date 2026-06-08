'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, CheckCircle, XCircle, Loader2, Sparkles } from 'lucide-react';

export interface AgentStep {
  id: string;
  type: 'thinking' | 'progress' | 'result' | 'error';
  message: string;
  current?: number;
  total?: number;
  timestamp: number;
}

interface AgentProgressToastProps {
  steps: AgentStep[];
  isRunning: boolean;
  onDismiss?: () => void;
}

export function AgentProgressToast({ steps, isRunning, onDismiss }: AgentProgressToastProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (steps.length > 0) setVisible(true);
  }, [steps.length]);

  // Auto-scroll ke bawah saat langkah baru muncul
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  // Auto-dismiss setelah 8 detik jika selesai
  useEffect(() => {
    if (!isRunning && steps.length > 0 && onDismiss) {
      const t = setTimeout(onDismiss, 8000);
      return () => clearTimeout(t);
    }
  }, [isRunning, steps.length, onDismiss]);

  const lastStep = steps[steps.length - 1];
  const isError = lastStep?.type === 'error';
  const isDone = !isRunning && steps.length > 0;
  const progressStep = [...steps].reverse().find(s => s.type === 'progress' && s.total);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-24 right-4 z-[60] w-80 rounded-2xl shadow-2xl border overflow-hidden"
          style={{
            background: 'var(--toast-bg, white)',
            borderColor: isError
              ? 'rgb(252 165 165)'
              : isDone
              ? 'rgb(167 243 208)'
              : 'rgb(199 210 254)',
          }}
        >
          {/* Header */}
          <div
            className={`flex items-center gap-2.5 px-4 py-3 border-b ${
              isError
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : isDone
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800'
            }`}
          >
            {isRunning ? (
              <div className="relative flex-shrink-0">
                <Bot className="w-5 h-5 text-indigo-500" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-400 rounded-full animate-ping opacity-75" />
              </div>
            ) : isError ? (
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            )}
            <span
              className={`text-sm font-semibold ${
                isError
                  ? 'text-red-700 dark:text-red-300'
                  : isDone
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-indigo-700 dark:text-indigo-300'
              }`}
            >
              {isRunning ? 'AXION Agent bekerja...' : isError ? 'Agent gagal' : 'Agent selesai'}
            </span>
            {onDismiss && !isRunning && (
              <button
                onClick={() => { setVisible(false); setTimeout(onDismiss, 200); }}
                className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Progress bar */}
          {progressStep && progressStep.total && (
            <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Progres import</span>
                <span>{progressStep.current}/{progressStep.total}</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((progressStep.current ?? 0) / progressStep.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Steps log */}
          <div
            ref={scrollRef}
            className="max-h-48 overflow-y-auto bg-white dark:bg-gray-800 px-4 py-3 space-y-2"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2"
              >
                <span className="flex-shrink-0 mt-0.5">
                  {step.type === 'thinking' && (
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  {step.type === 'progress' && (
                    i === steps.length - 1 && isRunning
                      ? <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                      : <div className="w-3.5 h-3.5 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        </div>
                  )}
                  {step.type === 'result' && (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  {step.type === 'error' && (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </span>
                <span
                  className={`text-xs leading-relaxed ${
                    step.type === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : step.type === 'result'
                      ? 'text-emerald-700 dark:text-emerald-300 font-medium'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {step.message}
                </span>
              </motion.div>
            ))}

            {/* Typing indicator saat masih running */}
            {isRunning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 pt-1"
              >
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
