"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATS } from "@/lib/constants";

function AnimatedCounter({
  value,
  suffix = "",
  duration = 2,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const startTime = performance.now();
          const isDecimal = value % 1 !== 0;

          const animate = (currentTime: number) => {
            const elapsed = (currentTime - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * value;

            setCount(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current));

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [value, duration, hasAnimated]);

  const displayValue =
    count >= 1000
      ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`
      : count.toString();

  return (
    <span ref={ref}>
      {displayValue}
      {suffix}
    </span>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-hero">
      {/* Floating Orbs */}
      <motion.div
        className="absolute top-1/4 left-[15%] w-72 h-72 rounded-full bg-[#6366f1]/10 blur-[100px]"
        animate={{
          y: [0, -30, 0],
          x: [0, 15, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-[10%] w-96 h-96 rounded-full bg-[#06b6d4]/8 blur-[120px]"
        animate={{
          y: [0, 25, 0],
          x: [0, -20, 0],
          scale: [1, 0.9, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-purple-500/6 blur-[80px]"
        animate={{
          y: [0, 20, 0],
          x: [0, -10, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Grid Background */}
      <div className="absolute inset-0 grid-bg opacity-50" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          {/* Badge */}
          <motion.div variants={itemVariants}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/[0.08] backdrop-blur-sm mb-8 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <span className="text-base">🛡️</span>
              <span className="text-sm font-medium text-[#818cf8]">
                AI-Powered Trust Verification
              </span>
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
          >
            <span className="text-[#f1f5f9]">Verify Before</span>
            <br />
            <span className="text-gradient">You Trust</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="max-w-2xl text-lg md:text-xl text-[#94a3b8] leading-relaxed mb-10"
          >
            AI-powered trust intelligence platform that verifies internships, jobs, recruiters,
            companies, and offer letters before you make decisions.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center gap-4 mb-16"
          >
            <Link
              href="/scan"
              className="group relative inline-flex items-center gap-2.5 px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-[#6366f1] to-[#4f46e5] rounded-xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.35),0_8px_20px_rgba(99,102,241,0.25)] hover:-translate-y-[2px] active:translate-y-0"
            >
              <span>Start Free Scan</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </Link>

            <button className="group inline-flex items-center gap-2.5 px-8 py-3.5 text-base font-medium text-[#f1f5f9] border border-[#334155] rounded-xl transition-all duration-300 hover:border-[#6366f1]/50 hover:bg-white/[0.03]">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-[#6366f1]/20 transition-colors duration-300">
                <Play className="w-3 h-3 fill-current" />
              </div>
              <span>Watch Demo</span>
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 w-full max-w-3xl"
          >
            {STATS.map((stat, index) => (
              <div key={stat.label} className="relative text-center group">
                <div className="text-2xl md:text-3xl font-bold text-[#f1f5f9] mb-1">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs md:text-sm text-[#64748b] font-medium">
                  {stat.label}
                </div>
                {/* Divider */}
                {index < STATS.length - 1 && (
                  <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-10 bg-gradient-to-b from-transparent via-[#1e293b] to-transparent" />
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#06060b] to-transparent pointer-events-none" />
    </section>
  );
}
