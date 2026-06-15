"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Globe,
  Building2,
  UserCheck,
  MessageSquare,
  Shield,
} from "lucide-react";

import { FEATURES } from "@/lib/constants";

const iconMap: Record<string, React.ElementType> = {
  FileText,
  Globe,
  Building2,
  UserCheck,
  MessageSquare,
  Shield,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function Features() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-40" />

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
            <span className="text-gradient">Enterprise-Grade</span> Verification
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">
            Six powerful AI agents work simultaneously to investigate every aspect of an
            opportunity&apos;s legitimacy.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
        >
          {FEATURES.map((feature) => {
            const Icon = iconMap[feature.icon] || Shield;

            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                whileHover={{ y: -4 }}
                className="group relative"
              >
                <div className="relative h-full p-6 md:p-7 rounded-2xl bg-[#111118] border border-[#1e293b] transition-all duration-300 group-hover:border-[#6366f1]/40 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.1),0_8px_24px_rgba(0,0,0,0.3)]">
                  {/* Icon */}
                  <div className="mb-5 inline-flex p-3 rounded-xl gradient-primary-subtle group-hover:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-shadow duration-300">
                    <Icon className="w-6 h-6 text-[#818cf8] group-hover:text-[#a5b4fc] transition-colors duration-300" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-[#f1f5f9] mb-2.5 group-hover:text-white transition-colors duration-200">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#94a3b8] leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Corner accent */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#6366f1]/[0.03] to-transparent rounded-tr-2xl rounded-bl-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
