'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download, Share2, Flag, RefreshCw, Check } from 'lucide-react';

export default function ReportActions() {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => setIsDownloading(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 w-full justify-start py-4 border-t border-[var(--border-primary)]">
      {/* Download PDF button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleDownload}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all cursor-pointer select-none"
        disabled={isDownloading}
      >
        <Download className="w-4 h-4" />
        {isDownloading ? 'Downloading...' : 'Download PDF Report'}
      </motion.button>

      {/* Share Report button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleShare}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer select-none"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-500" />
            Copied Link!
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4 text-[var(--text-secondary)]" />
            Share Report
          </>
        )}
      </motion.button>

      {/* Scan Another button */}
      <Link href="/scan" passHref legacyBehavior>
        <motion.a
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer select-none"
        >
          <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
          Scan Another
        </motion.a>
      </Link>

      {/* Report False Positive button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/5 transition-all ml-auto md:ml-0 cursor-pointer select-none"
      >
        <Flag className="w-4 h-4" />
        Report False Positive
      </motion.button>
    </div>
  );
}
