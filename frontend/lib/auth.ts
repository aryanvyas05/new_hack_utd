/**
 * Authentication utilities for frontend
 * Handles JWT tokens, MFA, and secure session management
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface User {
  email: string;
  fullName: string;
  role: 'admin' | 'analyst' | 'reviewer' | 'viewer';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user?: User;
  tokens?: AuthTokens;
  requiresMfa?: boolean;
  tempToken?: string;
  mfaQrCode?: string;
  mfaSecret?: string;
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'veritas_access_token';
const REFRESH_TOKEN_KEY = 'veritas_refresh_token';
const USER_KEY = 'veritas_user';

/**
 * Register new user
 */
export async function register(
  email: string,
  password: string,
  fullName: string,
  role: string = 'viewer'
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, role })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  return response.json();
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();

  // If MFA not required, store tokens
  if (!data.requiresMfa && data.accessToken) {
    storeTokens(data.accessToken, data.refreshToken);
    storeUser(data.user);
  }

  return data;
}

/**
 * Verify MFA code
 */
export async function verifyMfa(tempToken: string, mfaCode: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/verify-mfa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tempToken, mfaCode })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'MFA verification failed');
  }

  const data = await response.json();

  // Store tokens after successful MFA
  if (data.accessToken) {
    storeTokens(data.accessToken, data.refreshToken);
    storeUser(data.user);
  }

  return data;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      // Refresh token expired, logout
      logout();
      return null;
    }

    const data = await response.json();
    storeAccessToken(data.accessToken);
    return data.accessToken;
  } catch (error) {
    logout();
    return null;
  }
}

/**
 * Logout user
 */
export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/login';
  }
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Get access token
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Check if user has required role
 */
export function hasRole(requiredRole: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;

  const roleHierarchy = ['viewer', 'reviewer', 'analyst', 'admin'];
  const userRoleIndex = roleHierarchy.indexOf(user.role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

  return userRoleIndex >= requiredRoleIndex;
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = getAccessToken();

  // Try to refresh if no token
  if (!token) {
    token = await refreshAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
  }

  // Add authorization header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  let response = await fetch(url, { ...options, headers });

  // If 401, try to refresh token once
  if (response.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      response = await fetch(url, { ...options, headers });
    }
  }

  return response;
}

// Private helper functions

function storeTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function storeAccessToken(accessToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

function storeUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
