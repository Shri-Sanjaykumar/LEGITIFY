"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { STATS } from "@/lib/constants";

function StatCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const startTime = performance.now();
          const isDecimal = value % 1 !== 0;

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic
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
  }, [value, hasAnimated]);

  const formatDisplay = (num: number): string => {
    if (num >= 1000) {
      return num >= 10000
        ? `${Math.floor(num / 1000)}K`
        : `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div ref={ref} className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#f1f5f9]">
      {formatDisplay(count)}
      <span className="text-gradient">{suffix}</span>
    </div>
  );
}

export default function Stats() {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden">
      {/* Gradient Mesh Background */}
      <div className="absolute inset-0 gradient-mesh" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#06060b] via-transparent to-[#06060b] pointer-events-none" />

      {/* Subtle top/bottom lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6366f1]/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6366f1]/20 to-transparent" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4"
        >
          {STATS.map((stat, index) => (
            <div key={stat.label} className="relative text-center">
              <StatCounter value={stat.value} suffix={stat.suffix} />
              <p className="mt-2 text-sm md:text-base text-[#64748b] font-medium">
                {stat.label}
              </p>

              {/* Divider — desktop only, between items */}
              {index < STATS.length - 1 && (
                <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-16 bg-gradient-to-b from-transparent via-[#1e293b] to-transparent" />
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
