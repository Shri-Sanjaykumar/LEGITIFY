'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { Scan } from '@/types';

export interface CreateScanParams {
  file_id?: string;
  scan_type: 'pdf' | 'docx' | 'txt' | 'url' | 'linkedin' | 'email' | 'text';
  raw_input_text?: string;
  scan_source: 'FILE' | 'EMAIL' | 'LINKEDIN' | 'URL' | 'TEXT';
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

export function useScanHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['scans', 'history', page, limit],
    queryFn: async () => {
      const res = await apiFetch(`/scan/history?page=${page}&limit=${limit}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch scan history');
      }
      return res.data as { scans: Scan[]; total: number; page: number; limit: number };
    },
  });
}

export function useScanDetails(id: string | null) {
  return useQuery({
    queryKey: ['scan', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiFetch(`/scan/${id}`);
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch scan details');
      }
      return res.data as Scan;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'PENDING' || data.status === 'QUEUED' || data.status === 'PROCESSING')) {
        return 1500; // Poll every 1.5 seconds
      }
      return false; // Stop polling when COMPLETED or FAILED
    },
  });
}

export function useCreateScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateScanParams) => {
      const res = await apiFetch('/scan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.success) {
        throw new Error(res.message || 'Failed to create scan record');
      }
      return res.data as Scan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/scan/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.success) {
        throw new Error(res.message || 'File upload failed');
      }
      return res.data as { id: string; original_filename: string; file_size: number; mime_type: string };
    },
  });
}
