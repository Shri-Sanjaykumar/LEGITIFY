'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { CompanyVerification, CompanyVerificationDetail } from '@/types';

export interface VerifyCompanyParams {
  company_name: string;
  website: string;
  company_email?: string;
  contact_number?: string;
  address?: string;
}

export function useCompanyVerification(id: string | null) {
  return useQuery({
    queryKey: ['company', 'verification', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiFetch(`/company/${id}/breakdown`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch company verification details');
      }
      return res.data as CompanyVerificationDetail;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data &&
        (data.verification.verification_status === 'PENDING' ||
          data.verification.verification_status === 'PROCESSING')
      ) {
        return 2000; // Poll every 2 seconds while pending/processing
      }
      return false;
    },
  });
}

export function useSearchCompanyVerification(website: string | null) {
  return useQuery({
    queryKey: ['company', 'search', website],
    queryFn: async () => {
      if (!website) return null;
      const cleanWebsite = website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      const res = await apiFetch(`/company/history?website=${encodeURIComponent(cleanWebsite)}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to search company verification');
      }
      const list = res.data as CompanyVerification[];
      return list && list.length > 0 ? list[0] : null;
    },
    enabled: !!website,
  });
}

export function useCreateCompanyVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      company_name: string;
      website: string;
      company_email?: string;
      contact_number?: string;
      address?: string;
    }) => {
      const res = await apiFetch('/company/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.success) {
        throw new Error(res.message || 'Failed to initiate company verification');
      }
      return res.data as CompanyVerification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });
}
