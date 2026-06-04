'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X } from 'lucide-react';
import { AIChatPanel } from './AIChatPanel';

interface AIChatFABProps {
  businessId: string;
  businessName: string;
}

export function AIChatFAB({ businessId, businessName }: AIChatFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AIChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        businessId={businessId}
        businessName={businessName}
      />

      {/* FAB Button */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-5 right-4 z-50 w-14 h-14 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
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
