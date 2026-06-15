"use client";

import { useRef, useState } from "react";
import { motion, useAnimationFrame } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { TESTIMONIALS } from "@/lib/constants";

const duplicatedTestimonials = [...TESTIMONIALS, ...TESTIMONIALS];

const avatarGradients = [
  "from-[#6366f1] to-[#06b6d4]",
  "from-[#8b5cf6] to-[#6366f1]",
  "from-[#06b6d4] to-[#10b981]",
  "from-[#f59e0b] to-[#ef4444]",
  "from-[#6366f1] to-[#06b6d4]",
  "from-[#8b5cf6] to-[#6366f1]",
  "from-[#06b6d4] to-[#10b981]",
  "from-[#f59e0b] to-[#ef4444]",
];

export default function Testimonials() {
  const [isPaused, setIsPaused] = useState(false);
  const xRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useAnimationFrame((_, delta) => {
    if (isPaused) return;
    const speed = 0.03;
    xRef.current -= speed * delta;

    // Each card is approximately 380px + 24px gap = 404px
    const cardWidth = 404;
    const totalWidth = cardWidth * TESTIMONIALS.length;

    if (Math.abs(xRef.current) >= totalWidth) {
      xRef.current += totalWidth;
    }

    if (containerRef.current) {
      containerRef.current.style.transform = `translateX(${xRef.current}px)`;
    }
  });

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh opacity-40" />

      <div className="relative">
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 md:mb-16 px-4"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Trusted by <span className="text-gradient">Students Nationwide</span>
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">
            Join thousands of students and institutions who trust LEGITIFY to protect them from fraud.
          </p>
        </motion.div>

        {/* Marquee Container */}
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-r from-[#06060b] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-l from-[#06060b] to-transparent z-10 pointer-events-none" />

          <div className="overflow-hidden">
            <div
              ref={containerRef}
              className="flex gap-6 will-change-transform"
              style={{ width: "max-content" }}
            >
              {duplicatedTestimonials.map((testimonial, index) => (
                <div
                  key={`${testimonial.id}-${index}`}
                  className="w-[340px] md:w-[380px] flex-shrink-0"
                >
                  <div className="h-full p-6 rounded-2xl bg-[#111118]/80 backdrop-blur-sm border border-white/[0.06] hover:border-[#6366f1]/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.08)]">
                    {/* Stars */}
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-[#f59e0b] text-[#f59e0b]"
                        />
                      ))}
                    </div>

                    {/* Quote */}
                    <p className="text-[#94a3b8] text-sm leading-relaxed mb-6">
                      &ldquo;{testimonial.content}&rdquo;
                    </p>

                    {/* Author */}
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center flex-shrink-0",
                          avatarGradients[index % avatarGradients.length]
                        )}
                      >
                        <span className="text-xs font-bold text-white">
                          {testimonial.avatar}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#f1f5f9]">
                          {testimonial.name}
                        </p>
                        <p className="text-xs text-[#64748b]">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
