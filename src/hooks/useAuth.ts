'use client';

import { useAuthStore, UserProfile } from '@/stores/auth';
import { apiFetch, setAccessToken, getAccessToken } from '@/lib/api/client';
import { useCallback } from 'react';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setInitialized = useAuthStore((state) => state.setInitialized);

  const fetchProfile = useCallback(async (token: string): Promise<UserProfile | null> => {
    setAccessToken(token);
    const response = await apiFetch<UserProfile>('/auth/me');
    if (response.success && response.data) {
      setAuth(response.data);
      return response.data;
    }
    setAccessToken(null);
    clearAuth();
    return null;
  }, [setAuth, clearAuth]);

  const initializeAuth = useCallback(async () => {
    if (isInitialized) return;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data?.accessToken) {
          await fetchProfile(json.data.accessToken);
        } else {
          clearAuth();
        }
      } else {
        clearAuth();
      }
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [isInitialized, fetchProfile, clearAuth, setLoading, setInitialized]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await response.json();
      if (response.ok && json.success && json.data?.accessToken) {
        const profile = await fetchProfile(json.data.accessToken);
        if (profile) {
          return { success: true, message: 'Logged in successfully.' };
        }
        return { success: false, message: 'Failed to fetch user profile.' };
      }
      return { success: false, message: json.message || 'Login failed.' };
    } catch {
      return { success: false, message: 'Network connection failed.' };
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, setLoading]);

  const register = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    role: string
  ): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, role }),
      });
      const json = await response.json();
      if (response.ok && json.success && json.data?.accessToken) {
        const profile = await fetchProfile(json.data.accessToken);
        if (profile) {
          return { success: true, message: 'Registered and logged in successfully.' };
        }
        return { success: false, message: 'Failed to retrieve user profile.' };
      }
      return { success: false, message: json.message || 'Registration failed.' };
    } catch {
      return { success: false, message: 'Network connection failed.' };
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, setLoading]);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const currentToken = getAccessToken();
      setAccessToken(null);
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {},
      });
    } catch (e) {
      console.error('Logout request failed:', e);
    } finally {
      setAccessToken(null);
      clearAuth();
      setLoading(false);
    }
  }, [clearAuth, setLoading]);

  return {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    initializeAuth,
    login,
    register,
    logout,
  };
}
