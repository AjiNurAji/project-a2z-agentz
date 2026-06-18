'use client';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('a2z-theme') as 'light' | 'dark' | null;
    setTheme(stored === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('a2z-theme', next);
  };

  return (
    <button
      onClick={toggle}
      className="rounded-lg p-2 transition-colors hover:bg-[var(--color-neutral-secondary-medium)] focus-ring"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={theme}
          initial={{ rotate: -90, scale: 0, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="block"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-[var(--color-body-subtle)]" />
          ) : (
            <Moon className="w-5 h-5 text-[var(--color-body-subtle)]" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
