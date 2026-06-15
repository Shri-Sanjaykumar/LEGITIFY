'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  AlertTriangle,
  Cpu,
  ChevronDown,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockActivityFeed } from '@/lib/mock-data';
import { getRelativeTime } from '@/lib/utils';


const typeConfigs = {
  scan: {
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    dotColor: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]',
    icon: Search,
  },
  report: {
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    dotColor: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]',
    icon: FileText,
  },
  alert: {
    color: 'text-red-500 bg-red-500/10 border-red-500/20',
    dotColor: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    icon: AlertTriangle,
  },
  system: {
    color: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    dotColor: 'bg-gray-400 shadow-[0_0_8px_rgba(156,163,175,0.6)]',
    icon: Cpu,
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
};

export default function ActivityFeed() {
  const [visibleItems, setVisibleItems] = useState(4);
  const activities = mockActivityFeed;

  const handleLoadMore = () => {
    setVisibleItems((prev) => Math.min(prev + 3, activities.length));
  };

  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-primary)] shrink-0">
        <Activity className="w-4 h-4 text-[var(--primary)]" />
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Activity Feed
        </h3>
      </div>

      {/* Timeline Content */}
      <div className="p-5 flex-1 overflow-y-auto max-h-[380px] scrollbar-thin">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative pl-6 border-l border-[var(--border-primary)] space-y-6"
        >
          <AnimatePresence initial={false}>
            {activities.slice(0, visibleItems).map((item) => {
              const config = typeConfigs[item.type] || typeConfigs.system;
              const Icon = config.icon;

              return (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  className="relative group"
                >
                  {/* Timeline Dot */}
                  <div
                    className={cn(
                      "absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border border-black",
                      config.dotColor
                    )}
                  />

                  {/* Activity Details Card */}
                  <div className="flex gap-3">
                    <div className={cn("p-1.5 h-fit rounded-lg border", config.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {getRelativeTime(item.timestamp)}
                      </p>
                      <h4 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--primary-light)] transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Load More Button */}
        {visibleItems < activities.length && (
          <button
            onClick={handleLoadMore}
            className="w-full mt-5 py-2 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all duration-200"
          >
            Load More <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
