'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot } from 'lucide-react';
import { AIChatPanel } from './AIChatPanel';

interface AIChatFABProps {
  businessId: string;
  businessName: string;
  /** Buka modal Quick Entry (form transaksi terstruktur) — dipakai tombol mobile di tab Entry. */
  onQuickAdd?: () => void;
}

export function AIChatFAB({ businessId, businessName, onQuickAdd }: AIChatFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AIChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        businessId={businessId}
        businessName={businessName}
        onQuickAdd={onQuickAdd ? () => { setIsOpen(false); onQuickAdd(); } : undefined}
      />

      {/* FAB Button */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-5 right-4 z-50 w-14 h-14 rounded-full text-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        style={{
          background: 'radial-gradient(circle at 30% 25%, #a5b4fc 0%, #6366f1 45%, #3730a3 100%)',
          boxShadow: '0 6px 28px 0 rgba(99,102,241,0.65), 0 2px 6px 0 rgba(67,56,202,0.4), inset 0 2px 4px rgba(255,255,255,0.32), inset 0 -2px 4px rgba(0,0,0,0.18)',
        }}
        aria-label={isOpen ? 'Tutup AI Chat' : 'Buka AI Chat'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Bot className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
