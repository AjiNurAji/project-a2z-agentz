'use client';
import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('a2z-theme') as Theme | null;
    const initialTheme: Theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    
    setMounted(true);
    setThemeState(initialTheme);
  }, []);

  // Update resolvedTheme and document attribute whenever theme changes (or prefers-color-scheme changes)
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const isDark = mediaQuery.matches;
        const resolved = isDark ? 'dark' : 'light';
        setResolvedTheme(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
      } else {
        setResolvedTheme(theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
    };

    handleChange(); // initial run

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme, mounted]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof window !== 'undefined') {
      localStorage.setItem('a2z-theme', t);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      let next: Theme;
      if (current === 'light') next = 'dark';
      else if (current === 'dark') next = 'system';
      else next = 'light';
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('a2z-theme', next);
      }
      return next;
    });
  }, []);

  return {
    theme: mounted ? theme : 'system',
    resolvedTheme,
    toggleTheme,
    setTheme,
  };
}

