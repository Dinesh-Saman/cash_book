import { create } from 'zustand';
import type { CashBookEntry, Summary } from '../types';
import { entriesApi } from '../lib/api';

interface CashbookState {
  entries: CashBookEntry[];
  summary: Summary | null;
  isLoading: boolean;
  selectedYear: number;
  selectedMonth: number; // 1 - 12
  fetchEntries: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  setSelectedPeriod: (year: number, month: number) => void;
  deleteEntry: (id: string) => Promise<void>;
}

export const useCashbookStore = create<CashbookState>((set, get) => ({
  entries: [],
  summary: { currentBalance: 0, totalIncome: 0, totalExpense: 0, openingBalance: 0 },
  isLoading: false,
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1,

  fetchEntries: async () => {
    set({ isLoading: true });
    try {
      const { selectedYear, selectedMonth } = get();
      const monthToFetch = selectedMonth || new Date().getMonth() + 1;
      const params: Record<string, number> = { year: selectedYear, month: monthToFetch, limit: 500 };
      const res = await entriesApi.getEntries(params);
      const rawEntries = res.data.data.entries || [];
      const sortedEntries = [...rawEntries].sort((a, b) => {
        const vA = (a.voucherNo || '').trim();
        const vB = (b.voucherNo || '').trim();
        if (vA && !vB) return -1;
        if (!vA && vB) return 1;
        if (vA && vB) {
          const cmp = vA.localeCompare(vB, undefined, { numeric: true, sensitivity: 'base' });
          if (cmp !== 0) return cmp;
        }
        const timeA = new Date(a.date || 0).getTime();
        const timeB = new Date(b.date || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      set({ entries: sortedEntries });
    } catch (err) {
      console.error('fetchEntries error', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSummary: async () => {
    try {
      const res = await entriesApi.getSummary();
      set({ summary: res.data.data });
    } catch (err) {
      console.error('fetchSummary error', err);
    }
  },

  setSelectedPeriod: (year, month) => {
    set({ selectedYear: year, selectedMonth: month });
    get().fetchEntries();
    get().fetchSummary();
  },

  deleteEntry: async (id: string) => {
    await entriesApi.deleteEntry(id);
    await get().fetchEntries();
    await get().fetchSummary();
  },
}));
