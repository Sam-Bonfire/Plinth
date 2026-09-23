import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConsentDrawer } from './ConsentDrawer';

describe('ConsentDrawer', () => {
  it('renders correctly', () => {
    const handleConsent = vi.fn();
    render(<ConsentDrawer open={true} onConsent={handleConsent} />);

    expect(screen.getByText('Marketing Consent')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline All' })).toBeInTheDocument();
  });

  it('calls onConsent with all false when decline is clicked', async () => {
    const user = userEvent.setup();
    const handleConsent = vi.fn();
    render(<ConsentDrawer open={true} onConsent={handleConsent} />);

    await user.click(screen.getByRole('button', { name: 'Decline All' }));

    expect(handleConsent).toHaveBeenCalledWith({
      sms: false,
      email: false,
      whatsapp: false,
    });
  });

  it('calls onConsent with selected choices when accept is clicked', async () => {
    const user = userEvent.setup();
    const handleConsent = vi.fn();
    render(<ConsentDrawer open={true} onConsent={handleConsent} />);

    const switches = screen.getAllByRole('switch');
    // Click the first switch (SMS)
    await user.click(switches[0]);
    // Click the third switch (WhatsApp)
    await user.click(switches[2]);

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(handleConsent).toHaveBeenCalledWith({
      sms: true,
      email: false,
      whatsapp: true,
    });
  });
});
