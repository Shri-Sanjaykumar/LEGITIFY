'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { DomainVerification, DomainVerificationDetail, DomainReputationSnapshot } from '@/types';

export function useDomainVerification(id: string | null) {
  return useQuery({
    queryKey: ['domain', 'verification', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiFetch(`/domain/${id}/breakdown`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch domain verification details');
      }
      return res.data as DomainVerificationDetail;
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

export function useSearchDomainVerification(domain: string | null) {
  return useQuery({
    queryKey: ['domain', 'search', domain],
    queryFn: async () => {
      if (!domain) return null;
      // Extract domain portion if it has an @ or path
      let cleanDomain = domain.trim().toLowerCase();
      if (cleanDomain.includes('@')) {
        cleanDomain = cleanDomain.split('@')[1];
      }
      cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      
      const res = await apiFetch(`/domain/history?search=${encodeURIComponent(cleanDomain)}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to search domain verification');
      }
      const list = res.data as DomainVerification[];
      // Match exactly the domain we are querying if list has entries
      if (list && list.length > 0) {
        const exactMatch = list.find(d => d.domain === cleanDomain);
        return exactMatch || list[0];
      }
      return null;
    },
    enabled: !!domain,
  });
}

export function useDomainReputation(domain: string | null) {
  return useQuery({
    queryKey: ['domain', 'reputation', domain],
    queryFn: async () => {
      if (!domain) return [];
      let cleanDomain = domain.trim().toLowerCase();
      if (cleanDomain.includes('@')) {
        cleanDomain = cleanDomain.split('@')[1];
      }
      cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

      const res = await apiFetch(`/domain/reputation/${encodeURIComponent(cleanDomain)}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch domain reputation history');
      }
      return res.data as DomainReputationSnapshot[];
    },
    enabled: !!domain,
  });
}

export function useCreateDomainVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { domain: string; verification_source?: string }) => {
      const res = await apiFetch('/domain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.success) {
        throw new Error(res.message || 'Failed to initiate domain verification');
      }
      return res.data as DomainVerification;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['domain'] });
      // Invalidate specific search for this domain too
      queryClient.invalidateQueries({ queryKey: ['domain', 'search', variables.domain] });
      queryClient.invalidateQueries({ queryKey: ['domain', 'reputation', variables.domain] });
    },
  });
}
