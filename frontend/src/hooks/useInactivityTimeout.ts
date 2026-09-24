import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import toast from 'react-hot-toast';

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const CHECK_INTERVAL_MS = 10 * 1000; // Periodic check every 10 seconds
const THROTTLE_MS = 5 * 1000; // Throttle activity writes to localStorage (once every 5s)
export const INACTIVITY_STORAGE_KEY = 'cashbook_last_activity';

export function useInactivityTimeout() {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const { language } = useTranslation();
  const lastRecordedRef = useRef<number>(Date.now());

  useEffect(() => {
    // Only track inactivity when the user is logged in
    if (!token) {
      localStorage.removeItem(INACTIVITY_STORAGE_KEY);
      return;
    }

    // Set initial activity timestamp if not present
    if (!localStorage.getItem(INACTIVITY_STORAGE_KEY)) {
      localStorage.setItem(INACTIVITY_STORAGE_KEY, Date.now().toString());
    }

    const recordActivity = () => {
      const now = Date.now();
      // Throttle localStorage writes to prevent excessive overhead
      if (now - lastRecordedRef.current > THROTTLE_MS) {
        lastRecordedRef.current = now;
        localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
      }
    };

    const handleInactivityLogout = () => {
      localStorage.removeItem(INACTIVITY_STORAGE_KEY);
      logout();
      toast(
        language === 'de'
          ? 'Sie wurden aufgrund von 30 Minuten Inaktivität automatisch abgemeldet.'
          : 'You have been automatically logged out due to 30 minutes of inactivity.',
        {
          icon: '⏱️',
          duration: 6000,
        }
      );
    };

    // Periodic check for 30 minutes of inactivity
    const interval = setInterval(() => {
      const lastActiveStr = localStorage.getItem(INACTIVITY_STORAGE_KEY);
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
      const elapsed = Date.now() - lastActive;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        handleInactivityLogout();
      }
    }, CHECK_INTERVAL_MS);

    // Cross-tab synchronization via storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' && !e.newValue) {
        logout();
      }
    };

    // User activity event listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [token, logout, language]);
}
