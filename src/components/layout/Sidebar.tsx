'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ScanLine,
  FileText,
  Building2,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';

interface SidebarProps {
  activePath: string;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Scan', href: '/scan', icon: ScanLine },
  { label: 'Reports', href: '/dashboard', icon: FileText },
  { label: 'Companies', href: '/dashboard', icon: Building2 },
  { label: 'Settings', href: '/dashboard', icon: Settings },
];

const sidebarVariants = {
  open: {
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
  closed: {
    x: '-100%',
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
};

const overlayVariants = {
  open: { opacity: 1 },
  closed: { opacity: 0 },
};

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

export default function Sidebar({ activePath }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const renderNavContent = (isMobile: boolean) => {
    const userName = user?.full_name || 'User';
    const userRole = user?.role || 'student';
    const initials = getInitials(userName);

    return (
      <div className="flex flex-col h-full text-left">
        {/* Logo */}
        <div
          className={cn(
            'flex items-center gap-3 px-5 pt-7 pb-8',
            collapsed && !isMobile && 'justify-center px-0'
          )}
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] shrink-0">
            <Shield className="w-5 h-5 text-white" />
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] opacity-40 blur-md -z-10" />
          </div>
          {(!collapsed || isMobile) && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-xl font-bold text-gradient tracking-tight"
            >
              {APP_NAME}
            </motion.span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isCurrentPage =
              item.label === 'Dashboard'
                ? activePath === '/dashboard'
                : item.label === 'New Scan'
                ? activePath === '/scan'
                : false;

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => isMobile && setMobileOpen(false)}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative',
                  collapsed && !isMobile && 'justify-center px-0',
                  isCurrentPage
                    ? 'text-[var(--primary-light)] bg-[rgba(99,102,241,0.12)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                )}
              >
                {isCurrentPage && (
                  <motion.div
                    layoutId={isMobile ? 'mobile-active-nav' : 'desktop-active-nav'}
                    className="absolute inset-0 rounded-lg bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.2)]"
                    style={{
                      boxShadow: '0 0 20px rgba(99, 102, 241, 0.1)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    'w-5 h-5 shrink-0 relative z-10 transition-colors',
                    isCurrentPage ? 'text-[var(--primary-light)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                  )}
                />
                {(!collapsed || isMobile) && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium relative z-10"
                  >
                    {item.label}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div
          className={cn(
            'px-3 py-4 border-t border-[var(--border-primary)]',
            collapsed && !isMobile && 'px-2'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg',
              collapsed && !isMobile && 'justify-center px-0'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            {(!collapsed || isMobile) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {userName}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] truncate capitalize">
                  {userRole}
                </p>
              </motion.div>
            )}
            {(!collapsed || isMobile) && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[rgba(239,68,68,0.1)] transition-colors cursor-pointer"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Collapse Toggle (Desktop only) */}
        {!isMobile && (
          <div className="px-3 pb-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all duration-200 cursor-pointer"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-xs font-medium">Collapse</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Hamburger Trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen bg-[#0c0c14] border-r border-[var(--border-primary)] transition-all duration-300 shrink-0 sticky top-0',
          sidebarWidth
        )}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Overlay + Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              variants={overlayVariants}
              initial="closed"
              animate="open"
              exit="closed"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              variants={sidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed top-0 left-0 z-50 w-[280px] h-screen bg-[#0c0c14] border-r border-[var(--border-primary)] lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-5 right-4 p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
              {renderNavContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
