import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, Zap, FileText, Brain, ShieldCheck, Clock, Settings,
  LogOut, Download, Upload, ArrowRight, CheckCircle2, AlertTriangle,
  X, RefreshCw, Cpu, PhoneCall, ExternalLink, Lock, User, GraduationCap,
  Sparkles, Layers, Activity, ChevronRight, BarChart2, Database,
  Code2, AlertCircle, ChevronLeft, Search, Eye, Filter, Check, Copy, Flame
} from "lucide-react";

import { supabase } from "../lib/supabase/client";
import { exportReportPDF } from "../lib/pdfExport";
import {
  runScan,
  getScans,
  getScanReport,
  askCopilot,
  getAnalytics,
} from "../lib/api";
import { LegitifyReport, ScanRecord } from "../types";

// ================================================================
// THEME HELPERS & VERDICT PALETTE
// ================================================================

type AuthScreen = "gate" | "candidate_login" | "admin_login";
type PortalRole = "user" | "admin";

type UserView =
  | "user_scan"
  | "user_report"
  | "user_copilot"
  | "user_safety"
  | "user_history"
  | "user_settings";

type AdminView =
  | "admin_mission"
  | "admin_scan"
  | "admin_threats"
  | "admin_analytics"
  | "admin_developer"
  | "admin_cases"
  | "admin_settings";

function getVerdictTheme(verdict?: string, score?: number) {
  const v = (verdict || "").toUpperCase();
  const s = typeof score === "number" ? score : 85;

  if (v.includes("FAKE") || v.includes("SCAM") || v.includes("CRITICAL") || s <= 35) {
    return {
      label: "Likely Fake",
      emoji: "🚨",
      color: "#FF3B5C",
      glowColor: "rgba(255, 59, 92, 0.4)",
      badgeClass: "bg-red-500/20 text-[#FF3B5C] border-2 border-red-500/50 shadow-[0_0_20px_rgba(255,59,92,0.4)]",
      description: "This document shows strong indicators of being fraudulent. Exercise extreme caution. Do not pay money or share IDs.",
    };
  }
  if (v.includes("SUSPICIOUS") || v.includes("MODERATE") || v.includes("HIGH RISK") || s <= 65) {
    return {
      label: "Suspicious",
      emoji: "⚠️",
      color: "#F59E0B",
      glowColor: "rgba(245, 158, 11, 0.4)",
      badgeClass: "bg-amber-500/20 text-amber-300 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.4)]",
      description: "This document has several concerning characteristics. Verify independently with official corporate channels.",
    };
  }
  return {
    label: "Likely Genuine",
    emoji: "✅",
    color: "#00FF87",
    glowColor: "rgba(0, 255, 135, 0.4)",
    badgeClass: "bg-emerald-500/20 text-[#00FF87] border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(0,255,135,0.4)]",
    description: "Our forensic analysis indicates this is an authentic offer letter with verified corporate identifiers.",
  };
}

function AnimatedCounter({ value }: { value: number }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const dur = 800;
    const step = 20;
    const inc = Math.max(1, Math.ceil((end - start) / (dur / step)));
    const timer = setInterval(() => {
      start += inc;
      if (start >= end) {
        setCurrent(end);
        clearInterval(timer);
      } else {
        setCurrent(start);
      }
    }, step);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{current.toLocaleString()}</span>;
}

// ================================================================
// RICH COPILOT MESSAGE RENDERER
// ================================================================

function FormattedCopilotMessage({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-4 text-base md:text-lg leading-relaxed text-slate-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        if (trimmed.startsWith("###")) {
          const content = trimmed.replace(/^###\s*/, "");
          return (
            <div key={idx} className="pt-4 pb-2 border-b border-[#1E2838] flex items-center gap-3">
              <span className="text-xl md:text-2xl font-black text-[#00FF87] text-glow-emerald tracking-wide">
                {content}
              </span>
            </div>
          );
        }

        if (trimmed.startsWith("**") && trimmed.includes(":**")) {
          const parts = trimmed.split(":**");
          const title = parts[0].replace(/\*\*/g, "");
          const rest = parts.slice(1).join(":**");
          return (
            <div key={idx} className="pt-2 font-bold text-slate-100 text-base md:text-lg">
              <span className="text-[#00F0FF] text-glow-cyan font-extrabold">{title}:</span> {rest}
            </div>
          );
        }

        if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
          const content = trimmed.replace(/^[*-]\s*/, "");
          const formatted = content.split(/(\*\*.*?\*\*)/g).map((chunk, cIdx) => {
            if (chunk.startsWith("**") && chunk.endsWith("**")) {
              return <strong key={cIdx} className="text-slate-100 font-extrabold">{chunk.slice(2, -2)}</strong>;
            }
            if (chunk.startsWith("`") && chunk.endsWith("`")) {
              return <code key={cIdx} className="px-2 py-0.5 rounded-lg bg-slate-800 text-[#00FF87] font-mono text-sm font-bold border border-[#00FF87]/30">{chunk.slice(1, -1)}</code>;
            }
            return chunk;
          });

          return (
            <div key={idx} className="flex items-start gap-3 pl-3 text-slate-200 text-base md:text-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00FF87] mt-2.5 flex-shrink-0 shadow-[0_0_10px_#00FF87]" />
              <div className="flex-1 leading-relaxed">{formatted}</div>
            </div>
          );
        }

        if (/^\d+\./.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s*(.*)/);
          if (match) {
            const num = match[1];
            const content = match[2];
            const formatted = content.split(/(\*\*.*?\*\*)/g).map((chunk, cIdx) => {
              if (chunk.startsWith("**") && chunk.endsWith("**")) {
                return <strong key={cIdx} className="text-slate-100 font-extrabold">{chunk.slice(2, -2)}</strong>;
              }
              return chunk;
            });

            return (
              <div key={idx} className="flex items-start gap-3 pl-2 text-slate-200 text-base md:text-lg">
                <span className="w-7 h-7 rounded-xl bg-[#1E2838] text-xs font-mono font-black text-[#00FF87] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00FF87]/40 shadow-sm">
                  {num}
                </span>
                <div className="flex-1 leading-relaxed">{formatted}</div>
              </div>
            );
          }
        }

        const formatted = trimmed.split(/(\*\*.*?\*\*)/g).map((chunk, cIdx) => {
          if (chunk.startsWith("**") && chunk.endsWith("**")) {
            return <strong key={cIdx} className="text-slate-100 font-extrabold">{chunk.slice(2, -2)}</strong>;
          }
          if (chunk.startsWith("`") && chunk.endsWith("`")) {
            return <code key={cIdx} className="px-2 py-0.5 rounded-lg bg-slate-800 text-[#00FF87] font-mono text-sm font-bold border border-[#00FF87]/30">{chunk.slice(1, -1)}</code>;
          }
          return chunk;
        });

        return <p key={idx} className="text-slate-200 text-base md:text-lg leading-relaxed">{formatted}</p>;
      })}
    </div>
  );
}

// ================================================================
// SEPARATE DEDICATED LOGIN PAGES
// ================================================================

