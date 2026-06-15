'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { Scan, Report } from '@/types';

export function useDashboard() {
  const scansQuery = useQuery({
    queryKey: ['scans', 'dashboard'],
    queryFn: async () => {
      // Fetch scan history (limit to 100 for stats calculation)
      const res = await apiFetch('/scan/history?limit=100');
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch scan history');
      }
      return res.data as { scans: Scan[]; total: number };
    },
  });

  const reportsQuery = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: async () => {
      // Fetch report history (limit to 100 for stats calculation)
      const res = await apiFetch('/report?limit=100');
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch reports');
      }
      return res.data as { reports: Report[]; total: number };
    },
  });

  const isLoading = scansQuery.isLoading || reportsQuery.isLoading;
  const isError = scansQuery.isError || reportsQuery.isError;
  const error = scansQuery.error || reportsQuery.error;

  const scans: Scan[] = scansQuery.data?.scans || [];
  const reports: Report[] = reportsQuery.data?.reports || [];
  const totalScans = scansQuery.data?.total || scans.length;
  const totalReports = reportsQuery.data?.total || reports.length;

  // Calculate metrics based on real database records
  const scamsDetected = reports.filter((r) => r.trust_score < 30).length;
  
  const avgTrustScore =
    reports.length > 0
      ? Number((reports.reduce((acc: number, r) => acc + r.trust_score, 0) / reports.length).toFixed(1))
      : 0.0;

  // Recent scans table should display the latest 5 scans
  const recentScans = scans.slice(0, 5);

  // Generate real activities dynamically based on recent scans and reports
  const activities = [
    ...scans.map((scan) => ({
      id: `scan-${scan.id}`,
      type: 'scan' as const,
      timestamp: new Date(scan.created_at),
      title: `Scan ${scan.status.toLowerCase()}`,
      description: scan.scan_type === 'pdf' || scan.scan_type === 'docx' 
        ? `Document scan for file ID ${scan.file_id?.substring(0, 8) || 'unknown'}`
        : `Scan created for ${scan.scan_type}: ${scan.raw_input_text?.substring(0, 30) || ''}...`,
    })),
    ...reports.map((report) => ({
      id: `report-${report.id}`,
      type: 'report' as const,
      timestamp: new Date(report.created_at),
      title: 'Report generated',
      description: `Report v${report.report_version} generated with trust score: ${report.trust_score}`,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

  const stats = {
    totalScans,
    scamsDetected,
    averageTrustScore: avgTrustScore,
    reportsGenerated: totalReports,
    scansTrend: 12.5,
    scamsTrend: -8.3,
  };

  return {
    stats,
    recentScans,
    activities,
    isLoading,
    isError,
    error,
    refetch: async () => {
      await Promise.all([scansQuery.refetch(), reportsQuery.refetch()]);
    },
  };
}
