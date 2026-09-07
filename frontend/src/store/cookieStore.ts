import { create } from 'zustand';

export interface CookiePreferences {
  necessary: boolean; // always true
  functional: boolean;
  analytics: boolean;
  timestamp?: string;
  hasConsented: boolean;
}

interface CookieState {
  preferences: CookiePreferences;
  isBannerOpen: boolean;
  isModalOpen: boolean;
  setBannerOpen: (open: boolean) => void;
  setModalOpen: (open: boolean) => void;
  acceptAll: () => void;
  acceptEssentialOnly: () => void;
  savePreferences: (prefs: { functional: boolean; analytics: boolean }) => void;
  resetConsent: () => void;
}

const STORAGE_KEY = 'cashbook_cookie_consent';

const loadPreferences = (): CookiePreferences => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        necessary: true,
        functional: parsed.functional ?? false,
        analytics: parsed.analytics ?? false,
        timestamp: parsed.timestamp || new Date().toISOString(),
        hasConsented: true,
      };
    }
  } catch {
    // fallback
  }
  return {
    necessary: true,
    functional: false,
    analytics: false,
    hasConsented: false,
  };
};

export const useCookieStore = create<CookieState>((set) => {
  const initial = loadPreferences();

  return {
    preferences: initial,
    isBannerOpen: !initial.hasConsented,
    isModalOpen: false,

    setBannerOpen: (open) => set({ isBannerOpen: open }),
    setModalOpen: (open) => set({ isModalOpen: open }),

    acceptAll: () => {
      const prefs: CookiePreferences = {
        necessary: true,
        functional: true,
        analytics: true,
        timestamp: new Date().toISOString(),
        hasConsented: true,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      set({ preferences: prefs, isBannerOpen: false, isModalOpen: false });
    },

    acceptEssentialOnly: () => {
      const prefs: CookiePreferences = {
        necessary: true,
        functional: false,
        analytics: false,
        timestamp: new Date().toISOString(),
        hasConsented: true,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      set({ preferences: prefs, isBannerOpen: false, isModalOpen: false });
    },

    savePreferences: ({ functional, analytics }) => {
      const prefs: CookiePreferences = {
        necessary: true,
        functional,
        analytics,
        timestamp: new Date().toISOString(),
        hasConsented: true,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      set({ preferences: prefs, isBannerOpen: false, isModalOpen: false });
    },

    resetConsent: () => {
      localStorage.removeItem(STORAGE_KEY);
      const resetPrefs: CookiePreferences = {
        necessary: true,
        functional: false,
        analytics: false,
        hasConsented: false,
      };
      set({ preferences: resetPrefs, isBannerOpen: true });
    },
  };
});
