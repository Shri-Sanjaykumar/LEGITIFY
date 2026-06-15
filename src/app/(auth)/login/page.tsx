'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await login(email, password);
      if (res.success) {
        router.push('/dashboard');
      } else {
        setError(res.message);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#06060b] overflow-hidden px-4 py-12">
      {/* Background gradients */}
      <div className="absolute inset-0 gradient-hero opacity-80" />
      <div className="absolute inset-0 grid-bg opacity-30" />

      {/* Main Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.6, bounce: 0.1 }}
        className="relative w-full max-w-md bg-[#111118]/80 backdrop-blur-xl border border-[var(--border-primary)] rounded-2xl p-8 shadow-2xl z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shadow-lg shadow-indigo-500/10 mb-3">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Welcome Back
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5">
            Log in to verify your opportunities
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-4 pl-10 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[rgba(99,102,241,0.2)] transition-all"
              />
              <div className="absolute left-3.5 top-3.5 text-[var(--text-muted)]">
                <Mail className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Password
              </label>
              <Link
                href="/login"
                className="text-xs font-medium text-[var(--primary-light)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-11 px-4 pl-10 pr-10 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[rgba(99,102,241,0.2)] transition-all"
              />
              <div className="absolute left-3.5 top-3.5 text-[var(--text-muted)]">
                <Lock className="w-4 h-4" />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              className="w-4 h-4 accent-[var(--primary)] rounded border-[var(--border-primary)] bg-[var(--bg-input)]"
            />
            <label htmlFor="remember" className="text-xs text-[var(--text-secondary)] select-none">
              Remember this device
            </label>
          </div>

          {/* Submit */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </motion.button>
        </form>

        {/* Separator */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute w-full border-t border-[var(--border-primary)]" />
          <span className="relative px-3 bg-[#111118] text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">
            or continue with
          </span>
        </div>

        {/* Google OAuth Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={async () => {
            setIsLoading(true);
            setError(null);
            try {
              // Mock google sign in for demo using test account
              const res = await login('admin@legitify.io', 'Admin@1234');
              if (res.success) {
                router.push('/dashboard');
              } else {
                setError(res.message);
              }
            } catch {
              setError('Failed to authenticate with Google.');
            } finally {
              setIsLoading(false);
            }
          }}
          className="w-full py-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-secondary)] text-sm font-semibold text-[var(--text-primary)] flex items-center justify-center gap-2 cursor-pointer select-none transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.7 0 3.2.58 4.4 1.73l3.3-3.3C17.7 1.57 15 1 12 1 7.37 1 3.4 3.73 1.57 7.7l3.9 3.03C6.42 7.75 9 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.8-.07-1.56-.2-2.3H12v4.51h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.98 3.39-4.88 3.39-8.6z"
            />
            <path
              fill="#FBBC05"
              d="M5.47 10.73c-.24-.73-.38-1.5-.38-2.3s.14-1.57.38-2.3L1.57 3.1c-.96 1.93-1.51 4.1-1.51 6.4 0 2.3.55 4.47 1.51 6.4l3.9-3.17z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.1.74-2.52 1.18-4.3 1.18-3 0-5.58-2.71-6.53-5.69L1.57 15.9C3.4 19.87 7.37 23 12 23z"
            />
          </svg>
          Google
        </motion.button>

        {/* Footer info */}
        <p className="text-xs text-[var(--text-secondary)] text-center mt-6">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-medium text-[var(--primary-light)] hover:underline"
          >
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
