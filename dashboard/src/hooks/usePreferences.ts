'use client';
import { useState, useEffect, useCallback } from 'react';

export type Density = 'default' | 'compact';

export function usePreferences() {
  const [density, setDensityState] = useState<Density>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('a2z-density') as Density | null;
    const initialDensity: Density = stored === 'default' || stored === 'compact' ? stored : 'default';
    
    setMounted(true);
    setDensityState(initialDensity);
  }, []);

  // Update data-density attribute on document element dynamically
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-density', density);
  }, [density, mounted]);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    if (typeof window !== 'undefined') {
      localStorage.setItem('a2z-density', d);
    }
  }, []);

  return {
    density: mounted ? density : 'default',
    setDensity,
  };
}
