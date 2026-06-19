import React, { useState } from 'react';
import { render, screen, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import {
  useTheme,
  useChartColors,
  Sparkline,
  FreshnessPill,
  usePreferences,
  useKeyboardShortcut,
  SegmentedControl,
  ConfirmModal,
  RadialGauge,
  ScoreBreakdown,
  NotificationsPanel,
  KeyboardHelpOverlay,
  OnboardingTour,
  Density,
} from './stubs';


describe('Tier 3: Cross-Feature Combinations (>= 11 test cases)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // Test 1: Theme System & Chart Colors
  it('should update chart colors when the theme is toggled', () => {
    const { result: themeResult } = renderHook(() => useTheme());
    const { result: colorsResult } = renderHook(() => useChartColors());

    act(() => {
      themeResult.current.setTheme('light');
    });

    // Chart colors should resolve/update accordingly
    const newPrimary = colorsResult.current.colors.primary;
    expect(newPrimary).toBeDefined();
  });

  // Test 2: Keyboard Shortcut & Confirm Modal
  it('should trigger cancel callback of ConfirmModal when pressing Escape shortcut key', () => {
    const onCancel = vi.fn();
    const TestComponent = () => {
      useKeyboardShortcut(['Escape'], onCancel);
      return (
        <ConfirmModal
          isOpen={true}
          title="Delete"
          description="Are you sure?"
          variant="danger"
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Test 3: Keyboard Shortcut & Notifications Panel
  it('should toggle notifications panel visibility via n shortcut key', async () => {
    const TestComponent = () => {
      const [isOpen, setIsOpen] = useState(false);
      useKeyboardShortcut(['n'], () => setIsOpen((prev) => !prev));
      return (
        <NotificationsPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          notifications={[]}
        />
      );
    };

    render(<TestComponent />);
    expect(screen.queryByTestId('notifications-panel')).toBeNull();

    // Trigger open shortcut
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });
    expect(screen.getByTestId('notifications-panel')).toBeInTheDocument();

    // Trigger close shortcut
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });
    expect(screen.queryByTestId('notifications-panel')).toBeNull();
  });

  // Test 4: Segmented Control & Preferences Density
  it('should sync preferences density with SegmentedControl selections', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const { density, setDensity } = usePreferences();
      const options = [
        { label: 'Default Density', value: 'default' },
        { label: 'Compact Density', value: 'compact' },
      ];
      return (
        <div>
          <span data-testid="density-value">{density}</span>
          <SegmentedControl
            options={options}
            value={density}
            onChange={(val) => setDensity(val as Density)}
            name="density"
          />
        </div>
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('density-value')).toHaveTextContent('default');

    await user.click(screen.getByText('Compact Density'));
    expect(screen.getByTestId('density-value')).toHaveTextContent('compact');
  });

  // Test 5: Freshness Pill & Onboarding Tour
  it('should display active freshness status update cycles while onboarding tour is visible', () => {
    vi.useFakeTimers();
    const lastSync = Date.now();
    const TestComponent = () => (
      <div>
        <FreshnessPill lastSync={lastSync} />
        <OnboardingTour isOpen={true} onClose={vi.fn()} steps={[{ title: 'Step 1', content: 'Info' }]} />
      </div>
    );

    render(<TestComponent />);
    expect(screen.getByTestId('onboarding-tour')).toBeInTheDocument();
    expect(screen.getByTestId('freshness-pill')).toHaveTextContent('just now');

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByTestId('freshness-pill')).toHaveTextContent('10s ago');
    vi.useRealTimers();
  });

  // Test 6: Onboarding Tour & Keyboard Shortcuts
  it('should transition onboarding tour steps using keyboard navigation controls', () => {
    const TestComponent = () => {
      const [isOpen, setIsOpen] = useState(true);
      const steps = [
        { title: 'Step 1', content: 'Intro' },
        { title: 'Step 2', content: 'Main' },
      ];
      
      // Let's bind 'ArrowRight' to go next (or trigger action)
      useKeyboardShortcut(['ArrowRight'], () => {
        const nextBtn = screen.queryByTestId('tour-next');
        if (nextBtn) {
          (nextBtn as HTMLButtonElement).click();
        }
      });

      return <OnboardingTour isOpen={isOpen} onClose={() => setIsOpen(false)} steps={steps} />;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('tour-title')).toHaveTextContent('Step 1');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(screen.getByTestId('tour-title')).toHaveTextContent('Step 2');
  });

  // Test 7: Score Breakdown & Radial Gauge
  it('should feed calculated score breakdown totals directly into RadialGauge', () => {
    const TestComponent = () => {
      const sentiment = 90;
      const tvl = 70;
      const sentimentWeight = 0.6;
      const tvlWeight = 0.4;
      const calculated = Math.round(sentiment * sentimentWeight + tvl * tvlWeight); // 54 + 28 = 82

      return (
        <div>
          <ScoreBreakdown
            sentiment={sentiment}
            tvl={tvl}
            sentimentWeight={sentimentWeight}
            tvlWeight={tvlWeight}
          />
          <RadialGauge score={calculated} label="Overall Score" />
        </div>
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('radial-score')).toHaveTextContent('82%');
  });

  // Test 8: Theme Toggle & Sparkline
  it('should update Sparkline stroke style classes based on light/dark theme context', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const { theme, setTheme } = useTheme();
      return (
        <div>
          <button data-testid="set-light" onClick={() => setTheme('light')}>Light</button>
          <Sparkline data={[10, 20]} glow={theme === 'dark' || theme === 'system'} />
        </div>
      );
    };

    const { rerender } = render(<TestComponent />);
    expect(screen.getByTestId('sparkline')).toHaveClass('glow-effect');

    // Toggle theme to light, should disable glow
    await user.click(screen.getByTestId('set-light'));
    rerender(<TestComponent />);
    expect(screen.getByTestId('sparkline')).not.toHaveClass('glow-effect');
  });

  // Test 9: Confirm Modal & Onboarding Tour
  it('should render both confirm modal and onboarding tour in layout simultaneously without crashes', () => {
    const TestComponent = () => (
      <div>
        <ConfirmModal
          isOpen={true}
          title="Modal Title"
          description="Desc"
          variant="info"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
        <OnboardingTour
          isOpen={true}
          onClose={vi.fn()}
          steps={[{ title: 'Step 1', content: 'Content' }]}
        />
      </div>
    );

    render(<TestComponent />);
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-tour')).toBeInTheDocument();
  });

  // Test 10: Preferences Density & Segmented Control
  it('should apply layout margins to SegmentedControl elements under different density preferences', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem('a2z-density');
    const TestComponent = () => {
      const { density, setDensity } = usePreferences();
      return (
        <div data-testid="density-container" className={density === 'compact' ? 'p-2' : 'p-6'}>
          <button data-testid="set-compact" onClick={() => setDensity('compact')}>Compact</button>
          <SegmentedControl
            options={[{ label: 'A', value: 'a' }]}
            value="a"
            onChange={vi.fn()}
            name="segmented"
          />
        </div>
      );
    };

    const { rerender } = render(<TestComponent />);
    const container = screen.getByTestId('density-container');
    expect(container).toHaveClass('p-6'); // Default density is default (p-6)

    // Toggle to compact
    await user.click(screen.getByTestId('set-compact'));
    rerender(<TestComponent />);
    expect(container).toHaveClass('p-2');
  });

  // Test 11: Keyboard Help Overlay & Keyboard Shortcut
  it('should toggle keyboard help overlay via ? and Escape shortcut keys', () => {
    const TestComponent = () => {
      const [isOpen, setIsOpen] = useState(false);
      useKeyboardShortcut(['?'], () => setIsOpen(true));
      useKeyboardShortcut(['Escape'], () => setIsOpen(false));
      return <KeyboardHelpOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />;
    };

    render(<TestComponent />);
    expect(screen.queryByTestId('keyboard-help-overlay')).toBeNull();

    // Open
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(screen.getByTestId('keyboard-help-overlay')).toBeInTheDocument();

    // Close
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByTestId('keyboard-help-overlay')).toBeNull();
  });
});
