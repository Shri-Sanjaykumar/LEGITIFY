'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { Report, EvidenceItem, TrustScoreBreakdown } from '@/types';

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
      return (res.data as { evidence: EvidenceItem[] }).evidence;
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

export function useReportBreakdown(id: string | null) {
  return useQuery({
    queryKey: ['report', 'breakdown', id],
    queryFn: async () => {
      if (!id || id === 'demo') return [];
      const res = await apiFetch(`/report/${id}/breakdown`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch report breakdown');
      }
      return (res.data as { breakdown: TrustScoreBreakdown[] }).breakdown;
    },
    enabled: !!id && id !== 'demo',
  });
}

export interface TimelineEventPayload {
  filename?: string;
  new_status?: string;
  verification_status?: string;
  company_name?: string;
  verification_level?: string;
  domain?: string;
  dns_status?: string;
  mx_status?: string;
  ssl_status?: string;
  recruiter_email?: string;
  report_version?: string;
  trust_score?: number;
}

export interface TimelineEvent {
  id: string;
  action: string;
  payload?: TimelineEventPayload;
  created_at: string;
}

export function useReportTimeline(id: string | null) {
  return useQuery({
    queryKey: ['report', 'timeline', id],
    queryFn: async () => {
      if (!id || id === 'demo') return [];
      const res = await apiFetch(`/report/${id}/timeline`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch report timeline');
      }
      return (res.data as { timeline: TimelineEvent[] }).timeline;
    },
    enabled: !!id && id !== 'demo',
  });
}
