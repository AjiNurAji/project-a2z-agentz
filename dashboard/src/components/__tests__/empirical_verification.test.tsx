import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { useTheme } from '../../hooks/useTheme';
import { useChartColors } from '../../hooks/useChartColors';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { usePreferences } from '../../hooks/usePreferences';
import { SegmentedControl } from '../ui/SegmentedControl';

// Mock matchMedia for useTheme
let mediaQueryListeners: (() => void)[] = [];
let prefersDark = false;

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => {
      return {
        get matches() { return prefersDark; },
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: (event: string, callback: () => void) => {
          if (event === 'change') {
            mediaQueryListeners.push(callback);
          }
        },
        removeEventListener: (event: string, callback: () => void) => {
          if (event === 'change') {
            mediaQueryListeners = mediaQueryListeners.filter((cb) => cb !== callback);
          }
        },
        dispatchEvent: vi.fn(),
      };
    }),
  });
});

beforeEach(() => {
  mediaQueryListeners = [];
  prefersDark = false;
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-density');
  localStorage.clear();
  // Clear any appended elements in body
  document.body.innerHTML = '';
});

const toggleOSTheme = (dark: boolean) => {
  prefersDark = dark;
  act(() => {
    mediaQueryListeners.forEach((cb) => cb());
  });
};

describe('Empirical Verification: Theme System & useTheme', () => {
  it('should initialize resolving to dark when system is dark', () => {
    prefersDark = true;
    const { result } = renderHook(() => useTheme());
    
    // Trigger mount and hydration resolution

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should initialize resolving to light when system is light', () => {
    prefersDark = false;
    const { result } = renderHook(() => useTheme());
    


    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should dynamically update resolvedTheme when OS preference changes and theme is system', () => {
    prefersDark = false;
    const { result } = renderHook(() => useTheme());



    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Simulate OS toggle to dark
    toggleOSTheme(true);

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Simulate OS toggle back to light
    toggleOSTheme(false);

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should NOT update resolvedTheme when OS preference changes but theme is explicitly set to light or dark', () => {
    prefersDark = false;
    const { result } = renderHook(() => useTheme());



    // Set explicitly to light
    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Toggle OS preference to dark (should not affect theme)
    toggleOSTheme(true);

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Set explicitly to dark
    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Toggle OS preference to light (should not affect theme)
    toggleOSTheme(false);

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('Empirical Verification: Chart Colors & useChartColors', () => {
  it('should react dynamically to resolvedTheme changes', () => {
    prefersDark = false;
    const themeHook = renderHook(() => useTheme());
    const colorsHook = renderHook(() => useChartColors());



    // Check light theme colors first
    expect(colorsHook.result.current.colors.primary).toBe('#6B4F8A'); // STATIC_FALLBACKS.light.primary

    // Simulate OS toggle to dark
    toggleOSTheme(true);

    // Run timeout inside useChartColors


    expect(colorsHook.result.current.colors.primary).toBe('#42344B'); // STATIC_FALLBACKS.dark.primary
  });

  it('should read from CSS custom properties if defined', () => {
    prefersDark = false;
    
    // Set custom CSS properties on documentElement
    document.documentElement.style.setProperty('--color-chart-primary', '#111111');
    document.documentElement.style.setProperty('--color-chart-secondary', '#222222');

    const themeHook = renderHook(() => useTheme());
    const colorsHook = renderHook(() => useChartColors());



    expect(colorsHook.result.current.colors.primary).toBe('#111111');
    expect(colorsHook.result.current.colors.secondary).toBe('#222222');

    // Clean up style
    document.documentElement.style.removeProperty('--color-chart-primary');
    document.documentElement.style.removeProperty('--color-chart-secondary');
  });
});

describe('Empirical Verification: Keyboard Shortcuts & useKeyboardShortcut', () => {
  let callback: any;

  beforeEach(() => {
    callback = vi.fn();
  });

  it('should trigger callback when key is pressed outside any form or input', () => {
    renderHook(() => useKeyboardShortcut(['t'], callback));

    const event = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger callback when focus is inside INPUT', () => {
    renderHook(() => useKeyboardShortcut(['t'], callback));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    input.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should NOT trigger callback when focus is inside TEXTAREA', () => {
    renderHook(() => useKeyboardShortcut(['t'], callback));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const event = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    textarea.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should NOT trigger callback when focus is inside contenteditable element', () => {
    renderHook(() => useKeyboardShortcut(['t'], callback));

    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    div.focus();

    const event = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    div.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should NOT trigger callback when focus is inside element with role="textbox"', () => {
    renderHook(() => useKeyboardShortcut(['t'], callback));

    const div = document.createElement('div');
    div.setAttribute('role', 'textbox');
    document.body.appendChild(div);
    div.focus();

    const event = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    div.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should trigger callback when focus is on a SELECT element (known edge case / vulnerability)', () => {
    renderHook(() => useKeyboardShortcut(['t'], callback));

    const select = document.createElement('select');
    document.body.appendChild(select);
    select.focus();

    const event = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    select.dispatchEvent(event);

    // This triggers because SELECT tag name is not explicitly blocked in the hook's check list!
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger callback when focus is on a BUTTON element', () => {
    renderHook(() => useKeyboardShortcut(['t'], callback));

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    const event = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    button.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger callback if shortcuts are globally disabled in localStorage', () => {
    localStorage.setItem('a2z-shortcuts-enabled', 'false');
    renderHook(() => useKeyboardShortcut(['t'], callback));

    const event = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('Empirical Verification: Preferences & usePreferences', () => {
  it('should initialize and set html data-density attribute', () => {
    const { result } = renderHook(() => usePreferences());



    expect(result.current.density).toBe('default');
    expect(document.documentElement.getAttribute('data-density')).toBe('default');

    act(() => {
      result.current.setDensity('compact');
    });

    expect(result.current.density).toBe('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
  });
});

describe('Empirical Verification: SegmentedControl Component', () => {
  const options = [
    { label: 'System Theme', value: 'system' },
    { label: 'Light Theme', value: 'light' },
    { label: 'Dark Theme', value: 'dark' },
  ];

  it('should render correct checked states and trigger onChange on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="system" onChange={onChange} name="theme" />);

    const systemRadio = screen.getByRole('radio', { name: 'System Theme' });
    const lightRadio = screen.getByRole('radio', { name: 'Light Theme' });
    const darkRadio = screen.getByRole('radio', { name: 'Dark Theme' });

    expect(systemRadio).toHaveAttribute('aria-checked', 'true');
    expect(lightRadio).toHaveAttribute('aria-checked', 'false');
    expect(darkRadio).toHaveAttribute('aria-checked', 'false');

    await user.click(lightRadio);
    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('should support keyboard navigation using arrows and space/enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="system" onChange={onChange} name="theme" />);

    const systemRadio = screen.getByRole('radio', { name: 'System Theme' });
    systemRadio.focus();

    // Arrow Right to go to next option
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('light');

    // Arrow Down to go to next option (circular, from light to dark)
    // First rerender with new value to mock parents update
    screen.queryAllByRole('radio').forEach((radio) => radio.remove());
    render(<SegmentedControl options={options} value="light" onChange={onChange} name="theme" />);
    const lightRadio = screen.getByRole('radio', { name: 'Light Theme' });
    lightRadio.focus();

    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
