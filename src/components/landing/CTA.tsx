"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";


const floatingShields = [
  { top: "10%", left: "8%", size: 28, delay: 0, duration: 7 },
  { top: "20%", right: "12%", size: 22, delay: 1.5, duration: 9 },
  { bottom: "15%", left: "15%", size: 18, delay: 3, duration: 8 },
  { bottom: "25%", right: "8%", size: 32, delay: 0.5, duration: 10 },
  { top: "50%", left: "5%", size: 16, delay: 2, duration: 6 },
  { top: "40%", right: "5%", size: 20, delay: 4, duration: 11 },
];

export default function CTA() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/10 via-[#4f46e5]/5 to-[#8b5cf6]/10" />
      <div className="absolute inset-0 bg-[#06060b]/60" />

      {/* Blur blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6366f1]/8 rounded-full blur-[150px]" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#8b5cf6]/6 rounded-full blur-[130px]" />

      {/* Top/bottom border lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6366f1]/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6366f1]/20 to-transparent" />

      {/* Floating Shield Icons */}
      {floatingShields.map((shield, i) => (
        <motion.div
          key={i}
          className="absolute text-[#6366f1]/[0.08] pointer-events-none"
          style={{
            top: shield.top,
            left: shield.left,
            right: shield.right,
            bottom: shield.bottom,
          }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: shield.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: shield.delay,
          }}
        >
          <Shield
            className="text-[#6366f1]/20"
            style={{ width: shield.size, height: shield.size }}
          />
        </motion.div>
      ))}

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Shield icon */}
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#4f46e5] mb-8 shadow-[0_0_40px_rgba(99,102,241,0.25)]"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Shield className="w-8 h-8 text-white" />
          </motion.div>

          {/* Heading */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[#f1f5f9]">
            Ready to <span className="text-gradient">Verify?</span>
          </h2>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-[#94a3b8] mb-10 max-w-xl mx-auto leading-relaxed">
            Start protecting yourself from fraudulent opportunities today.
          </p>

          {/* CTA Button */}
          <Link
            href="/scan"
            className="group relative inline-flex items-center gap-3 px-10 py-4 text-lg font-semibold text-white bg-gradient-to-r from-[#6366f1] to-[#4f46e5] rounded-xl transition-all duration-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.4),0_8px_24px_rgba(99,102,241,0.3)] hover:-translate-y-[2px] active:translate-y-0"
          >
            <span>Start Your First Scan</span>
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </Link>

          {/* Sub-text */}
          <p className="mt-6 text-sm text-[#64748b]">
            No sign up required • Free forever for personal use
          </p>
        </motion.div>
      </div>
    </section>
  );
}
