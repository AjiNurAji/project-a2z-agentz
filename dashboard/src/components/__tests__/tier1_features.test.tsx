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

describe('Tier 1: Feature Coverage (N = 11 Features, 5 tests each)', () => {
  // =========================================================================
  // Feature 1: Theme System (useTheme)
  // =========================================================================
  describe('Feature 1: Theme System', () => {
    it('should initialize with default system theme', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('system');
    });

    it('should update theme to light when setTheme is called', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('light');
      });
      expect(result.current.theme).toBe('light');
    });

    it('should update theme to dark when setTheme is called', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('dark');
      });
      expect(result.current.theme).toBe('dark');
    });

    it('should toggle theme sequentially using toggleTheme', () => {
      const { result } = renderHook(() => useTheme());
      // starts at system
      act(() => {
        result.current.toggleTheme(); // system -> light
      });
      expect(result.current.theme).toBe('light');
      act(() => {
        result.current.toggleTheme(); // light -> dark
      });
      expect(result.current.theme).toBe('dark');
      act(() => {
        result.current.toggleTheme(); // dark -> system
      });
      expect(result.current.theme).toBe('system');
    });

    it('should update resolvedTheme correctly based on selected theme', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('system');
      });
      expect(result.current.resolvedTheme).toBe('dark');
      act(() => {
        result.current.setTheme('light');
      });
      expect(result.current.resolvedTheme).toBe('light');
    });
  });

  // =========================================================================
  // Feature 2: Chart Colors Resolver (useChartColors)
  // =========================================================================
  describe('Feature 2: Chart Colors Resolver', () => {
    it('should return a valid colors object', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors).toBeDefined();
    });

    it('should return correct primary color hex value', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should return correct secondary color hex value', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should return correct glow effect color value', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors.glow).toBeDefined();
    });

    it('should return accent and brand color values', () => {
      const { result } = renderHook(() => useChartColors());
      expect(result.current.colors.accent).toBeDefined();
      expect(result.current.colors.brand).toBeDefined();
    });
  });

  // =========================================================================
  // Feature 3: Sparkline Widget (Sparkline)
  // =========================================================================
  describe('Feature 3: Sparkline Widget', () => {
    it('should render SVG sparkline element', () => {
      render(<Sparkline data={[10, 20, 15, 30]} />);
      expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    });

    it('should respect custom width and height properties', () => {
      render(<Sparkline data={[10, 20, 15, 30]} width={200} height={50} />);
      const svg = screen.getByTestId('sparkline');
      expect(svg).toHaveAttribute('width', '200');
      expect(svg).toHaveAttribute('height', '50');
    });

    it('should apply class name for glow effect', () => {
      render(<Sparkline data={[10, 20, 15, 30]} glow={true} />);
      expect(screen.getByTestId('sparkline')).toHaveClass('glow-effect');
    });

    it('should accept custom color parameter', () => {
      render(<Sparkline data={[10, 20, 15, 30]} color="#123456" />);
      const line = screen.getByTestId('sparkline').querySelector('polyline');
      expect(line).toHaveAttribute('stroke', '#123456');
    });

    it('should render matching point sequence based on data values', () => {
      render(<Sparkline data={[0, 100]} width={100} height={100} />);
      const line = screen.getByTestId('sparkline').querySelector('polyline');
      expect(line).toHaveAttribute('points', '0,100 100,0');
    });
  });

  // =========================================================================
  // Feature 4: Data Freshness System (useDataFreshness)
  // =========================================================================
  describe('Feature 4: Data Freshness System', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return just now for newly synchronized timestamps', () => {
      const now = Date.now();
      const { result } = renderHook(() => useDataFreshness(now));
      expect(result.current.relativeText).toBe('just now');
    });

    it('should return seconds ago description for short elapsed time', () => {
      const now = Date.now();
      const { result } = renderHook(() => useDataFreshness(now));
      act(() => {
        vi.advanceTimersByTime(10000); // 10 seconds
      });
      expect(result.current.relativeText).toBe('10s ago');
    });

    it('should return minutes ago description for longer elapsed time', () => {
      const now = Date.now();
      const { result } = renderHook(() => useDataFreshness(now));
      act(() => {
        vi.advanceTimersByTime(120000); // 2 minutes
      });
      expect(result.current.relativeText).toBe('2m ago');
    });

    it('should periodically update text on interval tick', () => {
      const now = Date.now();
      const { result } = renderHook(() => useDataFreshness(now));
      expect(result.current.relativeText).toBe('just now');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.relativeText).toBe('5s ago');
    });

    it('should clean up the timer interval on component unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { unmount } = renderHook(() => useDataFreshness(Date.now()));
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Feature 5: Freshness Pill Component (FreshnessPill)
  // =========================================================================
  describe('Feature 5: Freshness Pill Component', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should render freshness pill element', () => {
      render(<FreshnessPill lastSync={Date.now()} />);
      expect(screen.getByTestId('freshness-pill')).toBeInTheDocument();
    });

    it('should render relative text label inside the pill', () => {
      render(<FreshnessPill lastSync={Date.now() - 5000} />);
      expect(screen.getByText('5s ago')).toBeInTheDocument();
    });

    it('should dynamically update visual text over elapsed time', () => {
      render(<FreshnessPill lastSync={Date.now()} />);
      expect(screen.getByText('just now')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(screen.getByText('15s ago')).toBeInTheDocument();
    });

    it('should accept custom class wrapper formatting', () => {
      render(<FreshnessPill lastSync={Date.now()} />);
      expect(screen.getByTestId('freshness-pill')).toHaveClass('freshness-pill');
    });

    it('should stop timer update cleanly when unmounted', () => {
      const { unmount } = render(<FreshnessPill lastSync={Date.now()} />);
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Feature 6: User Preferences & Density (usePreferences)
  // =========================================================================
  describe('Feature 6: User Preferences & Density', () => {
    it('should default layout density to default', () => {
      const { result } = renderHook(() => usePreferences());
      expect(result.current.density).toBe('default');
    });

    it('should update layout density to compact when requested', () => {
      const { result } = renderHook(() => usePreferences());
      act(() => {
        result.current.setDensity('compact');
      });
      expect(result.current.density).toBe('compact');
    });

    it('should toggle layout density between default and compact modes', () => {
      const { result } = renderHook(() => usePreferences());
      act(() => {
        result.current.setDensity('compact');
      });
      expect(result.current.density).toBe('compact');
      act(() => {
        result.current.setDensity('default');
      });
      expect(result.current.density).toBe('default');
    });

    it('should retain reference stability of setDensity callback function', () => {
      const { result, rerender } = renderHook(() => usePreferences());
      const firstCallback = result.current.setDensity;
      rerender();
      expect(result.current.setDensity).toBe(firstCallback);
    });

    it('should maintain state values correctly after multiple preferences updates', () => {
      const { result } = renderHook(() => usePreferences());
      act(() => {
        result.current.setDensity('compact');
      });
      act(() => {
        result.current.setDensity('compact');
      });
      expect(result.current.density).toBe('compact');
    });
  });

  // =========================================================================
  // Feature 7: Keyboard Shortcut Hook (useKeyboardShortcut)
  // =========================================================================
  describe('Feature 7: Keyboard Shortcut Hook', () => {
    it('should trigger callback when matching shortcut key is pressed', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(['k'], callback));
      
      const event = new KeyboardEvent('keydown', { key: 'k' });
      window.dispatchEvent(event);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should ignore shortcut trigger when hook is disabled', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(['k'], callback, { enabled: false }));
      
      const event = new KeyboardEvent('keydown', { key: 'k' });
      window.dispatchEvent(event);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call preventDefault by default on matched shortcut events', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(['k'], callback));
      
      const event = new KeyboardEvent('keydown', { key: 'k' });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      window.dispatchEvent(event);
      expect(preventSpy).toHaveBeenCalled();
    });

    it('should not call preventDefault if preventDefault option is false', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(['k'], callback, { preventDefault: false }));
      
      const event = new KeyboardEvent('keydown', { key: 'k' });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      window.dispatchEvent(event);
      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('should remove event listeners correctly when component unmounts', () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() => useKeyboardShortcut(['k'], callback));
      unmount();
      
      const event = new KeyboardEvent('keydown', { key: 'k' });
      window.dispatchEvent(event);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Feature 8: Segmented Control Component (SegmentedControl)
  // =========================================================================
  describe('Feature 8: Segmented Control Component', () => {
    const options = [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
    ];

    it('should render all option segments with correct label texts', () => {
      render(<SegmentedControl options={options} value="a" onChange={vi.fn()} name="test" />);
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
    });

    it('should mark active value with radio group checked attribute', () => {
      render(<SegmentedControl options={options} value="a" onChange={vi.fn()} name="test" />);
      const optionA = screen.getByTestId('segment-a');
      const optionB = screen.getByTestId('segment-b');
      expect(optionA).toHaveAttribute('aria-checked', 'true');
      expect(optionB).toHaveAttribute('aria-checked', 'false');
    });

    it('should invoke onChange when a segment is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<SegmentedControl options={options} value="a" onChange={onChange} name="test" />);
      
      await user.click(screen.getByTestId('segment-b'));
      expect(onChange).toHaveBeenCalledWith('b');
    });

    it('should render container with role radiogroup', () => {
      render(<SegmentedControl options={options} value="a" onChange={vi.fn()} name="test" />);
      expect(screen.getByTestId('segmented-control')).toHaveAttribute('role', 'radiogroup');
    });

    it('should render buttons with role radio', () => {
      render(<SegmentedControl options={options} value="a" onChange={vi.fn()} name="test" />);
      expect(screen.getByTestId('segment-a')).toHaveAttribute('role', 'radio');
      expect(screen.getByTestId('segment-b')).toHaveAttribute('role', 'radio');
    });
  });

  // =========================================================================
  // Feature 9: Confirmation Modal (ConfirmModal)
  // =========================================================================
  describe('Feature 9: Confirmation Modal', () => {
    const defaultProps = {
      isOpen: true,
      title: 'Danger Zone',
      description: 'Are you sure?',
      variant: 'danger' as const,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    };

    it('should render nothing if isOpen parameter is false', () => {
      const { container } = render(<ConfirmModal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render modal dialog contents when isOpen is true', () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.getByText('Danger Zone')).toBeInTheDocument();
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('should fire onConfirm callback when confirm button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
      
      await user.click(screen.getByTestId('modal-confirm'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should fire onCancel callback when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      
      await user.click(screen.getByTestId('modal-cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should apply variant indicator styling class to modal element', () => {
      render(<ConfirmModal {...defaultProps} variant="warning" />);
      expect(screen.getByTestId('confirm-modal')).toHaveClass('modal-warning');
    });
  });

  // =========================================================================
  // Feature 10: Radial Gauge Component (RadialGauge)
  // =========================================================================
  describe('Feature 10: Radial Gauge Component', () => {
    it('should render score text value as percentage', () => {
      render(<RadialGauge score={75} />);
      expect(screen.getByTestId('radial-score')).toHaveTextContent('75%');
    });

    it('should display label descriptive text if provided', () => {
      render(<RadialGauge score={75} label="Sentiment Index" />);
      expect(screen.getByTestId('radial-label')).toHaveTextContent('Sentiment Index');
    });

    it('should render correctly with zero score input boundary', () => {
      render(<RadialGauge score={0} />);
      expect(screen.getByTestId('radial-score')).toHaveTextContent('0%');
    });

    it('should render correctly with max hundred score input boundary', () => {
      render(<RadialGauge score={100} />);
      expect(screen.getByTestId('radial-score')).toHaveTextContent('100%');
    });

    it('should write raw score to data attribute for CSS retrieval', () => {
      render(<RadialGauge score={85} />);
      expect(screen.getByTestId('radial-gauge')).toHaveAttribute('data-score', '85');
    });
  });

  // =========================================================================
  // Feature 11: Score Breakdown Component (ScoreBreakdown)
  // =========================================================================
  describe('Feature 11: Score Breakdown Component', () => {
    it('should display raw sentiment metric text', () => {
      render(<ScoreBreakdown sentiment={80} tvl={60} sentimentWeight={0.5} tvlWeight={0.5} />);
      expect(screen.getByTestId('score-sentiment')).toHaveTextContent('Sentiment: 80%');
    });

    it('should display raw tvl metric text', () => {
      render(<ScoreBreakdown sentiment={80} tvl={60} sentimentWeight={0.5} tvlWeight={0.5} />);
      expect(screen.getByTestId('score-tvl')).toHaveTextContent('TVL: 60%');
    });

    it('should calculate weighted score total using formula', () => {
      render(<ScoreBreakdown sentiment={80} tvl={60} sentimentWeight={0.5} tvlWeight={0.5} />);
      expect(screen.getByTestId('score-final')).toHaveTextContent('Final: 70%');
    });

    it('should handle asymmetric parameter weight configurations', () => {
      render(<ScoreBreakdown sentiment={90} tvl={50} sentimentWeight={0.7} tvlWeight={0.3} />);
      // 90 * 0.7 + 50 * 0.3 = 63 + 15 = 78%
      expect(screen.getByTestId('score-final')).toHaveTextContent('Final: 78%');
    });

    it('should round final score value calculation to nearest integer', () => {
      render(<ScoreBreakdown sentiment={75} tvl={50} sentimentWeight={0.25} tvlWeight={0.75} />);
      // 75 * 0.25 + 50 * 0.75 = 18.75 + 37.5 = 56.25 -> rounded to 56%
      expect(screen.getByTestId('score-final')).toHaveTextContent('Final: 56%');
    });
  });
});
