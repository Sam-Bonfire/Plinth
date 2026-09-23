import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LoginModal } from './LoginModal';

describe('LoginModal', () => {
  it('renders correctly', () => {
    const handleCancel = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <LoginModal
        open={true}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    );

    expect(screen.getAllByText('Login')[0]).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    expect(screen.getByLabelText('PIN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows error prop correctly', () => {
    const handleCancel = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <LoginModal
        open={true}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        error="Invalid credentials"
      />
    );

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    const handleCancel = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <LoginModal
        open={true}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handleCancel).toHaveBeenCalled();
  });

  it('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    const handleCancel = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <LoginModal
        open={true}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByText('Please input your phone number!')).toBeInTheDocument();
      expect(screen.getByText('Please input your PIN!')).toBeInTheDocument();
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct data when valid form is submitted', async () => {
    const user = userEvent.setup();
    const handleCancel = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <LoginModal
        open={true}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    );

    await user.type(screen.getByLabelText('Phone Number'), '1234567890');
    await user.type(screen.getByLabelText('PIN'), '1234');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        phone: '1234567890',
        pin: '1234',
      });
    });
  });
});
