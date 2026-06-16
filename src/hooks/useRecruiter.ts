'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type {
  RecruiterVerification,
  RecruiterVerificationDetail,
  RecruiterReputationSnapshot,
} from '@/types';

export function useRecruiterVerification(id: string | null) {
  return useQuery({
    queryKey: ['recruiter', 'verification', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiFetch(`/recruiter/${id}/breakdown`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch recruiter verification details');
      }
      return res.data as RecruiterVerificationDetail;
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

export function useSearchRecruiterVerification(email: string | null, company: string | null) {
  return useQuery({
    queryKey: ['recruiter', 'search', email, company],
    queryFn: async () => {
      if (!email) return null;
      const res = await apiFetch(`/recruiter/history?search=${encodeURIComponent(email)}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to search recruiter verification');
      }
      const list = res.data as RecruiterVerification[];
      if (list && list.length > 0) {
        // Find exact match for email + company if specified
        const match = list.find(
          (r) =>
            r.recruiter_email.toLowerCase() === email.toLowerCase() &&
            (!company || r.claimed_company.toLowerCase() === company.toLowerCase())
        );
        return match || list[0];
      }
      return null;
    },
    enabled: !!email,
  });
}

export function useRecruiterReputation(email: string | null) {
  return useQuery({
    queryKey: ['recruiter', 'reputation', email],
    queryFn: async () => {
      if (!email) return [];
      const res = await apiFetch(`/recruiter/reputation/${encodeURIComponent(email)}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch recruiter reputation history');
      }
      return res.data as RecruiterReputationSnapshot[];
    },
    enabled: !!email,
  });
}

export function useCreateRecruiterVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      recruiter_name: string;
      recruiter_email: string;
      claimed_company: string;
      recruiter_phone?: string;
      recruiter_role?: string;
      linkedin_profile_url?: string;
      verification_source?: string;
    }) => {
      const res = await apiFetch('/recruiter/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.success) {
        throw new Error(res.message || 'Failed to initiate recruiter verification');
      }
      return res.data as RecruiterVerification;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recruiter'] });
      queryClient.invalidateQueries({
        queryKey: ['recruiter', 'search', variables.recruiter_email, variables.claimed_company],
      });
    },
  });
}
