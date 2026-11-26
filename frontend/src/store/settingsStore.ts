import { create } from 'zustand';
import type { EnabledModules, Settings } from '../types';
import { settingsApi } from '../lib/api';

interface SettingsState {
  settings: Settings | null;
  enabledModules: EnabledModules;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateEnabledModules: (modules: Partial<EnabledModules>) => Promise<void>;
}

export const DEFAULT_ENABLED_MODULES: EnabledModules = {
  cashBook: true,
  monthlyReports: true,
  annualReport: true,
  bank: true,
  invoices: true,
  settings: true,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  enabledModules: DEFAULT_ENABLED_MODULES,
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const res = await settingsApi.get();
      if (res.data?.data) {
        const s = res.data.data;
        const modules = {
          ...DEFAULT_ENABLED_MODULES,
          ...(s.enabledModules || {}),
          // Mandatory modules are strictly locked to true
          cashBook: true,
          settings: true,
        };
        set({ settings: s, enabledModules: modules });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  updateEnabledModules: async (partialModules) => {
    const current = get().enabledModules;
    const newModules: EnabledModules = {
      ...current,
      ...partialModules,
      // Mandatory modules remain enabled
      cashBook: true,
      settings: true,
    };

    set({ enabledModules: newModules });

    try {
      const res = await settingsApi.update({
        enabledModules: newModules,
      });
      if (res.data?.data) {
        set({
          settings: res.data.data,
          enabledModules: {
            ...DEFAULT_ENABLED_MODULES,
            ...(res.data.data.enabledModules || {}),
            cashBook: true,
            settings: true,
          },
        });
      }
    } catch (err) {
      console.error('Failed to update enabled modules:', err);
      // Revert on failure
      set({ enabledModules: current });
      throw err;
    }
  },
}));
