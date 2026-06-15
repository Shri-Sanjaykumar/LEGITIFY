'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Paperclip, ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function QuickScan() {
  const [inputValue, setInputValue] = useState('');
  const hasContent = inputValue.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-primary)]">
        <Zap className="w-4 h-4 text-[var(--accent)]" />
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Quick Scan
        </h3>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Input Area */}
        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Paste URL, email, or text to scan..."
            rows={3}
            className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[rgba(99,102,241,0.2)] transition-all duration-200 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* File Upload Button */}
          <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] hover:bg-[var(--bg-elevated)] transition-all duration-200">
            <Paperclip className="w-4 h-4" />
            <span className="text-sm font-medium">Attach</span>
          </button>

          {/* Scan Button */}
          <motion.button
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300',
              hasContent
                ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed'
            )}
            style={
              hasContent
                ? {
                    boxShadow:
                      '0 0 20px rgba(99, 102, 241, 0.3), 0 4px 12px rgba(99, 102, 241, 0.2)',
                  }
                : undefined
            }
            whileHover={hasContent ? { scale: 1.02, y: -1 } : undefined}
            whileTap={hasContent ? { scale: 0.98 } : undefined}
            disabled={!hasContent}
          >
            Scan Now
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Supported Types */}
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Supported: PDF, DOCX, URLs, LinkedIn, Email
        </p>
      </div>
    </motion.div>
  );
}
