// ==============================================================================
// LEGITIFY FRONTEND API CLIENT
// ==============================================================================
import { LegitifyReport, ScanRecord } from '../types';

const API_BASE = '/api';

function getAuthHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Accept either a structured object (from App.tsx) or raw FormData
export async function runScan(
  input: {
    entityType: string;
    entityValue: string;
    contextText?: string;
    file?: File;
    token?: string;
  } | FormData,
  token?: string
): Promise<{ success: boolean; scan_id: string; report: LegitifyReport }> {
  let formData: FormData;
  let authToken = token;

  if (input instanceof FormData) {
    formData = input;
  } else {
    authToken = input.token || token;
    formData = new FormData();
    formData.append('entity_type', input.entityType || 'job_offer');
    formData.append('entity_value', input.entityValue || 'Uploaded Document');
    if (input.contextText) formData.append('context_text', input.contextText);
    if (input.file) formData.append('file', input.file);
  }

  const res = await fetch(`${API_BASE}/scans`, {
    method: 'POST',
    headers: getAuthHeaders(authToken),
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Intelligence scan failed.');
  }
  return json;
}

export async function getScans(token?: string): Promise<ScanRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/scans`, {
      headers: getAuthHeaders(token),
    });
    const json = await res.json();
    return json.scans || [];
  } catch {
    return [];
  }
}

export async function getScanReport(scanId: string, token?: string): Promise<LegitifyReport | null> {
  try {
    const res = await fetch(`${API_BASE}/scans/${scanId}`, {
      headers: getAuthHeaders(token),
    });
    const json = await res.json();
    return json.report || null;
  } catch {
    return null;
  }
}

export async function getSharedReport(shareToken: string): Promise<LegitifyReport | null> {
  try {
    const res = await fetch(`${API_BASE}/shared-reports/${shareToken}`);
    const json = await res.json();
    return json.report || null;
  } catch {
    return null;
  }
}

export async function shareReport(scanId: string, token?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/reports/${scanId}/share`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json',
    },
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Failed to share report');
  return json.share_token;
}

export async function askCopilot(report: LegitifyReport, question: string, token?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/copilot`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, context: report }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Copilot reasoning unavailable');
  return json.answer;
}

export async function getThreats(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/threats`);
    const json = await res.json();
    return json.threats || [];
  } catch {
    return [];
  }
}

export async function getAnalytics(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/analytics`);
    const json = await res.json();
    return json.stats || null;
  } catch {
    return null;
  }
}

export async function getAuditLogs(token?: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/audit-logs`, {
      headers: getAuthHeaders(token),
    });
    const json = await res.json();
    return json.logs || [];
  } catch {
    return [];
  }
}

export async function getProviderStatus(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/providers/status`);
    const json = await res.json();
    return json.providers || [];
  } catch {
    return [];
  }
}

export async function submitFeedback(scanId: string, rating: string, comment?: string, token?: string): Promise<void> {
  await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scan_id: scanId, rating, comment }),
  });
}
