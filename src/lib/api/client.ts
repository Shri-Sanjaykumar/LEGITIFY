let memoryToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  memoryToken = token;
};

export const getAccessToken = () => memoryToken;

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors: string[];
  request_id: string;
}

const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
};

// Generates a random UUID v4 for request tracing
const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const headers = new Headers(options.headers || {});
  
  // Attach Access Token if available in memory
  if (memoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }

  // Set Request ID for tracing
  if (!headers.has('X-Request-ID')) {
    headers.set('X-Request-ID', generateUuid());
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, mergedOptions);
  } catch (error) {
    // Network retry (1 time)
    try {
      response = await fetch(url, mergedOptions);
    } catch {
      return {
        success: false,
        message: 'Network connection failed.',
        data: null as T,
        errors: [(error as Error).message || 'Failed to fetch'],
        request_id: headers.get('X-Request-ID') || '',
      };
    }
  }

  // Handle Token Refresh on 401 Unauthorized
  if (response.status === 401 && memoryToken && !endpoint.includes('/auth/')) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry request with new token
      headers.set('Authorization', `Bearer ${memoryToken}`);
      try {
        response = await fetch(url, { ...options, headers });
      } catch (retryError) {
        return {
          success: false,
          message: 'Network connection failed after token refresh retry.',
          data: null as T,
          errors: [(retryError as Error).message || 'Failed to fetch'],
          request_id: headers.get('X-Request-ID') || '',
        };
      }
    }
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return {
      success: response.ok,
      message: response.statusText,
      data: null as T,
      errors: [`HTTP error: ${response.status}`],
      request_id: headers.get('X-Request-ID') || '',
    };
  }

  // If response matches standard API envelope, return it
  if (json && typeof json === 'object' && 'success' in json) {
    return json as ApiResponse<T>;
  }

  const jsonObject = (json || {}) as Record<string, unknown>;

  // Fallback for standard endpoints that might not conform
  return {
    success: response.ok,
    message: (jsonObject.message as string) || response.statusText,
    data: (jsonObject.data !== undefined ? jsonObject.data : json) as T,
    errors: (jsonObject.errors as string[]) || (response.ok ? [] : [(jsonObject.detail as string) || 'Request failed']),
    request_id: (jsonObject.request_id as string) || headers.get('X-Request-ID') || '',
  };
}

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    // Call the local Next.js Route Handler which has access to HttpOnly cookie
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) {
      setAccessToken(null);
      return false;
    }
    const json = await res.json() as { success: boolean; data?: { accessToken?: string } };
    if (json.success && json.data?.accessToken) {
      setAccessToken(json.data.accessToken);
      return true;
    }
    setAccessToken(null);
    return false;
  } catch {
    setAccessToken(null);
    return false;
  }
}
