import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'creator-dashboard-theme';
const VALID_PREFERENCES = ['light', 'dark', 'system'];
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

const ThemeContext = createContext(null);

/**
 * Resolves the active theme from a preference and system dark mode state.
 * Exported for testing purposes.
 */
export function resolveActiveTheme(preference, systemDark) {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemDark ? 'dark' : 'light';
}

/**
 * Cycles through preferences: light → dark → system → light
 * Exported for testing purposes.
 */
export function cyclePreference(current) {
  const cycle = { light: 'dark', dark: 'system', system: 'light' };
  return cycle[current] || 'light';
}

/**
 * Reads the stored preference from localStorage.
 * Returns 'system' if unavailable or invalid.
 */
function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (VALID_PREFERENCES.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable (private browsing, SecurityError)
  }
  return 'system';
}

/**
 * Applies or removes the 'dark' class on <html> based on the active theme.
 */
function applyThemeClass(activeTheme) {
  if (activeTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => readStoredPreference());
  const [activeTheme, setActiveTheme] = useState(() => {
    const pref = readStoredPreference();
    const systemDark = window.matchMedia(MEDIA_QUERY).matches;
    return resolveActiveTheme(pref, systemDark);
  });

  // Apply theme class whenever activeTheme changes
  useEffect(() => {
    applyThemeClass(activeTheme);
  }, [activeTheme]);

  // Listen to system preference changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;

    const mql = window.matchMedia(MEDIA_QUERY);

    const handleChange = (e) => {
      setActiveTheme(e.matches ? 'dark' : 'light');
    };

    mql.addEventListener('change', handleChange);

    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, [preference]);

  const setPreference = useCallback((newPref) => {
    if (!VALID_PREFERENCES.includes(newPref)) return;

    setPreferenceState(newPref);

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, newPref);
    } catch {
      // localStorage unavailable — preference still works in-session
    }

    // Resolve and apply the new active theme
    const systemDark = window.matchMedia(MEDIA_QUERY).matches;
    const resolved = resolveActiveTheme(newPref, systemDark);
    setActiveTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, activeTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