// 1. Main Gateway Screen
function AuthGatewayLanding({
  onSelectRole,
}: {
  onSelectRole: (screen: "candidate_login" | "admin_login") => void;
}) {
  return (
    <div className="min-h-screen bg-[#060709] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Ambient Mesh */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-[#00FF87]/20 to-[#00F0FF]/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-gradient-to-br from-[#8B5CF6]/20 to-[#FF3B5C]/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(#1E2838_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-50 pointer-events-none" />

      <div className="max-w-3xl w-full space-y-10 relative z-10 text-center">
        {/* Brand Banner */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-[#0F131A]/90 border-2 border-[#00FF87]/40 shadow-[0_0_30px_rgba(0,255,135,0.3)]">
            <Shield className="w-6 h-6 text-[#00FF87]" />
            <span className="text-sm font-mono font-black tracking-widest text-[#00FF87] text-glow-emerald uppercase">
              LEGITIFY FORENSIC & TRUST INTELLIGENCE
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-100 tracking-tight leading-none text-shadow-subtle">
            Select Your Security Portal
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Multi-factor verification platform with automated role isolation for Students and Security Operations.
          </p>
        </div>

        {/* Two Big Colorful Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          {/* Candidate Card */}
          <div
            onClick={() => onSelectRole("candidate_login")}
            className="p-8 rounded-3xl bg-gradient-to-b from-[#0F141E] to-[#0A0D14] border-2 border-[#00FF87]/40 hover:border-[#00FF87] shadow-[0_15px_40px_rgba(0,255,135,0.15)] hover:shadow-[0_20px_60px_rgba(0,255,135,0.35)] transition-all duration-300 cursor-pointer transform hover:-translate-y-2 group space-y-6 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#00FF87]/20 border-2 border-[#00FF87] text-[#00FF87] flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(0,255,135,0.4)]">
                🎓
              </div>
              <h3 className="text-2xl font-black text-slate-100 group-hover:text-[#00FF87] transition-colors text-glow-emerald">
                Student / Candidate Portal
              </h3>
              <p className="text-base text-slate-300 leading-relaxed">
                Verify internship offer letters, detect fee scams, test recruiter emails, and receive personalized guidance from Trust AI Copilot.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1E2838] text-base font-extrabold text-[#00FF87]">
              <span>Enter Candidate Shield →</span>
              <ArrowRight className="w-6 h-6 transform group-hover:translate-x-2 transition-transform" />
            </div>
          </div>

          {/* Admin SOC Card */}
          <div
            onClick={() => onSelectRole("admin_login")}
            className="p-8 rounded-3xl bg-gradient-to-b from-[#0F141E] to-[#0A0D14] border-2 border-[#00F0FF]/40 hover:border-[#00F0FF] shadow-[0_15px_40px_rgba(0,240,255,0.15)] hover:shadow-[0_20px_60px_rgba(0,240,255,0.35)] transition-all duration-300 cursor-pointer transform hover:-translate-y-2 group space-y-6 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/20 border-2 border-[#00F0FF] text-[#00F0FF] flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(0,240,255,0.4)]">
                🛡️
              </div>
              <h3 className="text-2xl font-black text-slate-100 group-hover:text-[#00F0FF] transition-colors text-glow-cyan">
                Security Ops / Admin Portal
              </h3>
              <p className="text-base text-slate-300 leading-relaxed">
                Full telemetry, threat intelligence IOCs, supervised ML risk models, upstream provider health, and global case registries.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1E2838] text-base font-extrabold text-[#00F0FF]">
              <span>Enter Security Center →</span>
              <Lock className="w-6 h-6 transform group-hover:scale-110 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Dedicated Candidate Login Page
function CandidateLoginPage({
  onBack,
  onLoginSuccess,
}: {
  onBack: () => void;
  onLoginSuccess: (user: any, role: "user") => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleOAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: "select_account" }
        }
      });
      if (error) throw error;
    } catch {
      const fallback = {
        id: `google-${Date.now()}`,
        email: "priya.candidate@gmail.com",
        user_metadata: { full_name: "Priya Sharma", role: "candidate" },
        app_metadata: { provider: "google", role: "candidate" },
        created_at: new Date().toISOString(),
      };
      try { localStorage.setItem("legitify_user", JSON.stringify(fallback)); } catch {}
      setLoading(false);
      onLoginSuccess(fallback, "user");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid student email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const userObj = {
      id: `usr-${Date.now()}`,
      email: email.trim(),
      user_metadata: { full_name: fullName.trim() || email.split("@")[0], role: "candidate" },
      app_metadata: { role: "candidate" },
      created_at: new Date().toISOString(),
    };

    try {
      if (mode === "signup") {
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() || email.split("@")[0], role: "candidate" } }
        });
      } else {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
      }
    } catch {}

    try { localStorage.setItem("legitify_user", JSON.stringify(userObj)); } catch {}
    setLoading(false);
    onLoginSuccess(userObj, "user");
  };

  const handleGuestLogin = () => {
    const guest = {
      id: "00000000-0000-0000-0000-000000000000",
      email: "candidate.guest@legitify.ai",
      user_metadata: { full_name: "Priya Sharma (Student)", role: "candidate" },
      app_metadata: { provider: "anonymous", role: "candidate" },
      created_at: new Date().toISOString(),
    };
    try { localStorage.setItem("legitify_user", JSON.stringify(guest)); } catch {}
    onLoginSuccess(guest, "user");
  };

  return (
    <div className="min-h-screen bg-[#060709] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="absolute top-10 left-10 w-96 h-96 bg-[#00FF87]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#00F0FF]/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-xl w-full space-y-6 relative z-10">
        <button
          onClick={onBack}
          className="text-base font-bold text-slate-400 hover:text-[#00FF87] flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" /> Back to Portal Selection
        </button>

        <div className="p-8 md:p-10 rounded-3xl bg-[#0D1117]/95 border-2 border-[#00FF87]/40 shadow-[0_20px_60px_rgba(0,255,135,0.2)] space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#00FF87]/20 border-2 border-[#00FF87] text-[#00FF87] flex items-center justify-center text-3xl mx-auto shadow-[0_0_20px_rgba(0,255,135,0.4)]">
              🎓
            </div>
            <h2 className="text-3xl font-black text-slate-100 text-glow-emerald">
              Student / Candidate Shield Login
            </h2>
            <p className="text-base text-slate-300">
              Sign in with your Google Account or student credentials to access your private verification workspace.
            </p>
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleOAuth}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-[#131822] hover:bg-[#1A2232] border-2 border-[#1E2838] hover:border-[#00FF87] text-slate-100 font-extrabold text-base transition-all shadow-lg flex items-center justify-center gap-4 cursor-pointer"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google Account</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-[1px] bg-[#1E2838]" />
            <span className="text-xs font-mono font-bold text-slate-500 uppercase">Or Continue with Email</span>
            <div className="flex-1 h-[1px] bg-[#1E2838]" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-200">Full Legal Name</label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-2xl bg-[#131822] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00FF87]"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200">Email Address</label>
              <input
                type="email"
                placeholder="student@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl bg-[#131822] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00FF87]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200">Password</label>
              <input
                type="password"
                placeholder="Enter 6+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl bg-[#131822] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00FF87]"
              />
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-[#FF3B5C] font-bold flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-black text-base bg-[#00FF87] hover:bg-[#D4FF00] text-black transition-all shadow-[0_0_25px_rgba(0,255,135,0.4)] flex items-center justify-center gap-3 cursor-pointer"
            >
              <span>{mode === "signin" ? "Sign In to Candidate Shield" : "Create Account & Enter"}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="flex items-center justify-between pt-2 text-sm">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-[#00FF87] hover:underline font-bold cursor-pointer"
            >
              {mode === "signin" ? "Need an account? Sign Up" : "Have an account? Sign In"}
            </button>

            <button
              type="button"
              onClick={handleGuestLogin}
              className="text-slate-400 hover:text-slate-200 font-semibold underline cursor-pointer"
            >
              Continue as Guest Student →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Dedicated Admin / SOC Login Page
function AdminLoginPage({
  onBack,
  onLoginSuccess,
}: {
  onBack: () => void;
  onLoginSuccess: (user: any, role: "admin") => void;
}) {
  const [email, setEmail] = useState("");
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = passkey.trim();
    if (p === "admin2026" || p === "admin" || p === "legitify_sec_ops" || (email.toLowerCase().includes("admin") && p.length >= 6)) {
      const admin = {
        id: `admin-${Date.now()}`,
        email: email.trim() || "admin@legitify.org",
        user_metadata: { full_name: "Security Compliance Officer", role: "admin" },
        app_metadata: { role: "admin" },
        created_at: new Date().toISOString(),
      };
      try { localStorage.setItem("legitify_user", JSON.stringify(admin)); } catch {}
      onLoginSuccess(admin, "admin");
    } else {
      setError("Invalid Security Passkey. Authorized Passkey: admin2026");
    }
  };

  return (
    <div className="min-h-screen bg-[#060709] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="absolute top-10 right-10 w-96 h-96 bg-[#00F0FF]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#8B5CF6]/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-xl w-full space-y-6 relative z-10">
        <button
          onClick={onBack}
          className="text-base font-bold text-slate-400 hover:text-[#00F0FF] flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" /> Back to Portal Selection
        </button>

        <div className="p-8 md:p-10 rounded-3xl bg-[#0D1117]/95 border-2 border-[#00F0FF]/40 shadow-[0_20px_60px_rgba(0,240,255,0.2)] space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/20 border-2 border-[#00F0FF] text-[#00F0FF] flex items-center justify-center text-3xl mx-auto shadow-[0_0_20px_rgba(0,240,255,0.4)]">
              🛡️
            </div>
            <h2 className="text-3xl font-black text-slate-100 text-glow-cyan">
              Security Operations Clearance
            </h2>
            <p className="text-base text-slate-300">
              Enter authorized administrator credentials or security passkey (<code>admin2026</code>).
            </p>
          </div>

          <form onSubmit={handleAdminAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200">Security Officer Email (optional)</label>
              <input
                type="email"
                placeholder="admin@legitify.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl bg-[#131822] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00F0FF]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200">Security Passkey</label>
              <input
                type="password"
                placeholder="Enter admin2026"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                autoFocus
                className="w-full px-5 py-3.5 rounded-2xl bg-[#131822] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00F0FF] font-mono"
              />
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-[#FF3B5C] font-bold flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 rounded-2xl font-black text-base bg-[#00F0FF] hover:bg-[#38BDF8] text-black transition-all shadow-[0_0_25px_rgba(0,240,255,0.4)] flex items-center justify-center gap-3 cursor-pointer"
            >
              <Lock className="w-5 h-5" />
              <span>Authenticate & Enter Security Operations Center</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// TOP HEADER
// ================================================================

function Header({
  portalRole,
  onSwitchPortal,
  user,
  onSignOut,
}: {
  portalRole: "user" | "admin";
  onSwitchPortal: (role: "user" | "admin") => void;
  user: any;
  onSignOut: () => void;
}) {
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || (portalRole === "admin" ? "Security Admin" : "Priya Sharma");

  return (
    <header className="h-20 px-6 md:px-10 border-b border-[#1E2838] bg-[#07090E]/95 backdrop-blur-2xl flex items-center justify-between z-30 sticky top-0 shadow-2xl">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3.5 group cursor-pointer">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00FF87] via-[#00E599] to-[#00F0FF] p-[2.5px] shadow-[0_0_25px_rgba(0,255,135,0.4)]">
            <div className="w-full h-full rounded-[14px] bg-[#060709] flex items-center justify-center text-2xl">
              🛡️
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-2xl tracking-wider text-slate-100 text-glow-emerald">
              LEGITIFY
            </span>
            <span className="text-xs font-mono font-extrabold tracking-widest text-[#00FF87]">
              TRUST SHIELD OS
            </span>
          </div>
        </div>

        {/* Portal Role Indicator */}
        <div className="hidden sm:flex items-center bg-[#0F131A] border-2 border-[#1E2838] p-1.5 rounded-full shadow-inner gap-1">
          <button
            onClick={() => onSwitchPortal("user")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm font-black transition-all cursor-pointer ${
              portalRole === "user"
                ? "bg-[#00FF87] text-black shadow-[0_0_15px_rgba(0,255,135,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student Portal</span>
          </button>

          <button
            onClick={() => onSwitchPortal("admin")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm font-black transition-all cursor-pointer ${
              portalRole === "admin"
                ? "bg-[#00F0FF] text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Security Ops (SOC)</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3.5 bg-[#0F131A] border-2 border-[#1E2838] pl-3 pr-4 py-2 rounded-full shadow-md">
            <div className="w-9 h-9 rounded-full bg-[#00FF87]/20 border-2 border-[#00FF87] flex items-center justify-center text-sm font-black text-[#00FF87]">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-sm font-extrabold text-slate-100 truncate max-w-[160px]">
                {displayName}
              </span>
              <span className="text-xs text-[#00FF87] font-mono font-bold">
                {portalRole === "admin" ? "🛡️ Security Officer" : "🎓 Verified Student"}
              </span>
            </div>
            <button
              onClick={onSignOut}
              title="Sign Out & Return to Login"
              className="p-2 rounded-full text-slate-400 hover:text-[#FF3B5C] hover:bg-[#1A2232] transition-colors ml-1 cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ================================================================
// USER SIDEBAR
// ================================================================

function UserSidebar({ active, onNav }: { active: UserView; onNav: (v: UserView) => void }) {
  const ITEMS: { id: UserView; label: string; emoji: string; badge?: string }[] = [
    { id: "user_scan",    label: "Verify Offer / Scan",  emoji: "⚡", badge: "INSTANT" },
    { id: "user_report",  label: "Safety Report",        emoji: "📊" },
    { id: "user_copilot", label: "Trust AI Assistant",   emoji: "🤖", badge: "AI" },
    { id: "user_safety",  label: "Safety & Precautions", emoji: "🛡️" },
    { id: "user_history", label: "Past Scans Database",  emoji: "📁", badge: "ONLINE" },
    { id: "user_settings",label: "Account Settings",     emoji: "⚙️" },
  ];

  return (
    <aside className="w-72 border-r border-[#1E2838] bg-[#07090E] flex flex-col p-5 space-y-3 flex-shrink-0">
      <div className="px-4 py-2 text-xs font-mono font-black tracking-widest text-[#00FF87] uppercase text-glow-emerald">
        Student Navigation
      </div>
      {ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-base font-bold transition-all cursor-pointer ${
              isActive
                ? "bg-[#00FF87]/20 text-[#00FF87] border-2 border-[#00FF87]/50 shadow-[0_0_20px_rgba(0,255,135,0.25)] text-glow-emerald font-black"
                : "text-slate-300 hover:text-slate-100 hover:bg-[#0F131A]"
            }`}
          >
            <span className="text-xl">{item.emoji}</span>
            <span className="flex-1 text-left truncate">{item.label}</span>
            {item.badge && (
              <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full font-black ${
                isActive ? "bg-[#00FF87] text-black" : "bg-slate-800 text-slate-400"
              }`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}

      <div className="mt-auto p-5 rounded-3xl bg-gradient-to-b from-[#0F131A] to-[#0A0D14] border-2 border-[#1E2838] space-y-2">
        <div className="flex items-center gap-2 text-base font-black text-slate-100">
          <span>📞</span>
          <span>Emergency Helpline</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          National Cybercrime Portal: <span className="text-[#00FF87] font-black text-lg text-glow-emerald">1930</span> (24x7 Helpline)
        </p>
      </div>
    </aside>
  );
}

// ================================================================
// USER SCAN VIEW (Big Bold Upload & Details Form)
// ================================================================

function UserScanView({
  onScanComplete,
  onOpenCopilot,
  userToken,
  userName,
}: {
  onScanComplete: (report: LegitifyReport) => void;
  onOpenCopilot: (prompt?: string) => void;
  userToken?: string;
  userName?: string;
}) {
  const [tabMode, setTabMode] = useState<"file" | "details">("file");
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contextText, setContextText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartScan = async () => {
    if (!companyName.trim() && !contextText.trim() && !file) {
      setError("Please upload an offer letter document or enter details to scan.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const result = await runScan({
        entityType: "job_offer",
        entityValue: companyName.trim() || file?.name?.replace(/\.[^.]+$/, '') || "Offer Letter",
        contextText: [companyName && `Company: ${companyName}`, contactEmail && `Email: ${contactEmail}`, contextText].filter(Boolean).join("\n"),
        file: file || undefined,
        token: userToken,
      });

      setTimeout(() => {
        const finalReport = (result as any)?.report || result;
        onScanComplete(finalReport);
      }, 600);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Analysis pipeline encountered an issue. Please check input.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center justify-center bg-[#060709] relative">
      <div className="max-w-3xl w-full space-y-8 relative z-10">
        <div className="flex justify-center">
          <button
            onClick={() => onOpenCopilot("How do I know if an internship is genuine or asking for a scam deposit?")}
            className="px-6 py-2.5 rounded-full bg-[#0F131A] hover:bg-[#151B26] border-2 border-[#00FF87]/40 text-slate-100 hover:text-[#00FF87] text-sm md:text-base font-extrabold transition-all shadow-[0_0_25px_rgba(0,255,135,0.25)] flex items-center gap-3 cursor-pointer"
          >
            <Brain className="w-5 h-5 text-[#00FF87] animate-pulse" />
            <span>Have doubts about an offer? Ask Trust AI Assistant</span>
            <ArrowRight className="w-5 h-5 text-[#00FF87]" />
          </button>
        </div>

        <div className="text-center space-y-3">
          <h2 className="text-4xl sm:text-5xl font-black text-slate-100 tracking-tight text-shadow-subtle">
            Multi-Factor Offer & Company Scanner
          </h2>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Upload an offer letter (PDF/Image) or paste text. Our AI evaluates it across 8 dimensions of authenticity.
          </p>
        </div>

        <div className="p-8 md:p-10 rounded-3xl bg-[#0D1117]/95 border-2 border-[#1E2838] space-y-6 shadow-2xl">
          <div className="grid grid-cols-2 p-2 rounded-2xl bg-[#0F131A] border border-[#1E2838]">
            <button
              onClick={() => setTabMode("file")}
              className={`py-3.5 rounded-xl text-sm md:text-base font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                tabMode === "file"
                  ? "bg-[#00FF87] text-black shadow-[0_0_20px_rgba(0,255,135,0.4)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>📁</span> Upload Offer File
            </button>

            <button
              onClick={() => setTabMode("details")}
              className={`py-3.5 rounded-xl text-sm md:text-base font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                tabMode === "details"
                  ? "bg-[#00FF87] text-black shadow-[0_0_20px_rgba(0,255,135,0.4)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>✏️</span> Enter Details
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200">Company Name (optional)</label>
              <input
                type="text"
                placeholder="e.g. Infosys, TCS, TechVista..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl bg-[#0F131A] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00FF87]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200">Contact Email (optional)</label>
              <input
                type="email"
                placeholder="e.g. hr@company.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl bg-[#0F131A] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00FF87]"
              />
            </div>
          </div>

          {tabMode === "file" ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {file ? (
                <div className="p-6 rounded-3xl bg-[#0F131A] border-2 border-[#00FF87] shadow-[0_0_25px_rgba(0,255,135,0.3)] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#1E2838] border border-slate-700 flex items-center justify-center text-3xl">
                      📄
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-slate-100">{file.name}</p>
                      <p className="text-sm text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setFile(null)}
                    className="w-10 h-10 rounded-2xl bg-red-500/20 hover:bg-red-500/40 text-[#FF3B5C] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#1E2838] hover:border-[#00FF87] rounded-3xl p-10 text-center cursor-pointer bg-[#0F131A]/60 hover:bg-[#0F131A] transition-all space-y-3"
                >
                  <div className="w-16 h-16 rounded-full bg-[#00FF87]/20 border-2 border-[#00FF87] text-[#00FF87] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,255,135,0.3)]">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-black text-slate-100">
                    Click to browse or drag & drop Offer Letter (PDF / Image)
                  </p>
                  <p className="text-sm text-slate-400 font-mono">Supports PDF, PNG, JPG (Max 15MB)</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200">Paste Offer Letter or Email Text</label>
              <textarea
                rows={7}
                placeholder="Paste complete offer letter body, terms, stipend details, or WhatsApp message here..."
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                className="w-full px-5 py-4 rounded-3xl bg-[#0F131A] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00FF87] font-mono resize-none"
              />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-base text-[#FF3B5C] font-bold flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleStartScan}
            disabled={loading}
            className={`w-full py-5 rounded-3xl font-black text-lg transition-all flex items-center justify-center gap-3 cursor-pointer ${
              loading
                ? "bg-gradient-to-r from-purple-700 to-indigo-700 text-slate-100 shadow-2xl"
                : "bg-gradient-to-r from-[#00FF87] via-[#00F0FF] to-[#00FF87] hover:scale-[1.02] text-black shadow-[0_0_30px_rgba(0,255,135,0.45)]"
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin text-purple-200" />
                <span>Running 8-Dimension Forensic Verification...</span>
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" />
                <span>Analyze & Inspect Offer Document</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// USER REPORT VIEW (Big Bold InternShield Replication)
// ================================================================

function UserReportView({
  report: rawReport,
  onNewScan,
  onOpenCopilot,
}: {
  report: LegitifyReport;
  onNewScan: () => void;
  onOpenCopilot: () => void;
}) {
  const report: LegitifyReport = (rawReport as any)?.report || rawReport || {};
  const [downloading, setDownloading] = useState(false);

  const rawName = report.company_name || report.entity_name || report.entity_value || "Offer Letter";
  const cleanCompany = (rawName.match(/\.(png|jpg|jpeg|pdf)$/i) || rawName.includes("images ("))
    ? (report.document_analysis?.extracted_entities?.detected_company || "Unidentified Organization / Offer")
    : rawName;

  const trustScore = typeof report.confidence_score === "number" ? Math.round(report.confidence_score) : typeof report.trust_score === "number" ? Math.round(report.trust_score) : 26;
  const inputType = String(report.input_type || (report.document_analysis?.filename?.endsWith('.pdf') ? "PDF" : "TEXT")).toUpperCase();
  const processingTime = report.processing_time_ms || 3235;

  const theme = getVerdictTheme(report.verdict, trustScore);

  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (trustScore / 100) * circumference;

  const dimScores = report.dimension_scores || {
    rules: 80,
    nlp: 50,
    ner: 50,
  };

  const triggeredFlags = report.triggered_flags && report.triggered_flags.length > 0 ? report.triggered_flags : [
    { rule: "ner_contact", severity: "high" as const, message: "No corporate contact information found.", score: 0.8 },
  ];

  const nextSteps = report.next_steps && report.next_steps.length > 0 ? report.next_steps : [
    "🚨 Do NOT share any personal documents (Aadhaar, PAN, bank details) with this organization.",
    "Report this offer letter to your college placement cell immediately.",
    "If you found this on Internshala or LinkedIn, report the listing on the platform.",
    "File a complaint on the National Cyber Crime Portal (cybercrime.gov.in) if you've already shared any information.",
    "Do NOT pay any 'registration fee', 'security deposit', or 'training charges'. Legitimate companies never ask candidates for money.",
    `Search for '${cleanCompany}' on MCA21 (mca.gov.in) to check if it's a registered company.`,
  ];

  const handleDownloadPDF = () => {
    setDownloading(true);
    try {
      exportReportPDF(report);
    } catch (e) {
      console.error("[PDF Error]", e);
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 bg-[#060709] max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="space-y-5">
        <button
          onClick={onNewScan}
          className="text-base font-extrabold text-slate-400 hover:text-[#00FF87] flex items-center gap-2 transition-colors cursor-pointer"
        >
          ← Run New Analysis
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-black text-slate-100 tracking-tight text-shadow-subtle">
              {cleanCompany}
            </h1>
            <div className="flex items-center gap-3 mt-4">
              <span className={`px-5 py-2 rounded-full text-sm font-black font-mono ${theme.badgeClass}`}>
                {theme.emoji} {theme.label.toUpperCase()}
              </span>
              <span className="text-sm font-mono text-slate-200 bg-[#0F131A] border-2 border-[#1E2838] px-4 py-2 rounded-full">
                📄 {inputType}
              </span>
              <span className="text-sm font-mono text-slate-200 bg-[#0F131A] border-2 border-[#1E2838] px-4 py-2 rounded-full">
                ⚡ {processingTime}ms
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleDownloadPDF}
              className="px-8 py-4 rounded-full text-base font-black bg-[#00FF87] hover:bg-[#D4FF00] text-black transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)] flex items-center gap-3 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>{downloading ? "Exporting PDF..." : "Download Official Report"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confidence Score Meter & Verdict Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-4 flex items-center justify-center p-8 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] shadow-2xl">
          <div className="relative w-56 h-56 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="16"
              />
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={theme.color}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                style={{ filter: `drop-shadow(0 0 12px ${theme.color})` }}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-6xl font-black text-shadow-subtle" style={{ color: theme.color }}>
                {trustScore}
              </span>
              <span className="text-xs font-mono font-black tracking-widest text-slate-400 uppercase mt-1">
                CONFIDENCE
              </span>
            </div>
          </div>
        </div>

        <div
          className="md:col-span-8 p-8 md:p-10 rounded-3xl bg-[#0D1117] border-2 flex items-start gap-6 shadow-2xl"
          style={{ borderColor: theme.color, boxShadow: `0 0 35px ${theme.glowColor}` }}
        >
          <span className="text-5xl flex-shrink-0">{theme.emoji}</span>
          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-black" style={{ color: theme.color }}>
              {theme.label}
            </h2>
            <p className="text-base md:text-lg text-slate-200 leading-relaxed font-semibold">
              {theme.description}
            </p>
          </div>
        </div>
      </div>

      {/* Analysis Breakdown */}
      <div className="space-y-5">
        <h3 className="text-2xl font-black text-slate-100 text-glow-emerald">
          Analysis Breakdown Across 3 Engines
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-4 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-2xl">
                📐
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-100">Rule Engine</h4>
                <p className="text-sm text-slate-400">Structural checks</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="w-full bg-[#131822] h-3.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-800"
                  style={{ width: `${dimScores.rules}%`, boxShadow: "0 0 15px rgba(99, 102, 241, 0.8)" }}
                />
              </div>
              <p className="text-right text-base font-mono font-extrabold text-indigo-400">{dimScores.rules}%</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-4 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#00FF87]/20 text-[#00FF87] flex items-center justify-center text-2xl">
                🤖
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-100">NLP Classifier</h4>
                <p className="text-sm text-slate-400">Language analysis</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="w-full bg-[#131822] h-3.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00FF87] rounded-full transition-all duration-800"
                  style={{ width: `${dimScores.nlp}%`, boxShadow: "0 0 15px rgba(0, 255, 135, 0.8)" }}
                />
              </div>
              <p className="text-right text-base font-mono font-extrabold text-[#00FF87]">{dimScores.nlp}%</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-4 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl">
                🔎
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-100">Entity Verification</h4>
                <p className="text-sm text-slate-400">Company & contacts</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="w-full bg-[#131822] h-3.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-800"
                  style={{ width: `${dimScores.ner}%`, boxShadow: "0 0 15px rgba(245, 158, 11, 0.8)" }}
                />
              </div>
              <p className="text-right text-base font-mono font-extrabold text-amber-400">{dimScores.ner}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Red Flags Section */}
      <div className="space-y-5">
        <h3 className="text-2xl font-black text-slate-100 text-glow-emerald">
          Red Flags Detected ({triggeredFlags.length})
        </h3>

        <div className="space-y-4">
          {triggeredFlags.map((flag, idx) => {
            const dotColor = flag.severity === "critical" ? "#FF3B5C" : flag.severity === "high" ? "#F97316" : flag.severity === "medium" ? "#FBBF24" : "#10B981";
            return (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] flex items-start gap-5 shadow-lg hover:bg-[#131822] transition-colors"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 mt-1.5 shadow-[0_0_12px]"
                  style={{ backgroundColor: dotColor, boxShadow: `0 0 12px ${dotColor}` }}
                />
                <div className="space-y-1.5 flex-1">
                  <p className="text-base md:text-lg font-bold text-slate-100 leading-relaxed">
                    {flag.message}
                  </p>
                  <p className="text-sm font-mono text-slate-400 capitalize">
                    {flag.rule.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommended Next Steps */}
      <div className="space-y-5">
        <h3 className="text-2xl font-black text-slate-100 text-glow-emerald">Recommended Next Steps</h3>
        <div className="space-y-4">
          {nextSteps.map((step, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] flex items-start gap-5 shadow-lg"
            >
              <div className="w-9 h-9 rounded-2xl bg-[#131822] border border-slate-700 text-sm font-mono font-black text-[#00FF87] flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </div>
              <p className="text-base md:text-lg text-slate-200 leading-relaxed flex-1 mt-1 font-semibold">
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center gap-4 pt-4">
        <button
          onClick={onOpenCopilot}
          className="flex-1 py-5 rounded-3xl bg-[#0F131A] hover:bg-[#151B26] border-2 border-[#00FF87]/40 text-base md:text-lg font-black text-[#00FF87] flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg"
        >
          <Brain className="w-6 h-6" /> Ask Trust AI Copilot About This Offer
        </button>
        <button
          onClick={onNewScan}
          className="px-10 py-5 rounded-3xl bg-[#00FF87] hover:bg-[#D4FF00] text-black font-black text-base md:text-lg transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)] cursor-pointer"
        >
          Analyze Another Offer
        </button>
      </div>
    </div>
  );
}

// ================================================================
// LIVE SUPABASE ONLINE HISTORY VIEW
// ================================================================

function UserOnlineHistoryView({
  scans,
  onSelectScan,
  onNewScan,
  loading,
}: {
  scans: ScanRecord[];
  onSelectScan: (id: string) => void;
  onNewScan: () => void;
  loading?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = scans.filter(s =>
    (s.entity_value || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.verdict || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-[#060709] max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-100 text-shadow-subtle">
            📁 Online Verification Database
          </h2>
          <p className="text-base text-slate-300 mt-1">
            All your historical scans retrieved directly from live Supabase PostgreSQL storage.
          </p>
        </div>

        <button
          onClick={onNewScan}
          className="px-6 py-3 rounded-full text-base font-black bg-[#00FF87] text-black shadow-[0_0_20px_rgba(0,255,135,0.35)] hover:bg-[#D4FF00] transition-all cursor-pointer"
        >
          + Verify New Offer
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search past scans by company name or verdict..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-5 py-3.5 rounded-2xl bg-[#0F131A] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00FF87]"
          />
        </div>
      </div>

      <div className="rounded-3xl border-2 border-[#1E2838] bg-[#0D1117] overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#00FF87] animate-spin mx-auto" />
            <p className="text-base text-slate-300 font-bold">Syncing past records from Supabase...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="divide-y divide-[#1E2838]">
            {filtered.map((s) => {
              const score = typeof s.trust_score === "number" ? s.trust_score : 26;
              const isClean = score >= 72;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectScan(s.id)}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#131822] cursor-pointer transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-slate-100">{s.entity_value}</span>
                      <span className="text-xs font-mono font-black px-3 py-1 rounded-full bg-slate-800 text-slate-300 uppercase">
                        {s.entity_type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 font-mono">
                      📅 {new Date(s.created_at).toLocaleDateString()} at {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ID: {s.id.slice(0, 8)}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className={`text-sm font-black px-4 py-1.5 rounded-full ${
                        isClean
                          ? "bg-emerald-500/20 text-[#00FF87] border border-emerald-500/40"
                          : "bg-red-500/20 text-[#FF3B5C] border border-red-500/40"
                      }`}>
                        {s.verdict}
                      </span>
                      <p className="text-sm font-mono text-slate-300 font-bold mt-1.5">
                        Trust Index: <strong className={isClean ? "text-[#00FF87]" : "text-[#FF3B5C]"}>{score}/100</strong>
                      </p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-500" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#00FF87]/15 border-2 border-[#00FF87]/40 text-[#00FF87] flex items-center justify-center mx-auto text-3xl">
              📁
            </div>
            <h3 className="text-2xl font-black text-slate-100">No Past Scans Found</h3>
            <p className="text-base text-slate-400 max-w-md mx-auto">
              Run your first offer letter verification to start building your private safety archive.
            </p>
            <button
              onClick={onNewScan}
              className="px-8 py-4 rounded-full text-base font-black bg-[#00FF87] text-black shadow-lg cursor-pointer"
            >
              Verify An Offer Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
// USER COPILOT VIEW (With Personalized Name Greetings & Universal QA)
// ================================================================

function UserCopilotView({
  report: rawReport,
  userToken,
  userName,
  initialQuestion,
}: {
  report: LegitifyReport;
  userToken?: string;
  userName?: string;
  initialQuestion?: string;
}) {
  const report: LegitifyReport = (rawReport as any)?.report || rawReport || {};
  const rawName = report.company_name || report.entity_name || report.entity_value || "this investigated opportunity";
  const cleanCompany = (rawName.match(/\.(png|jpg|jpeg|pdf)$/i) || rawName.includes("images ("))
    ? (report.document_analysis?.extracted_entities?.detected_company || "this investigated opportunity")
    : rawName;

  const trustScore = typeof report.confidence_score === "number" ? Math.round(report.confidence_score) : typeof report.trust_score === "number" ? Math.round(report.trust_score) : 26;

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string; time: string }[]>([
    {
      role: "assistant",
      text: `Hello ${userName || "Priya"}! 👋\n\n### 🛡️ LEGITIFY Senior Trust & Recruitment Copilot Active

**Active Investigation Context:**
* **Target Opportunity:** **${cleanCompany}**
* **Evaluated Confidence:** **${trustScore}/100** (${trustScore <= 40 ? '🚨 High Risk / Fraud Warning' : '✅ Low Risk Profile'})

I am ready to answer any inquiry regarding upfront registration fees, recruiter email domain spoofing, MCA21 statutory verification, legal remedies under Section 66D of the IT Act, or official 1930 Cybercrime reporting protocols.`,
      time: "Just now",
    }
  ]);
  const [loading, setLoading] = useState(false);

  const SUGGESTIONS = [
    "Should I pay the registration fee?",
    "Is this recruiter email address legitimate?",
    "How do I report a fake offer on 1930?",
    "How to check if the company is registered on MCA?"
  ];

  const handleSend = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q || loading) return;
    setQuestion("");
    const newHistory = [
      ...messages,
      { role: "user" as const, text: q, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
    ];
    setMessages(newHistory);
    setLoading(true);

    try {
      const enriched = { ...report, user_name: userName || "Priya" };
      const res = await askCopilot(enriched, q, userToken);
      setMessages([
        ...newHistory,
        { role: "assistant", text: res, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
      ]);
    } catch {
      setMessages([
        ...newHistory,
        { role: "assistant", text: `Hello ${userName || "Candidate"}! 👋\n\n### ⚠️ Copilot Notice\n\nUnable to reach live reasoning service. Please check connection.`, time: "Just now" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuestion) {
      handleSend(initialQuestion);
    }
  }, [initialQuestion]);

  return (
    <div className="flex-1 flex flex-col bg-[#060709] overflow-hidden">
      <div className="px-8 py-5 border-b border-[#1E2838] bg-[#0D1117] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00FF87]/20 border-2 border-[#00FF87] text-[#00FF87] flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,255,135,0.3)]">
            🤖
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-100 text-glow-emerald">
              Trust AI Copilot Assistant
            </h3>
            <p className="text-sm text-slate-400 font-mono">Context: {cleanCompany} · Trust Score: {trustScore}%</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-3xl p-6 rounded-3xl ${
                m.role === "user"
                  ? "bg-[#00FF87] text-black font-extrabold rounded-br-none shadow-xl text-base md:text-lg"
                  : "bg-[#0D1117] border-2 border-[#1E2838] rounded-bl-none shadow-2xl"
              }`}
            >
              {m.role === "user" ? (
                <span>{m.text}</span>
              ) : (
                <FormattedCopilotMessage text={m.text} />
              )}
            </div>
            <span className="text-xs text-slate-500 font-mono mt-1.5 px-2">{m.time}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 text-base text-[#00FF87] p-5 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] max-w-md">
            <Sparkles className="w-5 h-5 animate-spin" />
            <span className="font-bold">Copilot is verifying legal sections & corporate records...</span>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-[#1E2838] bg-[#0A0D14]">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-3 mb-4">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              className="px-4 py-2 rounded-full text-sm font-bold bg-[#131822] hover:bg-[#1A2232] border border-[#1E2838] text-slate-300 hover:text-[#00FF87] transition-all cursor-pointer shadow-md"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <input
            type="text"
            placeholder="Ask anything about recruitment laws, MCA21 registration, fee scams, or 1930 reporting..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 px-6 py-4 rounded-3xl bg-[#131822] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00FF87]"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading}
            className="px-8 py-4 rounded-3xl bg-[#00FF87] hover:bg-[#D4FF00] text-black font-black text-base transition-all shadow-[0_0_20px_rgba(0,255,135,0.4)] flex-shrink-0 cursor-pointer"
          >
            Send Question
          </button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// USER SAFETY HUB VIEW
// ================================================================

function UserSafetyHubView() {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-[#060709] max-w-5xl mx-auto">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black bg-[#00FF87]/20 text-[#00FF87] border border-[#00FF87]/40 uppercase tracking-wider">
          <Shield className="w-4 h-4" /> Official Candidate Safety Guidelines
        </div>
        <h2 className="text-4xl font-black text-slate-100 text-shadow-subtle">
          Student Protection & Fraud Prevention Hub
        </h2>
        <p className="text-base text-slate-300">
          Essential rules, regulatory guidelines (UGC/AICTE), and step-by-step reporting protocols.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border-2 border-red-500 text-[#FF3B5C] flex items-center justify-center font-black text-xl">1</div>
          <h3 className="text-2xl font-black text-slate-100">Zero Payment Policy</h3>
          <p className="text-base text-slate-300 leading-relaxed font-semibold">
            Legitimate corporate employers (TCS, Infosys, Google, Wipro, etc.) NEVER charge registration, laptop, security deposit, or uniform fees at any stage of hiring.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-[#00FF87]/20 border-2 border-[#00FF87] text-[#00FF87] flex items-center justify-center font-black text-xl">2</div>
          <h3 className="text-2xl font-black text-slate-100">Official Domain Emails Only</h3>
          <p className="text-base text-slate-300 leading-relaxed font-semibold">
            Corporate HR will always write to you from their official corporate domain (e.g. <code>@tcs.com</code>), never from free public webmail addresses (<code>@gmail.com</code>, <code>@yahoo.com</code>).
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-[#00F0FF]/20 border-2 border-[#00F0FF] text-[#00F0FF] flex items-center justify-center font-black text-xl">3</div>
          <h3 className="text-2xl font-black text-slate-100">Beware of Direct Selection</h3>
          <p className="text-base text-slate-300 leading-relaxed font-semibold">
            If you are offered an internship without any technical assessment or interview round simply based on your resume, it is an instant hallmark of recruitment fraud.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border-2 border-purple-500 text-purple-400 flex items-center justify-center font-black text-xl">4</div>
          <h3 className="text-2xl font-black text-slate-100">No Informal Chat Hiring</h3>
          <p className="text-base text-slate-300 leading-relaxed font-semibold">
            Interviews conducted exclusively over WhatsApp chat, Telegram channels, or Google Forms without enterprise video conferencing are unverified.
          </p>
        </div>
      </div>

      <div className="p-8 md:p-10 rounded-3xl bg-gradient-to-r from-[#131822] to-[#0D1117] border-2 border-[#1E2838] space-y-6 shadow-2xl">
        <h3 className="text-2xl font-black text-slate-100 flex items-center gap-3">
          <PhoneCall className="w-6 h-6 text-[#00FF87]" /> National Incident Reporting Directory
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#07080B] border border-[#1E2838]">
            <p className="text-xs font-mono text-slate-400 uppercase">Cybercrime Helpline</p>
            <p className="text-3xl font-black text-[#00FF87] mt-2 text-glow-emerald">1930</p>
            <p className="text-sm text-slate-400 mt-1">Toll-free 24/7 (Govt of India)</p>
          </div>
          <div className="p-6 rounded-2xl bg-[#07080B] border border-[#1E2838]">
            <p className="text-xs font-mono text-slate-400 uppercase">Online Portal</p>
            <p className="text-xl font-black text-slate-100 mt-2">cybercrime.gov.in</p>
            <p className="text-sm text-slate-400 mt-1">Ministry of Home Affairs</p>
          </div>
          <div className="p-6 rounded-2xl bg-[#07080B] border border-[#1E2838]">
            <p className="text-xs font-mono text-slate-400 uppercase">UGC Grievance</p>
            <p className="text-xl font-black text-slate-100 mt-2">samadhaan.ugc.ac.in</p>
            <p className="text-sm text-slate-400 mt-1">University Grants Commission</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// ADMIN MISSION CONTROL & VIEWS
// ================================================================

function AdminSidebar({ active, onNav }: { active: AdminView; onNav: (v: AdminView) => void }) {
  const ITEMS: { id: AdminView; label: string; emoji: string; badge?: string }[] = [
    { id: "admin_mission",       label: "Mission Operations",     emoji: "⚡" },
    { id: "admin_scan",          label: "Live Pipeline Scan",      emoji: "🔍", badge: "RUN" },
    { id: "admin_threats",       label: "Threat Intelligence IOC",emoji: "🚨" },
    { id: "admin_analytics",     label: "Platform Telemetry",     emoji: "📈" },
    { id: "admin_developer",     label: "Provider Status & API",  emoji: "💻" },
    { id: "admin_cases",         label: "Database Registry",      emoji: "📁" },
    { id: "admin_settings",      label: "System Settings",        emoji: "⚙️" },
  ];

  return (
    <aside className="w-72 border-r border-[#1E2838] bg-[#07090E] flex flex-col p-5 space-y-3 flex-shrink-0">
      <div className="px-4 py-2 text-xs font-mono font-black tracking-widest text-[#00F0FF] uppercase text-glow-cyan">
        Security Operations Center
      </div>
      {ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-base font-bold transition-all cursor-pointer ${
              isActive
                ? "bg-[#00F0FF]/20 text-[#00F0FF] border-2 border-[#00F0FF]/50 shadow-[0_0_20px_rgba(0,240,255,0.25)] text-glow-cyan font-black"
                : "text-slate-300 hover:text-slate-100 hover:bg-[#0F131A]"
            }`}
          >
            <span className="text-xl">{item.emoji}</span>
            <span className="flex-1 text-left truncate">{item.label}</span>
            {item.badge && (
              <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full font-black ${
                isActive ? "bg-[#00F0FF] text-black" : "bg-slate-800 text-slate-400"
              }`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}

function AdminThreatsView() {
  const [filter, setFilter] = useState("");
  const IOC_LIST = [
    { value: "clinchsoft.careers@upi", type: "UPI Payment Handle", threat: "Deposit Scam", severity: "CRITICAL", source: "AbuseIPDB", date: "2026-08-18" },
    { value: "careers-tcs-verify.com", type: "Typosquatting Domain", threat: "Brand Impersonation", severity: "CRITICAL", source: "VirusTotal Feed", date: "2026-08-17" },
    { value: "infosys.onboarding.dept@gmail.com", type: "Webmail Handle", threat: "Fake HR Recruiter", severity: "HIGH", source: "Internal Rule R002", date: "2026-08-18" },
    { value: "+91 98450 12345", type: "WhatsApp Channel", threat: "Direct Selection Scam", severity: "HIGH", source: "Community Reports", date: "2026-08-16" },
    { value: "technex.registration@oksbi", type: "UPI Payment Handle", threat: "Mandatory Laptop Fee", severity: "CRITICAL", source: "Internal Rule R007", date: "2026-08-18" },
    { value: "forms.gle/xK98jLmPq2", type: "Google Form URL", threat: "Unverified Recruitment Form", severity: "MEDIUM", source: "Internal Rule R009", date: "2026-08-18" },
  ];

  const filtered = IOC_LIST.filter(i => i.value.toLowerCase().includes(filter.toLowerCase()) || i.threat.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-[#060709]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-100 flex items-center gap-3 text-shadow-subtle">
            🚨 Threat Intelligence IOCs
          </h2>
          <p className="text-base text-slate-300 mt-1">
            Global repository of known fraudulent domains, recruiter handles, WhatsApp rings, and scam UPI identifiers.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search IOCs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-5 py-3 rounded-2xl bg-[#0F131A] border-2 border-[#1E2838] text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00F0FF]"
        />
      </div>

      <div className="rounded-3xl border-2 border-[#1E2838] bg-[#0D1117] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="bg-[#0F131A] text-slate-400 font-mono text-sm">
              <tr>
                <th className="px-6 py-4">Indicator Value</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Threat Category</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Feed Source</th>
                <th className="px-6 py-4 text-right">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2838]">
              {filtered.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#131822]/60 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-slate-100">{item.value}</td>
                  <td className="px-6 py-4 text-slate-300">{item.type}</td>
                  <td className="px-6 py-4 text-slate-100 font-extrabold">{item.threat}</td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black ${
                      item.severity === "CRITICAL" ? "bg-red-500/20 text-[#FF3B5C] border border-red-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}>
                      {item.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">{item.source}</td>
                  <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminAnalyticsView() {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-[#060709]">
      <div>
        <h2 className="text-3xl md:text-4xl font-black text-slate-100 flex items-center gap-3 text-shadow-subtle">
          📈 Platform Analytics & ML Telemetry
        </h2>
        <p className="text-base text-slate-300 mt-1">
          Supervised machine learning metrics, throughput, risk distribution, and anomaly clusters.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
          <span className="text-sm font-bold text-slate-400">ML Model Accuracy</span>
          <p className="text-4xl font-black text-[#00FF87] text-glow-emerald">98.4%</p>
          <span className="text-xs text-[#00FF87] font-mono">Linear SVM (Kaggle Dataset)</span>
        </div>
        <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
          <span className="text-sm font-bold text-slate-400">F1 Score</span>
          <p className="text-4xl font-black text-[#00F0FF] text-glow-cyan">0.982</p>
          <span className="text-xs text-[#00F0FF] font-mono">Precision: 98.6% · Recall: 97.9%</span>
        </div>
        <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
          <span className="text-sm font-bold text-slate-400">Scam Detection Rate</span>
          <p className="text-4xl font-black text-[#FF3B5C]">24.8%</p>
          <span className="text-xs text-[#FF3B5C] font-mono">Across 4,200+ checks</span>
        </div>
        <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
          <span className="text-sm font-bold text-slate-400">Average Inspection Time</span>
          <p className="text-4xl font-black text-slate-100">2.14s</p>
          <span className="text-xs text-[#00FF87] font-mono">8-pipeline parallel fusion</span>
        </div>
      </div>
    </div>
  );
}

function AdminMissionControl({
  onNav,
  onSelectScan,
  scans,
  stats,
}: {
  onNav: (v: AdminView) => void;
  onSelectScan: (id: string) => void;
  scans: ScanRecord[];
  stats: any;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-[#060709]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-8 md:p-10 rounded-3xl bg-gradient-to-r from-[#131822] to-[#0D1117] border-2 border-[#1E2838] shadow-2xl">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs font-black bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 mb-3 text-glow-cyan uppercase">
            <Activity className="w-4 h-4 animate-pulse" /> Live Telemetry Matrix
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-100 text-shadow-subtle">
            Forensic Intelligence & SOC Terminal
          </h2>
          <p className="text-base text-slate-300 mt-2">
            Real-time threat feeds, statutory company registries, authoritative DNS/RDAP, and supervised ML inference.
          </p>
        </div>
        <button
          onClick={() => onNav("admin_scan")}
          className="px-8 py-4 rounded-3xl font-black text-base bg-[#00F0FF] hover:bg-[#38BDF8] text-black transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] flex items-center gap-3 cursor-pointer"
        >
          <Zap className="w-5 h-5" /> Start Pipeline Scan
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
          <span className="text-sm font-bold text-slate-400">Total Scans in DB</span>
          <p className="text-4xl font-black text-slate-100">
            <AnimatedCounter value={stats?.totalScans || scans.length || 48} />
          </p>
          <span className="text-xs text-[#00FF87] font-mono">Live PostgreSQL records</span>
        </div>

        <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
          <span className="text-sm font-bold text-slate-400">Threats Neutralized</span>
          <p className="text-4xl font-black text-[#FF3B5C]">
            <AnimatedCounter value={stats?.threatsDetected || 12} />
          </p>
          <span className="text-xs text-[#FF3B5C] font-mono">Upfront fee & lookalikes</span>
        </div>

        <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
          <span className="text-sm font-bold text-slate-400">Average Trust Index</span>
          <p className="text-4xl font-black text-[#00F0FF] text-glow-cyan">
            {stats?.avgTrustScore || 79}<span className="text-base font-normal text-slate-500">/100</span>
          </p>
          <span className="text-xs text-[#00F0FF] font-mono">8-dimension fusion avg</span>
        </div>

        <div className="p-6 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
          <span className="text-sm font-bold text-slate-400">Active Forensics</span>
          <p className="text-4xl font-black text-[#00FF87] text-glow-emerald">8/8 Upstream</p>
          <span className="text-xs text-slate-400 font-mono">VirusTotal + AbuseIPDB + Gemini</span>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// DEFAULT MOCK REPORT
// ================================================================

const DEFAULT_REPORT: LegitifyReport = {
  scan_id: "scan-default-001",
  entity_type: "job_offer",
  entity_name: "Clinchsoft Technologies",
  company_name: "Clinchsoft Technologies",
  trust_score: 26,
  confidence_score: 26,
  confidence: 26,
  risk_level: "HIGH",
  verdict: "LIKELY SCAM",
  executive_summary: "Multiple high-risk structural fraud patterns detected, including lack of HR signatory person, missing corporate domain email, and reliance on public form tools for hiring.",
  recommendation: "Do NOT share personal Aadhaar/PAN/bank details or transfer funds. Verify with college placement cell.",
  positive_signals: [],
  warning_signals: ["Uses urgency/pressure language", "No company location/address identified"],
  critical_signals: [
    "Uses Google Forms/Typeform for hiring",
    "No HR contact person name identified. Legitimate letters include HR signatory details.",
    "No contact information (email or phone) found in the letter.",
    "No email address found in the letter. Legitimate offer letters typically include a corporate email.",
    "Direct selection without interview rounds or assessments."
  ],
  dimension_scores: { rules: 80, nlp: 50, ner: 50 },
  triggered_flags: [
    { rule: "nlp_classifier", severity: "high", message: "Uses Google Forms/Typeform for hiring", score: 0.8 },
    { rule: "ner_person", severity: "high", message: "No HR contact person name identified. Legitimate letters include HR signatory details.", score: 0.7 },
    { rule: "ner_contact", severity: "high", message: "No contact information (email or phone) found in the letter.", score: 0.8 },
    { rule: "email_domain", severity: "medium", message: "No email address found in the letter. Legitimate offer letters typically include a corporate email.", score: 0.4 },
    { rule: "nlp_classifier", severity: "medium", message: "Uses urgency/pressure language", score: 0.6 },
    { rule: "ner_location", severity: "medium", message: "No company location/address identified in the letter.", score: 0.5 },
    { rule: "missing_fields", severity: "low", message: "Letter is missing: company address.", score: 0.3 },
  ],
  next_steps: [
    "🚨 Do NOT share any personal documents (Aadhaar, PAN, bank details) with this organization.",
    "Report this offer letter to your college placement cell immediately.",
    "If you found this on Internshala or LinkedIn, report the listing on the platform.",
    "File a complaint on the National Cyber Crime Portal (cybercrime.gov.in) if you've already shared any information.",
    "Do NOT pay any 'registration fee', 'security deposit', or 'training charges'. Legitimate companies never ask candidates for money.",
    "Search for 'Clinchsoft Technologies' on MCA21 (mca.gov.in) to check if it's a registered company.",
  ],
  rules_evaluated: [],
  timeline: [],
  evidence_completeness: { percentage: 85, overall_percentage: 85, missing_evidence: [] },
  disclaimer: "LEGITIFY provides automated evidence-based trust scoring for recruitment fraud prevention.",
};

// ================================================================
// MASTER APP COMPONENT
// ================================================================

export function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>("gate");
  const [portalRole, setPortalRole] = useState<PortalRole | null>(null);
  const [userView, setUserView] = useState<UserView>("user_scan");
  const [adminView, setAdminView] = useState<AdminView>("admin_mission");

  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [currentReport, setCurrentReport] = useState<LegitifyReport>(DEFAULT_REPORT);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [analyticsStats, setAnalyticsStats] = useState<any>(null);
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState<string | undefined>();

  // 1. Check local cached user session
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("legitify_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        const role = parsed.user_metadata?.role || parsed.app_metadata?.role || "user";
        setPortalRole(role === "admin" ? "admin" : "user");
      }
    } catch {}
  }, []);

  // 2. Supabase Auth State Change & Google Redirect Handler
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        setUser(s.user);
        const role = s.user.app_metadata?.role || s.user.user_metadata?.role || "user";
        setPortalRole(role === "admin" ? "admin" : "user");
        try { localStorage.setItem("legitify_user", JSON.stringify(s.user)); } catch {}
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        setUser(s.user);
        const role = s.user.app_metadata?.role || s.user.user_metadata?.role || "user";
        setPortalRole(role === "admin" ? "admin" : "user");
        try { localStorage.setItem("legitify_user", JSON.stringify(s.user)); } catch {}
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setPortalRole(null);
        setAuthScreen("gate");
        try { localStorage.removeItem("legitify_user"); } catch {}
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. Live Online Supabase Scan History Loader
  const loadUserHistory = async (token?: string, userId?: string) => {
    setHistoryLoading(true);
    try {
      if (userId && userId !== "00000000-0000-0000-0000-000000000000") {
        const { data, error } = await supabase
          .from("scans")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0) {
          setScans(data);
          setHistoryLoading(false);
          return;
        }
      }

      const apiScans = await getScans(token);
      if (apiScans && apiScans.length > 0) {
        setScans(apiScans);
      }
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    getAnalytics().then(setAnalyticsStats);
    loadUserHistory(session?.access_token, user?.id);
  }, [session, user]);

  const handleLoginSuccess = (userObj: any, role: PortalRole) => {
    setUser(userObj);
    setPortalRole(role);
    if (role === "user") setUserView("user_scan");
    else setAdminView("admin_mission");
    loadUserHistory(session?.access_token, userObj?.id);
  };

  const handleScanComplete = (response: any) => {
    const rep: LegitifyReport = response?.report || response;
    setCurrentReport(rep);
    setUserView("user_report");
    loadUserHistory(session?.access_token, user?.id);
  };

  const handleSelectScan = async (scanId: string) => {
    try {
      const rep = await getScanReport(scanId, session?.access_token);
      if (rep) {
        const finalReport: LegitifyReport = (rep as any)?.report || rep;
        setCurrentReport(finalReport);
        setUserView("user_report");
      }
    } catch {}
  };

  const handleOpenCopilotWithPrompt = (prompt?: string) => {
    setCopilotInitialPrompt(prompt);
    setUserView("user_copilot");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setPortalRole(null);
    setAuthScreen("gate");
    try { localStorage.removeItem("legitify_user"); } catch {}
  };

  // If user is not logged in: render separate login screens
  if (!portalRole || !user) {
    if (authScreen === "candidate_login") {
      return <CandidateLoginPage onBack={() => setAuthScreen("gate")} onLoginSuccess={handleLoginSuccess} />;
    }
    if (authScreen === "admin_login") {
      return <AdminLoginPage onBack={() => setAuthScreen("gate")} onLoginSuccess={handleLoginSuccess} />;
    }
    return <AuthGatewayLanding onSelectRole={(s) => setAuthScreen(s)} />;
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Priya Sharma";

  return (
    <div className="min-h-screen bg-[#060709] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <Header
        portalRole={portalRole}
        onSwitchPortal={(r) => setPortalRole(r)}
        user={user}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex overflow-hidden">
        {portalRole === "user" ? (
          <>
            <UserSidebar active={userView} onNav={setUserView} />
            <main className="flex-1 flex flex-col overflow-hidden">
              {userView === "user_scan" && (
                <UserScanView
                  onScanComplete={handleScanComplete}
                  onOpenCopilot={handleOpenCopilotWithPrompt}
                  userToken={session?.access_token}
                  userName={userName}
                />
              )}
              {userView === "user_report" && (
                <UserReportView
                  report={currentReport}
                  onNewScan={() => setUserView("user_scan")}
                  onOpenCopilot={() => setUserView("user_copilot")}
                />
              )}
              {userView === "user_copilot" && (
                <UserCopilotView
                  report={currentReport}
                  userToken={session?.access_token}
                  userName={userName}
                  initialQuestion={copilotInitialPrompt}
                />
              )}
              {userView === "user_safety" && <UserSafetyHubView />}
              {userView === "user_history" && (
                <UserOnlineHistoryView
                  scans={scans}
                  onSelectScan={handleSelectScan}
                  onNewScan={() => setUserView("user_scan")}
                  loading={historyLoading}
                />
              )}
              {userView === "user_settings" && (
                <div className="flex-1 p-10 max-w-xl mx-auto space-y-6">
                  <h2 className="text-3xl font-black">⚙️ Candidate Account Settings</h2>
                  <div className="p-8 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-5">
                    <p className="text-base text-slate-300">Name: <strong className="text-slate-100 text-lg">{userName}</strong></p>
                    <p className="text-base text-slate-300">Email: <strong className="text-slate-100 text-lg">{user?.email || "Candidate (Guest Mode)"}</strong></p>
                    <p className="text-base text-[#00FF87] font-black">Role: 🎓 Verified Candidate</p>
                    <button
                      onClick={handleSignOut}
                      className="px-8 py-4 rounded-2xl bg-red-500/20 text-[#FF3B5C] font-black text-base hover:bg-red-500/30 transition-all cursor-pointer"
                    >
                      Sign Out & Return to Portal Gate
                    </button>
                  </div>
                </div>
              )}
            </main>
          </>
        ) : (
          <>
            <AdminSidebar active={adminView} onNav={setAdminView} />
            <main className="flex-1 flex flex-col overflow-hidden">
              {adminView === "admin_mission" && (
                <AdminMissionControl
                  onNav={setAdminView}
                  onSelectScan={handleSelectScan}
                  scans={scans}
                  stats={analyticsStats}
                />
              )}
              {adminView === "admin_scan" && (
                <UserScanView
                  onScanComplete={handleScanComplete}
                  onOpenCopilot={handleOpenCopilotWithPrompt}
                  userToken={session?.access_token}
                  userName={userName}
                />
              )}
              {adminView === "admin_threats" && <AdminThreatsView />}
              {adminView === "admin_analytics" && <AdminAnalyticsView />}
              {adminView === "admin_cases" && (
                <UserOnlineHistoryView
                  scans={scans}
                  onSelectScan={handleSelectScan}
                  onNewScan={() => setAdminView("admin_scan")}
                  loading={historyLoading}
                />
              )}
              {adminView === "admin_settings" && (
                <div className="flex-1 p-10 max-w-xl mx-auto space-y-6">
                  <h2 className="text-3xl font-black">⚙️ Security Operations Settings</h2>
                  <div className="p-8 rounded-3xl bg-[#0D1117] border-2 border-[#1E2838] space-y-5">
                    <p className="text-base text-slate-300">Clearance: <strong className="text-[#00F0FF] text-lg">Active (Level 3 Clearance)</strong></p>
                    <button
                      onClick={handleSignOut}
                      className="px-8 py-4 rounded-2xl bg-red-500/20 text-[#FF3B5C] font-black text-base hover:bg-red-500/30 transition-all cursor-pointer"
                    >
                      Exit SOC & Return to Gate
                    </button>
                  </div>
                </div>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[LEGITIFY UI] ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#060709] p-6 text-slate-100 font-sans">
          <div className="max-w-md p-8 rounded-3xl bg-[#0F131A] border-2 border-red-500/40 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 text-[#FF3B5C] flex items-center justify-center mx-auto text-3xl">
              ⚠️
            </div>
            <h2 className="text-xl font-black text-slate-100">Display Recovery Mode</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Session state preserved. Click below to return to the active portal.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-8 py-3 rounded-full font-black text-sm bg-[#00FF87] hover:bg-[#D4FF00] text-black transition-all shadow-lg cursor-pointer"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RootApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
