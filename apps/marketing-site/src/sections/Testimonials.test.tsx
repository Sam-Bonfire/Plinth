import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Testimonials, Testimonial } from './Testimonials.js';

const mockTestimonials: Testimonial[] = [
  { name: 'Test User 1', outlet: 'Outlet 1', quote: 'Quote 1', rating: 5 },
  { name: 'Test User 2', outlet: 'Outlet 2', quote: 'Quote 2', rating: 4 },
  { name: 'Test User 3', outlet: 'Outlet 3', quote: 'Quote 3', rating: 3 },
];

describe('Testimonials', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders default testimonials correctly', () => {
    render(<Testimonials />);
    expect(screen.getByText('What Our Customers Say')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('returns null if no testimonials are provided', () => {
    const { container } = render(<Testimonials testimonials={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('navigates manually using next and prev buttons', () => {
    render(<Testimonials testimonials={mockTestimonials} />);

    // Initially showing first testimonial
    expect(screen.getByText('Test User 1')).toBeInTheDocument();

    // Click Next
    fireEvent.click(screen.getByLabelText('Next Testimonial'));
    expect(screen.getByText('Test User 2')).toBeInTheDocument();

    // Click Prev
    fireEvent.click(screen.getByLabelText('Previous Testimonial'));
    expect(screen.getByText('Test User 1')).toBeInTheDocument();

    // Click Prev again (wraps to last)
    fireEvent.click(screen.getByLabelText('Previous Testimonial'));
    expect(screen.getByText('Test User 3')).toBeInTheDocument();
  });

  it('navigates manually using dot navigation', () => {
    render(<Testimonials testimonials={mockTestimonials} />);

    // Initially showing first testimonial
    expect(screen.getByText('Test User 1')).toBeInTheDocument();

    // Click third dot
    fireEvent.click(screen.getByTestId('dot-2'));
    expect(screen.getByText('Test User 3')).toBeInTheDocument();
  });

  it('auto-advances based on interval', () => {
    render(<Testimonials testimonials={mockTestimonials} autoAdvanceInterval={1000} />);

    expect(screen.getByText('Test User 1')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Test User 2')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Test User 3')).toBeInTheDocument();
  });

  it('pauses auto-advancing on hover', () => {
    render(<Testimonials testimonials={mockTestimonials} autoAdvanceInterval={1000} />);

    expect(screen.getByText('Test User 1')).toBeInTheDocument();

    // Trigger hover to pause
    const container = screen.getByText('What Our Customers Say').parentElement!;
    fireEvent.mouseEnter(container);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should still be showing the first testimonial because it's paused
    expect(screen.getByText('Test User 1')).toBeInTheDocument();

    // End hover to unpause
    fireEvent.mouseLeave(container);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should now advance
    expect(screen.getByText('Test User 2')).toBeInTheDocument();
  });
});