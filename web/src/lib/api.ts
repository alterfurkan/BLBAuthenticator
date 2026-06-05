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
    throw new ApiError(data.error || 'Bir hata oluştu', response.status, data.details);
  }

  return data as T;
}

export interface User {
  id: number;
  email: string;
  totpEnabled?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
  requires2fa?: boolean;
  pendingToken?: string;
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

  verify2fa: (pendingToken: string, code: string) =>
    request<AuthResponse>('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, code }),
    }),

  me: () => request<{ user: User & { totpEnabled: boolean } }>('/api/auth/me'),

  setup2fa: () =>
    request<{ secret: string; otpauthUri: string; qrCodeDataUrl: string }>('/api/2fa/setup', {
      method: 'POST',
    }),

  confirm2fa: (code: string) =>
    request<{ success: boolean; message: string }>('/api/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  get2faStatus: () => request<{ enabled: boolean; email: string }>('/api/2fa/status'),

  getCurrentCode: () => request<{ code: string; remaining: number }>('/api/2fa/code'),

  disable2fa: (code: string) =>
    request<{ success: boolean; message: string }>('/api/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
};
