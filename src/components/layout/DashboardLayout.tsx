'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import {
  Shield,
  LayoutDashboard,
  ScanSearch,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  User,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const sidebarItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Scan', href: '/scan', icon: ScanSearch },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function DashboardLayout({ children, activePath }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const currentPath = activePath || pathname;
  const router = useRouter();
  const { logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <aside
        className="hidden lg:flex flex-col w-64 border-r"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {APP_NAME}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-white'
                    : 'hover:bg-[var(--bg-elevated)]'
                )}
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(99, 102, 241, 0.12)' : undefined,
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                }}
              >
                <item.icon size={18} style={{ color: isActive ? '#6366f1' : undefined }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden flex flex-col border-r"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
                    <Shield size={20} className="text-white" />
                  </div>
                  <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {APP_NAME}
                  </span>
                </div>
                <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1">
                {sidebarItems.map((item) => {
                  const isActive = currentPath === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                      style={{
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        background: isActive ? 'rgba(99, 102, 241, 0.12)' : undefined,
                      }}
                    >
                      <item.icon size={18} style={{ color: isActive ? '#6366f1' : undefined }} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="px-3 py-4 border-t mt-auto" style={{ borderColor: 'var(--border-primary)' }}>
                <button
                  onClick={() => {
                    setSidebarOpen(false);
                    handleSignOut();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between px-4 lg:px-8 py-4 border-b"
          style={{
            background: 'rgba(6, 6, 11, 0.8)',
            backdropFilter: 'blur(12px)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
              onClick={() => setSidebarOpen(true)}
              style={{ color: 'var(--text-secondary)' }}
            >
              <Menu size={20} />
            </button>
            <Link
              href="/"
              className="hidden sm:flex items-center gap-2 text-sm hover:text-primary transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <ChevronLeft size={14} />
              Back to Home
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors relative"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                color: 'white',
              }}
            >
              <User size={16} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
