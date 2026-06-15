'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileSearch,
  ScanSearch,
  Globe,
  Building2,
  MessageSquare,
  FileCheck,
  Check,
  Sparkles,
} from 'lucide-react';

interface ScanProgressProps {
  isScanning: boolean;
  currentStep: number;
}

const SCAN_STEPS = [
  { label: 'Uploading', icon: Upload },
  { label: 'Extracting Text', icon: FileSearch },
  { label: 'Analyzing Document', icon: ScanSearch },
  { label: 'Checking Domain', icon: Globe },
  { label: 'Verifying Company', icon: Building2 },
  { label: 'Checking Reputation', icon: MessageSquare },
  { label: 'Generating Report', icon: FileCheck },
];

function ConfettiBurst() {
  interface Particle {
    id: number;
    x: number;
    y: number;
    rotate: number;
    scale: number;
    color: string;
    delay: number;
  }

  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setParticles(
        Array.from({ length: 24 }, (_, i) => ({
          id: i,
          x: (Math.random() - 0.5) * 300,
          y: (Math.random() - 0.5) * 300,
          rotate: Math.random() * 720 - 360,
          scale: Math.random() * 0.5 + 0.5,
          color: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#818cf8', '#22d3ee'][
            Math.floor(Math.random() * 6)
          ],
          delay: Math.random() * 0.3,
        }))
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: p.scale,
            rotate: p.rotate,
            opacity: 0,
          }}
          transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut' }}
          className="absolute rounded-sm"
          style={{
            width: 8,
            height: 8,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

export default function ScanProgress({ isScanning, currentStep }: ScanProgressProps) {
  if (!isScanning) return null;

  const allComplete = currentStep >= SCAN_STEPS.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(6, 6, 11, 0.9)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md p-8 rounded-2xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <AnimatePresence>
          {allComplete && <ConfettiBurst />}
        </AnimatePresence>

        <div className="text-center mb-8">
          <motion.h2
            className="text-xl font-bold mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {allComplete ? 'Report Ready!' : 'Investigating...'}
          </motion.h2>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {allComplete
              ? 'Your trust report has been generated'
              : 'AI agents are verifying your content'}
          </p>
        </div>

        <div className="space-y-0">
          {SCAN_STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep && !allComplete;
            const isPending = index > currentStep;
            const StepIcon = step.icon;

            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="flex items-start gap-4"
              >
                {/* Vertical line + dot column */}
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={
                      isActive
                        ? {
                            boxShadow: [
                              '0 0 0px rgba(99, 102, 241, 0.3)',
                              '0 0 16px rgba(99, 102, 241, 0.6)',
                              '0 0 0px rgba(99, 102, 241, 0.3)',
                            ],
                          }
                        : {}
                    }
                    transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
                    style={{
                      background: isCompleted
                        ? 'rgba(16, 185, 129, 0.15)'
                        : isActive
                        ? 'rgba(99, 102, 241, 0.15)'
                        : 'var(--bg-elevated)',
                      border: `2px solid ${
                        isCompleted ? '#10b981' : isActive ? '#6366f1' : 'var(--border-primary)'
                      }`,
                    }}
                  >
                    {isCompleted ? (
                      <Check size={16} style={{ color: '#10b981' }} />
                    ) : (
                      <StepIcon
                        size={16}
                        style={{
                          color: isActive ? '#6366f1' : 'var(--text-muted)',
                        }}
                      />
                    )}
                  </motion.div>

                  {index < SCAN_STEPS.length - 1 && (
                    <div
                      className="w-0.5 h-6"
                      style={{
                        background: isCompleted
                          ? 'rgba(16, 185, 129, 0.3)'
                          : 'var(--border-primary)',
                      }}
                    />
                  )}
                </div>

                {/* Label */}
                <div className="pt-2 pb-4">
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: isCompleted
                        ? '#10b981'
                        : isActive
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {step.label}
                    {isActive && (
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="ml-1"
                      >
                        ...
                      </motion.span>
                    )}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {allComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-center"
            >
              <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: '#10b981' }}>
                <Sparkles size={16} />
                Redirecting to your report...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
