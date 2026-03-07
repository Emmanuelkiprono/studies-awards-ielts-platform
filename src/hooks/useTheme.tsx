import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'purple' | 'blue' | 'green';

type ThemeContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  accent: AccentColor;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
};

const THEME_STORAGE_KEY = 'ui.themeMode';
const ACCENT_STORAGE_KEY = 'ui.accent';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isAccentColor(value: unknown): value is AccentColor {
  return value === 'purple' || value === 'blue' || value === 'green';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(THEME_STORAGE_KEY) : null;
    return isThemeMode(saved) ? saved : 'system';
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(ACCENT_STORAGE_KEY) : null;
    return isAccentColor(saved) ? saved : 'purple';
  });

  const resolvedTheme = useMemo(() => {
    return themeMode === 'system' ? getSystemTheme() : themeMode;
  }, [themeMode]);

  const applyToDom = useCallback(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = accent;
  }, [accent, resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  }, [accent]);

  useEffect(() => {
    applyToDom();
  }, [applyToDom]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = () => {
      if (themeMode === 'system') applyToDom();
    };

    if (media.addEventListener) media.addEventListener('change', handler);
    else media.addListener(handler);

    return () => {
      if (media.removeEventListener) media.removeEventListener('change', handler);
      else media.removeListener(handler);
    };
  }, [applyToDom, themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const setAccent = useCallback((nextAccent: AccentColor) => {
    setAccentState(nextAccent);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      accent,
      setThemeMode,
      setAccent,
    }),
    [accent, resolvedTheme, setAccent, setThemeMode, themeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
