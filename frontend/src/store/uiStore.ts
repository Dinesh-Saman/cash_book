import { create } from 'zustand';
import { CashBookEntry } from '../types';

interface UIState {
  sidebarOpen: boolean;
  showIncomeForm: boolean;
  showExpenseForm: boolean;
  editingEntry: CashBookEntry | null;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openIncomeForm: () => void;
  openExpenseForm: () => void;
  closeForm: () => void;
  setEditingEntry: (entry: CashBookEntry | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false, // Default closed on mobile, shown on md screens
  showIncomeForm: false,
  showExpenseForm: false,
  editingEntry: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openIncomeForm: () => set({ showIncomeForm: true, showExpenseForm: false }),
  openExpenseForm: () => set({ showExpenseForm: true, showIncomeForm: false }),
  closeForm: () => set({ showIncomeForm: false, showExpenseForm: false, editingEntry: null }),
  setEditingEntry: (entry) => set({ editingEntry: entry, showIncomeForm: entry?.type === 'income', showExpenseForm: entry?.type === 'expense' }),
}));
