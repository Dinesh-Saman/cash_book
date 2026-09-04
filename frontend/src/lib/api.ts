import axios from 'axios';
import type { CashBookEntry, BookingRule, Settings, Summary, AuditLog, User } from '../types';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
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
  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: { token: string; user: User } }>('/auth/login', { email, password }),
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
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  monthly: (year: number, month: number) =>
    api.get('/reports/monthly', { params: { year, month } }),
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
  downloadPDF: (year?: number, month?: number, lang?: string) => {
    const currentLang = lang || localStorage.getItem('app_lang') || 'de';
    return downloadFile('/exports/pdf', `Kassenbuch_${year ?? 'gesamt'}_${month ?? ''}.pdf`, { year, month, lang: currentLang });
  },
  downloadExcel: (year?: number, month?: number, lang?: string) => {
    const currentLang = lang || localStorage.getItem('app_lang') || 'de';
    return downloadFile('/exports/excel', `Kassenbuch_${year ?? 'gesamt'}_${month ?? ''}.xlsx`, { year, month, lang: currentLang });
  },
  downloadXML: (year?: number, month?: number, lang?: string) => {
    const currentLang = lang || localStorage.getItem('app_lang') || 'de';
    return downloadFile('/exports/xml', `Kassenbuch_${year ?? 'gesamt'}_${month ?? ''}.xml`, { year, month, lang: currentLang });
  },
  downloadDatev: (year?: number, month?: number, lang?: string) => {
    const currentLang = lang || localStorage.getItem('app_lang') || 'de';
    return downloadFile('/exports/datev', `EXTF_Kassenbuch_${year ?? 'gesamt'}.csv`, { year, month, lang: currentLang });
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
