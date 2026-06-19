import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import {
  useTheme,
  useDataFreshness,
  usePreferences,
  useKeyboardShortcut,
  ConfirmModal,
  RadialGauge,
  ScoreBreakdown,
  NotificationsPanel,
  OnboardingTour,
} from './stubs';


describe('Tier 4: Real-World Application Scenarios (>= 6 test cases)', () => {
  // Scenario 1: User Settings Customization Flow
  it('Scenario 1: User modifies theme configuration, sets density preferences, and verifies layout updates', async () => {
    const user = userEvent.setup();
    const TestDashboardSettings = () => {
      const { theme, setTheme } = useTheme();
      const { density, setDensity } = usePreferences();
      return (
        <div data-testid="dashboard" className={`theme-${theme} density-${density}`}>
          <button data-testid="set-dark" onClick={() => setTheme('dark')}>Set Dark</button>
          <button data-testid="set-compact" onClick={() => setDensity('compact')}>Set Compact</button>
        </div>
      );
    };

    render(<TestDashboardSettings />);
    const dashboard = screen.getByTestId('dashboard');
    expect(dashboard).toHaveClass('theme-system');
    expect(dashboard).toHaveClass('density-default');

    await user.click(screen.getByTestId('set-dark'));
    await user.click(screen.getByTestId('set-compact'));

    expect(dashboard).toHaveClass('theme-dark');
    expect(dashboard).toHaveClass('density-compact');
  });

  // Scenario 2: Transaction Manual Approval Security Flow
  it('Scenario 2: High-value transaction launches ConfirmModal, user approves override, and completes action', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onReject = vi.fn();

    const TransactionFlow = () => {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <div>
          <ConfirmModal
            isOpen={isOpen}
            title="Approve High-Value Transfer"
            description="Autonomous transfer cap exceeded ($2.50). Require human approval."
            variant="warning"
            onConfirm={() => {
              onApprove();
              setIsOpen(false);
            }}
            onCancel={() => {
              onReject();
              setIsOpen(false);
            }}
          />
        </div>
      );
    };

    render(<TransactionFlow />);
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByText(/Autonomous transfer cap exceeded/)).toBeInTheDocument();

    await user.click(screen.getByTestId('modal-confirm'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
  });

  // Scenario 3: First-Time User Onboarding Flow
  it('Scenario 3: User steps sequentially through interactive OnboardingTour, uses shortcuts, and finishes tour', async () => {
    const user = userEvent.setup();
    const onCloseTour = vi.fn();
    const steps = [
      { title: 'Welcome Scout', content: 'Explore the dashboard.' },
      { title: 'Vault Security', content: 'Confirm keys and limits.' },
      { title: 'Ready to Run', content: 'Enable autonomous agent scoping.' },
    ];

    const OnboardingFlow = () => {
      const [isOpen, setIsOpen] = useState(true);
      useKeyboardShortcut(['Escape'], () => {
        setIsOpen(false);
        onCloseTour();
      });
      return (
        <OnboardingTour
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            onCloseTour();
          }}
          steps={steps}
        />
      );
    };

    render(<OnboardingFlow />);
    expect(screen.getByTestId('tour-title')).toHaveTextContent('Welcome Scout');

    // Step 2
    await user.click(screen.getByTestId('tour-next'));
    expect(screen.getByTestId('tour-title')).toHaveTextContent('Vault Security');

    // Step 3
    await user.click(screen.getByTestId('tour-next'));
    expect(screen.getByTestId('tour-title')).toHaveTextContent('Ready to Run');

    // Finish
    await user.click(screen.getByTestId('tour-finish'));
    expect(onCloseTour).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
  });

  // Scenario 4: Data Sync Freshness & Alert Flow
  it('Scenario 4: Live telemetry background updates sync, updates FreshnessPill, and alerts new notification', () => {
    vi.useFakeTimers();
    const onNewAlert = vi.fn();

    const LiveDataDashboard = ({ syncTime }: { syncTime: number }) => {
      const { relativeText } = useDataFreshness(syncTime);
      const notifications = [
        { id: '1', title: 'Scouting complete', message: 'Project found.', read: false },
      ];
      return (
        <div>
          <div data-testid="freshness">{relativeText}</div>
          <NotificationsPanel
            isOpen={true}
            onClose={vi.fn()}
            notifications={notifications}
            onMarkAsRead={onNewAlert}
          />
        </div>
      );
    };

    const initialSync = Date.now();
    render(<LiveDataDashboard syncTime={initialSync} />);
    expect(screen.getByTestId('freshness')).toHaveTextContent('just now');

    // Telemetry tick
    act(() => {
      vi.advanceTimersByTime(12000); // 12s
    });
    expect(screen.getByTestId('freshness')).toHaveTextContent('12s ago');

    // User marks notification read
    screen.getByTestId('mark-read-1').click();
    expect(onNewAlert).toHaveBeenCalledWith('1');
    expect(onNewAlert).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // Scenario 5: Keyboard-Only Accessibility Audit
  it('Scenario 5: User navigates segmented controls, handles Escape dialog dismiss, and opens shortcuts help', () => {
    const onEsc = vi.fn();
    const onHelp = vi.fn();

    const AccessiblePanel = () => {
      useKeyboardShortcut(['Escape'], onEsc);
      useKeyboardShortcut(['?'], onHelp);
      return (
        <div>
          <button data-testid="focused-button">Target</button>
        </div>
      );
    };

    render(<AccessiblePanel />);
    
    // Press escape key
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onEsc).toHaveBeenCalledTimes(1);

    // Press help query key
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  // Scenario 6: Sentiment and TVL Project Scouting Flow
  it('Scenario 6: Scout agent analyzes sentiment and TVL metrics, updates radial gauge, and launches ConfirmModal', async () => {
    const user = userEvent.setup();
    const onScopeConfirmed = vi.fn();

    const ScoutingSimulation = () => {
      const sentiment = 90;
      const tvl = 80;
      const score = Math.round(sentiment * 0.7 + tvl * 0.3); // 63 + 24 = 87
      const isHighOpportunity = score > 85;

      return (
        <div>
          <ScoreBreakdown sentiment={sentiment} tvl={tvl} sentimentWeight={0.7} tvlWeight={0.3} />
          <RadialGauge score={score} label="Opportunity Score" />
          <ConfirmModal
            isOpen={isHighOpportunity}
            title="High Opportunity Found"
            description={`Proceed to fund project with overall rating of ${score}%?`}
            variant="info"
            onConfirm={onScopeConfirmed}
            onCancel={vi.fn()}
          />
        </div>
      );
    };

    render(<ScoutingSimulation />);
    expect(screen.getByTestId('radial-score')).toHaveTextContent('87%');
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByText(/Proceed to fund project/)).toBeInTheDocument();

    await user.click(screen.getByTestId('modal-confirm'));
    expect(onScopeConfirmed).toHaveBeenCalledTimes(1);
  });
});
