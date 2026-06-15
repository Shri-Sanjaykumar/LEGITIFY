'use client';

import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatsCards from '@/components/dashboard/StatsCards';
import TrustChart from '@/components/dashboard/TrustChart';
import QuickScan from '@/components/dashboard/QuickScan';
import RecentScans from '@/components/dashboard/RecentScans';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import AuthGuard from '@/components/shared/AuthGuard';
import { useDashboard } from '@/hooks/useDashboard';
import { useAuth } from '@/hooks/useAuth';

function DashboardContent() {
  const { user } = useAuth();
  const { stats, recentScans, activities, isLoading } = useDashboard();
  const userName = user?.full_name || 'User';

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Welcome Back, {userName}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Here is your verification activity dashboard. Keep scanning before you apply.
        </p>
      </div>

      {/* Stats Row (Full Width) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <StatsCards stats={stats} isLoading={isLoading} />
      </motion.div>

      {/* Middle Row (Trust Chart & Quick Scan) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col h-full justify-between">
          <TrustChart />
        </div>
        <div className="lg:col-span-1">
          <QuickScan />
        </div>
      </div>

      {/* Bottom Row (Recent Scans & Activity Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentScans scans={recentScans} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-1">
          <ActivityFeed activities={activities} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardLayout activePath="/dashboard">
        <DashboardContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
