'use client';

import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatsCards from '@/components/dashboard/StatsCards';
import TrustChart from '@/components/dashboard/TrustChart';
import QuickScan from '@/components/dashboard/QuickScan';
import RecentScans from '@/components/dashboard/RecentScans';
import ActivityFeed from '@/components/dashboard/ActivityFeed';

export default function DashboardPage() {
  return (
    <DashboardLayout activePath="/dashboard">
      <div className="space-y-6">
        {/* Top Header Section */}
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Welcome Back, Student
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
          <StatsCards />
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
            <RecentScans />
          </div>
          <div className="lg:col-span-1">
            <ActivityFeed />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
