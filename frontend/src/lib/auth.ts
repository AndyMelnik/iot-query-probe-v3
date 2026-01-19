/**
 * Authentication utilities for Navixy App Connect integration
 * 
 * Navixy App Connect stores the JWT token in localStorage under 'auth_token'.
 * This module provides utilities to check auth status and make authenticated requests.
 */

// Storage key used by Navixy App Connect middleware
const AUTH_TOKEN_KEY = 'auth_token';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Get the stored auth token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Set the auth token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Remove the auth token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Decode JWT payload without verification (for client-side use only)
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload) return true;
  
  // Add 30 second buffer
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now - 30;
}

/**
 * Check if user is authenticated via Navixy App Connect
 */
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

/**
 * Get current user info from token
 */
export function getCurrentUser(): AuthUser | null {
  const token = getAuthToken();
  if (!token) return null;
  
  const payload = decodeJWT(token);
  if (!payload || isTokenExpired(token)) return null;
  
  return {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
  };
}

/**
 * Create headers with Bearer token for authenticated API requests
 */
export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Fetch wrapper that automatically adds auth headers
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If we get 401, clear token and potentially redirect
  if (response.status === 401) {
    clearAuthToken();
  }
  
  return response;
}

/**
 * Check auth status with the backend
 */
export async function checkAuthStatus(): Promise<{
  authenticated: boolean;
  user?: AuthUser;
  error?: string;
}> {
  try {
    const response = await authFetch('/api/auth/status');
    const data = await response.json();
    
    if (data.authenticated && data.user) {
      return {
        authenticated: true,
        user: data.user,
      };
    }
    
    return {
      authenticated: false,
      error: data.token_error || 'Not authenticated',
    };
  } catch (err) {
    return {
      authenticated: false,
      error: err instanceof Error ? err.message : 'Auth check failed',
    };
  }
}

/**
 * Logout - clear token and notify backend
 */
export async function logout(): Promise<void> {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors during logout
  } finally {
    clearAuthToken();
  }
}

