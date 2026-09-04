import { create } from 'zustand';
import type { CashBookEntry, Summary } from '../types';
import { entriesApi } from '../lib/api';

interface CashbookState {
  entries: CashBookEntry[];
  summary: Summary | null;
  isLoading: boolean;
  selectedYear: number;
  selectedMonth: number | null; // null = show all months for the year
  fetchEntries: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  setSelectedPeriod: (year: number, month: number | null) => void;
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
      const params: Record<string, number> = { year: selectedYear, limit: 500 };
      if (selectedMonth !== null) params.month = selectedMonth;
      const res = await entriesApi.getEntries(params);
      set({ entries: res.data.data.entries });
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
