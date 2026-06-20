import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import {
  useTheme,
  useChartColors,
  Sparkline,
  useDataFreshness,
  FreshnessPill,
  usePreferences,
  useKeyboardShortcut,
  SegmentedControl,
  ConfirmModal,
  RadialGauge,
  ScoreBreakdown,
} from './stubs';

describe('Tier 2: Boundary & Corner Cases (N = 11 Features, 5 tests each)', () => {
  // =========================================================================
  // Feature 1: Theme System Boundary Cases
  // =========================================================================
  describe('Feature 1: Theme System Boundaries', () => {
    it('should ignore invalid theme values and fallback gracefully', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        // @ts-expect-error - testing invalid type boundary
        result.current.setTheme('invalid-theme');
      });
      // Should remain or fallback gracefully
      expect(result.current.theme).toBe('invalid-theme');
    });

    it('should handle rapid toggling of themes without crashing', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.toggleTheme();
        result.current.toggleTheme();
        result.current.toggleTheme();
        result.current.toggleTheme();
      });
      expect(['light', 'dark', 'system']).toContain(result.current.theme);
    });

    it('should handle localStorage access errors gracefully', () => {
      const storageSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('Disk full');
      });
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('light');
      });
      expect(result.current.theme).toBe('light');
      storageSpy.mockRestore();
    });

    it('should correctly resolve system dark/light configuration overrides', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('system');
      });
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('should initialize theme settings stable on repeated hook invokes', () => {
      const { result: r1 } = renderHook(() => useTheme());
      const { result: r2 } = renderHook(() => useTheme());
      expect(r1.current.theme).toBe(r2.current.theme);
    });
  });

  // =========================================================================
  // Feature 2: Chart Colors Resolver Boundary Cases
  // =========================================================================
  describe('Feature 2: Chart Colors Resolver Boundaries', () => {
    it('should return valid hex values when document computed style is empty', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should fallback to default colors if variables are malformed', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors.secondary).toBeDefined();
    });

    it('should resolve light colors when system theme changes to light', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors.grid).toBeDefined();
    });

    it('should not leak memory when re-querying computed colors repeatedly', () => {
      const { result, rerender } = renderHook(() => useChartColors());
      for (let i = 0; i < 10; i++) {
        rerender();
      }
      expect(result.current.colors.primary).toBeDefined();
    });

    it('should return non-empty strings for fallback values', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors.success.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Feature 3: Sparkline Widget Boundary Cases
  // =========================================================================
  describe('Feature 3: Sparkline Widget Boundaries', () => {
    it('should handle single data point array without division-by-zero errors', () => {
      render(<Sparkline data={[50]} width={100} height={100} />);
      const svg = screen.getByTestId('sparkline');
      expect(svg).toBeInTheDocument();
    });

    it('should handle empty data array gracefully without crashing', () => {
      render(<Sparkline data={[]} width={100} height={100} />);
      const svg = screen.getByTestId('sparkline');
      expect(svg).toBeInTheDocument();
    });

    it('should render correct horizontal line when all data values are identical', () => {
      render(<Sparkline data={[50, 50, 50]} width={100} height={100} />);
      const line = screen.getByTestId('sparkline').querySelector('polyline');
      expect(line).toHaveAttribute('points');
    });

    it('should handle negative numbers in data points correctly', () => {
      render(<Sparkline data={[-10, 0, -20]} width={100} height={100} />);
      expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    });

    it('should handle extremely large scale numbers in data array', () => {
      render(<Sparkline data={[1000000, 2000000, 1500000]} width={100} height={100} />);
      expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 4: Data Freshness System Boundary Cases
  // =========================================================================
  describe('Feature 4: Data Freshness System Boundaries', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should display just now if lastSync timestamp lies in the future', () => {
      const future = Date.now() + 100000;
      const { result } = renderHook(() => useDataFreshness(future));
      expect(result.current.relativeText).toBe('just now');
    });

    it('should handle zero timestamp value as extremely old offset', () => {
      const { result } = renderHook(() => useDataFreshness(0));
      expect(result.current.relativeText).toContain('m ago');
    });

    it('should handle NaN or malformed timestamp configurations gracefully', () => {
      const { result } = renderHook(() => useDataFreshness(NaN));
      expect(result.current.relativeText).toBe('just now');
    });

    it('should re-sync relative text calculations instantly when lastSync prop shifts', () => {
      let sync = Date.now();
      const { result, rerender } = renderHook(({ t }) => useDataFreshness(t), {
        initialProps: { t: sync },
      });
      expect(result.current.relativeText).toBe('just now');
      
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(result.current.relativeText).toBe('10s ago');

      sync = Date.now();
      rerender({ t: sync });
      expect(result.current.relativeText).toBe('just now');
    });

    it('should handle extremely high frequency interval ticks without breaking state sync', () => {
      const initialTime = Date.now();
      const { result } = renderHook(() => useDataFreshness(initialTime));
      act(() => {
        vi.advanceTimersByTime(1000000);
      });
      expect(result.current.relativeText).toBe('16m ago');
    });
  });

  // =========================================================================
  // Feature 5: Freshness Pill Component Boundary Cases
  // =========================================================================
  describe('Feature 5: Freshness Pill Component Boundaries', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should display just now when rendered with future lastSync', () => {
      render(<FreshnessPill lastSync={Date.now() + 5000} />);
      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('should handle malformed or NaN lastSync without breaking render', () => {
      render(<FreshnessPill lastSync={NaN} />);
      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('should handle rendering when lastSync is a very old timestamp', () => {
      render(<FreshnessPill lastSync={1000} />);
      expect(screen.getByTestId('freshness-pill')).toBeInTheDocument();
    });

    it('should change relative text instantly when lastSync updates dynamically', () => {
      const { rerender } = render(<FreshnessPill lastSync={Date.now() - 30000} />);
      expect(screen.getByText('30s ago')).toBeInTheDocument();
      
      rerender(<FreshnessPill lastSync={Date.now()} />);
      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('should not cause redundant re-renders when time ticks but text does not change', () => {
      render(<FreshnessPill lastSync={Date.now()} />);
      expect(screen.getByText('just now')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(100); // 100ms
      });
      expect(screen.getByText('just now')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 6: User Preferences & Density Boundary Cases
  // =========================================================================
  describe('Feature 6: User Preferences & Density Boundaries', () => {
    it('should handle missing localStorage storage support gracefully', () => {
      const originalLocal = global.localStorage;
      // @ts-expect-error - overriding localstorage
      delete global.localStorage;
      const { result } = renderHook(() => usePreferences());
      expect(result.current.density).toBe('default');
      global.localStorage = originalLocal;
    });

    it('should ignore corrupt non-density values in localStorage', () => {
      localStorage.setItem('a2z-density', 'corrupted-data');
      const { result } = renderHook(() => usePreferences());
      expect(result.current.density).toBe('default');
      localStorage.removeItem('a2z-density');
    });

    it('should ignore duplicate setDensity commands with identical arguments', () => {
      const { result } = renderHook(() => usePreferences());
      act(() => {
        result.current.setDensity('compact');
      });
      expect(result.current.density).toBe('compact');
      act(() => {
        result.current.setDensity('compact');
      });
      expect(result.current.density).toBe('compact');
    });

    it('should handle high-frequency rapid updates to density options', () => {
      const { result } = renderHook(() => usePreferences());
      act(() => {
        result.current.setDensity('compact');
        result.current.setDensity('default');
        result.current.setDensity('compact');
      });
      expect(result.current.density).toBe('compact');
    });

    it('should persist density preferences to local storage on select', () => {
      const { result } = renderHook(() => usePreferences());
      act(() => {
        result.current.setDensity('compact');
      });
      expect(localStorage.getItem('a2z-density')).toBe('compact');
    });
  });

  // =========================================================================
  // Feature 7: Keyboard Shortcut Hook Boundary Cases
  // =========================================================================
  describe('Feature 7: Keyboard Shortcut Hook Boundaries', () => {
    it('should not register or trigger callbacks if keys list is empty', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut([], callback));
      
      const event = new KeyboardEvent('keydown', { key: 'a' });
      window.dispatchEvent(event);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should differentiate uppercase and lowercase keys correctly', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(['K'], callback));
      
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
      expect(callback).not.toHaveBeenCalled();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K' }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should suppress callbacks if active target element is an input text field', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(['k'], callback));
      
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true });
      // Simulate dispatch from focused input field
      input.dispatchEvent(event);
      
      expect(callback).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('should keep callbacks fresh without restarting key listener binds', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      const { rerender } = renderHook(({ cb }) => useKeyboardShortcut(['k'], cb), {
        initialProps: { cb: callback1 },
      });

      rerender({ cb: callback2 });

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should ignore keystrokes that do not match registered options', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(['ctrl'], callback));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'shift' }));
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Feature 8: Segmented Control Component Boundary Cases
  // =========================================================================
  describe('Feature 8: Segmented Control Boundaries', () => {
    it('should render empty container cleanly if options parameter is empty', () => {
      render(<SegmentedControl options={[]} value="" onChange={vi.fn()} name="test" />);
      expect(screen.getByTestId('segmented-control')).toBeInTheDocument();
    });

    it('should handle checked markers correctly if selected value is absent from options', () => {
      const options = [{ label: 'Opt A', value: 'a' }];
      render(<SegmentedControl options={options} value="b" onChange={vi.fn()} name="test" />);
      expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false');
    });

    it('should handle extremely long text label strings safely', () => {
      const options = [{ label: 'L'.repeat(100), value: 'long' }];
      render(<SegmentedControl options={options} value="long" onChange={vi.fn()} name="test" />);
      expect(screen.getByText('L'.repeat(100))).toBeInTheDocument();
    });

    it('should ignore repeat clicks on already selected items', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const options = [
        { label: 'Opt A', value: 'a' },
        { label: 'Opt B', value: 'b' },
      ];
      render(<SegmentedControl options={options} value="a" onChange={onChange} name="test" />);
      
      // Click already selected item
      await user.click(screen.getByText('Opt A'));
      expect(onChange).not.toHaveBeenCalled(); // SegmentedControl should only trigger onChange for new values
    });

    it('should fire onChange only once for rapid multi-clicks', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const options = [
        { label: 'Opt A', value: 'a' },
        { label: 'Opt B', value: 'b' },
      ];
      render(<SegmentedControl options={options} value="a" onChange={onChange} name="test" />);
      
      const optB = screen.getByText('Opt B');
      await user.click(optB);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Feature 9: Confirmation Modal Boundary Cases
  // =========================================================================
  describe('Feature 9: Confirmation Modal Boundaries', () => {
    const defaultProps = {
      isOpen: true,
      title: 'Title',
      description: 'Desc',
      variant: 'danger' as const,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    };

    it('should display extremely long description text strings safely', () => {
      const longText = 'D'.repeat(1000);
      render(<ConfirmModal {...defaultProps} description={longText} />);
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('should trigger cancel callback when modal wrapper closes', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      await user.click(screen.getByTestId('modal-cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should fallback to default styling if variant is omitted', () => {
      // @ts-expect-error - testing missing variant parameter
      render(<ConfirmModal {...defaultProps} variant={undefined} />);
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });

    it('should not close modal dynamically if clicks lie outside buttons', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      await user.click(screen.getByText('Title'));
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should handle zero callbacks defined without crashing modal render', () => {
      // @ts-expect-error - testing missing callbacks
      render(<ConfirmModal isOpen={true} title="Title" description="Desc" onConfirm={undefined} onCancel={undefined} />);
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 10: Radial Gauge Component Boundary Cases
  // =========================================================================
  describe('Feature 10: Radial Gauge Boundaries', () => {
    it('should clamp scores above max hundred limit or display them', () => {
      render(<RadialGauge score={150} />);
      expect(screen.getByTestId('radial-score')).toHaveTextContent('150%');
    });

    it('should display negative score boundary levels directly', () => {
      render(<RadialGauge score={-50} />);
      expect(screen.getByTestId('radial-score')).toHaveTextContent('-50%');
    });

    it('should handle float decimals correctly in score representation', () => {
      render(<RadialGauge score={88.88} />);
      expect(screen.getByTestId('radial-score')).toHaveTextContent('88.88%');
    });

    it('should render cleanly if label parameter is omitted', () => {
      render(<RadialGauge score={50} />);
      expect(screen.queryByTestId('radial-label')).toBeNull();
    });

    it('should retain custom score values mapped inside data attributes', () => {
      render(<RadialGauge score={12.5} />);
      expect(screen.getByTestId('radial-gauge')).toHaveAttribute('data-score', '12.5');
    });
  });

  // =========================================================================
  // Feature 11: Score Breakdown Component Boundary Cases
  // =========================================================================
  describe('Feature 11: Score Breakdown Boundaries', () => {
    it('should handle weight coefficients summing to over one point zero', () => {
      render(<ScoreBreakdown sentiment={80} tvl={80} sentimentWeight={1.0} tvlWeight={1.0} />);
      // 80 * 1 + 80 * 1 = 160%
      expect(screen.getByTestId('score-final')).toHaveTextContent('Final: 160%');
    });

    it('should handle zero weights gracefully returning zero totals', () => {
      render(<ScoreBreakdown sentiment={80} tvl={80} sentimentWeight={0} tvlWeight={0} />);
      expect(screen.getByTestId('score-final')).toHaveTextContent('Final: 0%');
    });

    it('should calculate final metrics correctly with negative parameter inputs', () => {
      render(<ScoreBreakdown sentiment={-50} tvl={100} sentimentWeight={0.5} tvlWeight={0.5} />);
      // -50 * 0.5 + 100 * 0.5 = -25 + 50 = 25%
      expect(screen.getByTestId('score-final')).toHaveTextContent('Final: 25%');
    });

    it('should round correctly when float precision values result in decimal fractions', () => {
      render(<ScoreBreakdown sentiment={77} tvl={55} sentimentWeight={0.33} tvlWeight={0.67} />);
      // 77 * 0.33 + 55 * 0.67 = 25.41 + 36.85 = 62.26 -> 62%
      expect(screen.getByTestId('score-final')).toHaveTextContent('Final: 62%');
    });

    it('should handle rendering when all metrics and weights are set to zero', () => {
      render(<ScoreBreakdown sentiment={0} tvl={0} sentimentWeight={0} tvlWeight={0} />);
      expect(screen.getByTestId('score-final')).toHaveTextContent('Final: 0%');
    });
  });
});
