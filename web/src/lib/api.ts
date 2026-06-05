const API_BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string }).error || (data as { message?: string }).message || 'Bir hata oluştu',
      response.status,
      (data as { details?: unknown }).details,
    );
  }

  return data as T;
}

export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TotpEntry {
  id: number;
  label: string;
  issuer: string;
  createdAt: string;
}

export interface TotpEntryWithCode extends TotpEntry {
  code: string;
  remaining: number;
}

export const api = {
  health: () => request<{ status: string; database: string }>('/api/health'),

  register: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  listEntries: () => request<{ entries: TotpEntry[] }>('/api/entries'),

  listEntriesWithCodes: () =>
    request<{ entries: TotpEntryWithCode[]; remaining: number }>('/api/entries/codes'),

  generateEntry: (label: string, issuer: string) =>
    request<{ secret: string; otpauthUri: string; qrCodeDataUrl: string }>('/api/entries/generate', {
      method: 'POST',
      body: JSON.stringify({ label, issuer }),
    }),

  createEntry: (label: string, issuer: string, secret: string, code: string) =>
    request<{ entry: TotpEntry }>('/api/entries', {
      method: 'POST',
      body: JSON.stringify({ label, issuer, secret, code }),
    }),

  deleteEntry: (id: number) =>
    request<{ success: boolean }>(`/api/entries/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    }),
};
