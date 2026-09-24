import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { LeadForm, validateLead } from './LeadForm.js';

describe('validateLead', () => {
  it('should return errors for missing fields', () => {
    const errors = validateLead({});
    expect(errors).toContain('Name is required');
    expect(errors).toContain('Phone is required');
    expect(errors).toContain('Outlet count is required');
    expect(errors).toContain('City is required');
  });

  it('should return error if phone digits are less than 7', () => {
    const errors = validateLead({ name: 'John Doe', phone: '123456', outletCount: 1, city: 'NY' });
    expect(errors).toContain('Phone must contain 7-15 digits');
  });

  it('should return error if phone digits are more than 15', () => {
    const errors = validateLead({ name: 'John Doe', phone: '1234567890123456', outletCount: 1, city: 'NY' });
    expect(errors).toContain('Phone must contain 7-15 digits');
  });

  it('should return no errors for valid fields', () => {
    const errors = validateLead({ name: 'John Doe', phone: '123-456-7890', outletCount: 2, city: 'NY' });
    expect(errors.length).toBe(0);
  });
});

describe('LeadForm', () => {
  it('renders form fields', () => {
    render(<LeadForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Outlet Count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument();
  });

  it('displays errors on invalid submit', async () => {
    render(<LeadForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Request Free Trial/i }));

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  it('calls onSubmit and shows success state on valid submit', async () => {
    const onSubmit = vi.fn();
    render(<LeadForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '1234567' } });
    // For Ant Design InputNumber we might need to target the input inside it or just use the spinbutton role if it exposes one.
    // Let's use the query by label text.
    fireEvent.change(screen.getByLabelText(/Outlet Count/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'NY' } });

    fireEvent.click(screen.getByRole('button', { name: /Request Free Trial/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'John',
        phone: '1234567',
        outletCount: 2,
        city: 'NY'
      });
    });

    expect(screen.getByText('Request Submitted')).toBeInTheDocument();
  });
});
