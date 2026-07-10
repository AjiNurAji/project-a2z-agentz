'use client';
import { useEffect, useState } from 'react';
import { useTheme } from './useTheme';

const STATIC_FALLBACKS = {
  dark: {
    primary: '#42344B',
    secondary: '#6E5A7C',
    glow: '#6E5A7C',
    accent: '#6E5A7C',
    brand: '#42344B',
    success: '#6E9C7E',
    danger: '#C9596A',
    warning: '#D49A5A',
    grid: '#221F2B',
    muted: '#A8A3B0',
  },
  light: {
    primary: '#6B4F8A',
    secondary: '#7E5FA0',
    glow: '#7E5FA0',
    accent: '#7E5FA0',
    brand: '#6B4F8A',
    success: '#2D7A4A',
    danger: '#B91C3A',
    warning: '#A16B1A',
    grid: '#F0EDE8',
    muted: '#6B6380',
  },
} as const;

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<{
    primary: string;
    secondary: string;
    glow: string;
    accent: string;
    brand: string;
    success: string;
    danger: string;
    warning: string;
    grid: string;
    muted: string;
  }>(STATIC_FALLBACKS[resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rootStyle = window.getComputedStyle(document.documentElement);
    
    const getVal = (varName: string, fallback: string): string => {
      const val = rootStyle.getPropertyValue(varName).trim();
      return val || fallback;
    };

    const themeFallbacks = STATIC_FALLBACKS[resolvedTheme];

    const targetColors = {
      primary: getVal('--color-chart-primary', themeFallbacks.primary),
      secondary: getVal('--color-chart-secondary', themeFallbacks.secondary),
      glow: getVal('--color-chart-glow', themeFallbacks.glow),
      accent: getVal('--color-chart-accent', themeFallbacks.accent),
      brand: getVal('--color-chart-brand', themeFallbacks.brand),
      success: getVal('--color-chart-success', themeFallbacks.success),
      danger: getVal('--color-chart-danger', themeFallbacks.danger),
      warning: getVal('--color-chart-warning', themeFallbacks.warning),
      grid: getVal('--color-chart-grid', themeFallbacks.grid),
      muted: getVal('--color-chart-muted', themeFallbacks.muted),
    };

    setColors(targetColors);
  }, [resolvedTheme]);

  return { colors };
}
