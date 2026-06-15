'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { Report, EvidenceItem } from '@/types';

export function useReportDetails(id: string | null) {
  return useQuery({
    queryKey: ['report', 'details', id],
    queryFn: async () => {
      if (!id || id === 'demo') return null;
      const res = await apiFetch(`/report/${id}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch report details');
      }
      return res.data as Report;
    },
    enabled: !!id && id !== 'demo',
  });
}

export function useReportEvidence(id: string | null) {
  return useQuery({
    queryKey: ['report', 'evidence', id],
    queryFn: async () => {
      if (!id || id === 'demo') return [];
      const res = await apiFetch(`/report/${id}/evidence`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch report evidence');
      }
      return (res.data as any).evidence as EvidenceItem[];
    },
    enabled: !!id && id !== 'demo',
  });
}

export function useReportHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['reports', 'history', page, limit],
    queryFn: async () => {
      const res = await apiFetch(`/report?page=${page}&limit=${limit}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch report history');
      }
      return res.data as { reports: Report[]; total: number; page: number; limit: number };
    },
  });
}
