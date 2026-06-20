import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandCenterToggle } from '@/components/ui/CommandCenter';

describe('CommandCenterToggle Smoke Test', () => {
  it('should render the toggle button and handle clicks', async () => {
    const user = userEvent.setup();
    render(<CommandCenterToggle />);

    // Initially, it should show the maximize button / enter command center mode
    const button = screen.getByRole('button', { name: /enter command center mode/i });
    expect(button).toBeInTheDocument();

    // Click to enter command center
    await user.click(button);

    // It should now show "Exit command center"
    const exitButton = screen.getByRole('button', { name: /exit command center/i });
    expect(exitButton).toBeInTheDocument();

    // It should render the clock with timezone WIB
    expect(screen.getByText(/wib/i)).toBeInTheDocument();

    // Click again to exit
    await user.click(exitButton);

    // Should return to initial state
    expect(screen.getByRole('button', { name: /enter command center mode/i })).toBeInTheDocument();
  });
});
