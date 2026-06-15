"use client";

import { motion } from "framer-motion";
import { Upload, Brain, FileCheck } from "lucide-react";

import { HOW_IT_WORKS_STEPS } from "@/lib/constants";

const iconMap: Record<string, React.ElementType> = {
  Upload,
  Brain,
  FileCheck,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function HowItWorks() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh opacity-60" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 md:mb-20"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            How <span className="text-gradient">LEGITIFY</span> Works
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">
            Three simple steps to protect yourself from fraudulent opportunities
          </p>
        </motion.div>

        {/* Steps Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-8"
        >
          {/* Connecting Line — Desktop */}
          <div className="hidden md:block absolute top-[72px] left-[20%] right-[20%] h-[2px]">
            <div className="w-full h-full bg-gradient-to-r from-[#6366f1]/40 via-[#06b6d4]/40 to-[#6366f1]/40 rounded-full" />
            <div className="absolute top-1/2 left-[48%] -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#06b6d4] shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
          </div>

          {/* Connecting Line — Mobile */}
          <div className="md:hidden absolute left-[36px] top-[100px] bottom-[100px] w-[2px]">
            <div className="w-full h-full bg-gradient-to-b from-[#6366f1]/40 via-[#06b6d4]/40 to-[#6366f1]/40 rounded-full" />
          </div>

          {HOW_IT_WORKS_STEPS.map((step) => {
            const Icon = iconMap[step.icon] || Upload;

            return (
              <motion.div
                key={step.step}
                variants={cardVariants}
                className="relative group"
              >
                <div className="relative glass rounded-2xl p-8 transition-all duration-300 hover:border-[#6366f1]/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] h-full">
                  {/* Step Number Badge */}
                  <div className="relative mb-6 flex items-start gap-4">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#06b6d4] flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)] group-hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-shadow duration-300">
                      <span className="text-white font-bold text-lg">
                        {step.step}
                      </span>
                    </div>
                    <div className="mt-1 p-3 rounded-xl gradient-primary-subtle">
                      <Icon className="w-6 h-6 text-[#818cf8]" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-[#f1f5f9] mb-3">
                    {step.title}
                  </h3>
                  <p className="text-[#94a3b8] text-sm leading-relaxed">
                    {step.description}
                  </p>

                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#6366f1]/[0.02] to-[#06b6d4]/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
