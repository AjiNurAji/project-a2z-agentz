'use client';
import { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';
import { useTheme, type Theme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 transition-colors hover:bg-[var(--color-neutral-secondary-medium)] focus-ring"
        aria-label={`Theme: ${theme}. Open theme options`}
      >
        {theme === 'light' ? <Sun className="w-5 h-5 text-[var(--color-body-subtle)]" /> : theme === 'system' ? <Monitor className="w-5 h-5 text-[var(--color-body-subtle)]" /> : <Moon className="w-5 h-5 text-[var(--color-body-subtle)]" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-2 z-50">
            <SegmentedControl
              name="theme"
              value={theme}
              onChange={(v) => { setTheme(v as Theme); setOpen(false); }}
              options={[
                { label: 'Light', value: 'light' },
                { label: 'System', value: 'system' },
                { label: 'Dark', value: 'dark' },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

