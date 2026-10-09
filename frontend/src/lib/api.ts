import axios from 'axios';
import type { CashBookEntry, BookingRule, Settings, Summary, AuditLog, User } from '../types';
import { resolveBilingualMessage } from './utils';

const apiBaseUrl = (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api` : '/api');
export const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const lang = (localStorage.getItem('app_lang') as 'de' | 'en') || 'de';
  config.headers['Accept-Language'] = lang;
  return config;
});

api.interceptors.response.use(
  response => {
    const lang = (localStorage.getItem('app_lang') as 'de' | 'en') || 'de';
    if (response.data && typeof response.data.message === 'string') {
      response.data.message = resolveBilingualMessage(response.data.message, lang);
    }
    return response;
  },
  error => {
    const lang = (localStorage.getItem('app_lang') as 'de' | 'en') || 'de';
    if (error.response?.data && typeof error.response.data.message === 'string') {
      error.response.data.message = resolveBilingualMessage(error.response.data.message, lang);
    }
    if (error.response?.status === 401) {
      // Do not trigger page reload/redirect when trying to log in, otherwise it wipes the UI error state
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string) => {
    let lastError: any = null;
    const maxRetries = 2; // Up to 2 retries (total 3 attempts) for cold-starts/DB waking up
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await api.post<{ success: boolean; data: { token: string; user: User } }>(
          '/auth/login',
          { email, password },
          { timeout: 25000 }
        );
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;
        // Only retry on network errors, gateway/proxy errors (502/503/504), or cold-start 500 errors
        // Do NOT retry on 401 Unauthorized (wrong password), 400 Bad Request, or 403 Forbidden
        const isRecoverable =
          !err?.response ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          (status === 500 && attempt < maxRetries);

        if (isRecoverable && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  },
  me: () =>
    api.get<{ success: boolean; data: User }>('/auth/me'),
  register: (data: { name: string; email: string; password: string; role: string }) =>
    api.post('/auth/register', data),
};

// ─── Entries ─────────────────────────────────────────────────────────────────
export const entriesApi = {
  getEntries: (params?: { year?: number; month?: number; type?: string; page?: number; limit?: number }) =>
    api.get<{ success: boolean; data: { entries: CashBookEntry[]; totalIncome: number; totalExpense: number; currentBalance: number } }>('/entries', { params }),
  createEntry: (data: FormData) =>
    api.post<{ success: boolean; data: CashBookEntry }>('/entries', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateEntry: (id: string, data: FormData) =>
    api.put<{ success: boolean; data: CashBookEntry }>(`/entries/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteEntry: (id: string) =>
    api.delete<{ success: boolean }>(`/entries/${id}`),
  getSummary: () =>
    api.get<{ success: boolean; data: Summary }>('/entries/summary'),
  getNextVoucherNo: () =>
    api.get<{ success: boolean; data: { nextVoucherNo: string } }>('/entries/next-voucher-no'),
  downloadMergedPDF: async (entryId: string, voucherNo?: string) => {
    const response = await api.get(`/entries/${entryId}/merged-pdf`, { responseType: 'blob' });
    if (response.data && response.data.type === 'application/json') {
      let errorMsg = 'Failed to download PDF';
      try {
        const text = await response.data.text();
        const json = JSON.parse(text);
        errorMsg = json.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }
    const href = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = href;
    const cleanVoucher = voucherNo ? String(voucherNo).replace(/[^a-zA-Z0-9_-]/g, '_') : entryId;
    a.download = `Voucher_${cleanVoucher}_Invoice.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};

// ─── Documents ───────────────────────────────────────────────────────────────
export const documentsApi = {
  upload: (formData: FormData, onProgress?: (pct: number) => void) =>
    api.post<{ success: boolean; data: { path: string; originalName: string; mimeType: string } }>(
      '/documents/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      }
    ),
  uploadChunk: (formData: FormData) =>
    api.post<{ success: boolean; data?: { path: string; originalName: string; mimeType: string }; message?: string }>(
      '/documents/upload-chunk',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    ),
};

// ─── Booking Rules ────────────────────────────────────────────────────────────
export const bookingRulesApi = {
  getAll: () =>
    api.get<{ success: boolean; data: BookingRule[] }>('/booking-rules'),
  create: (data: { name: string; defaultVat?: number }) =>
    api.post<{ success: boolean; data: BookingRule }>('/booking-rules', data),
  update: (id: string, data: { name: string; defaultVat?: number }) =>
    api.put<{ success: boolean; data: BookingRule }>(`/booking-rules/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/booking-rules/${id}`),
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () =>
    api.get<{ success: boolean; data: Settings }>('/settings'),
  update: (data: Partial<Settings>) =>
    api.put<{ success: boolean; data: Settings }>('/settings', data),
  finalizeYear: (year: number, action: 'finalize' | 'unlock') =>
    api.post<{ success: boolean; data: Settings }>('/settings/finalize-year', { year, action }),
  unlockMonth: (year: number, month: number, action: 'unlock' | 'lock') =>
    api.post<{ success: boolean; data: Settings }>('/settings/lock-month', { year, month, action }),
  lockMonth: (year: number, month: number, action: 'lock' | 'unlock') =>
    api.post<{ success: boolean; data: Settings }>('/settings/lock-month', { year, month, action }),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  monthly: (year: number, month: number, startDate?: string, endDate?: string) =>
    api.get('/reports/monthly', { params: { year, month, startDate, endDate } }),
  annual: (year: number) =>
    api.get('/reports/annual', { params: { year } }),
  getMonths: () =>
    api.get<{ success: boolean; data: { year: number; month: number }[] }>('/reports/months'),
};

// ─── Exports (file downloads) ────────────────────────────────────────────────
const downloadFile = async (url: string, filename: string, params?: Record<string, unknown>) => {
  const response = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
};

export const exportsApi = {
  downloadPDF: (year?: number, month?: number, lang?: string, startDate?: string, endDate?: string) => {
    const currentLang = lang || localStorage.getItem('app_lang') || 'de';
    return downloadFile('/exports/pdf', `Kassenbuch_${year ?? 'gesamt'}_${month ?? ''}.pdf`, { year, month, lang: currentLang, startDate, endDate });
  },
  downloadExcel: (year?: number, month?: number, lang?: string, startDate?: string, endDate?: string) => {
    const currentLang = lang || localStorage.getItem('app_lang') || 'de';
    return downloadFile('/exports/excel', `Kassenbuch_${year ?? 'gesamt'}_${month ?? ''}.xlsx`, { year, month, lang: currentLang, startDate, endDate });
  },
  downloadXML: (year?: number, month?: number, lang?: string, startDate?: string, endDate?: string) => {
    const currentLang = lang || localStorage.getItem('app_lang') || 'de';
    return downloadFile('/exports/xml', `Kassenbuch_${year ?? 'gesamt'}_${month ?? ''}.xml`, { year, month, lang: currentLang, startDate, endDate });
  },
  downloadDatev: (year?: number, month?: number, lang?: string, startDate?: string, endDate?: string) => {
    const currentLang = lang || localStorage.getItem('app_lang') || 'de';
    return downloadFile('/exports/datev', `EXTF_Kassenbuch_${year ?? 'gesamt'}.csv`, { year, month, lang: currentLang, startDate, endDate });
  },
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  getAll: () =>
    api.get<{ success: boolean; data: User[] }>('/users'),
  create: (data: { name: string; email: string; password: string; role: string }) =>
    api.post<{ success: boolean; data: User }>('/users', data),
  update: (id: string, data: Partial<User>) =>
    api.put<{ success: boolean; data: User }>(`/users/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/users/${id}`),
};

// ─── Audit Log ───────────────────────────────────────────────────────────────
export const auditApi = {
  getLogs: (params?: { page?: number; limit?: number }) =>
    api.get<{ success: boolean; data: { logs: AuditLog[]; total: number } }>('/audit', { params }),
};

export default api;
