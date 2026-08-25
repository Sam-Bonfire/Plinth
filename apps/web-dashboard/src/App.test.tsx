import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Web Dashboard App', () => {
  it('renders dashboard heading', () => {
    render(<App />);
    expect(screen.getByText(/PlinthOS Web Dashboard/i)).toBeInTheDocument();
  });
});
