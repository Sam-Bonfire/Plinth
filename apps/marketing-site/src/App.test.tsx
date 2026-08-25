import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Marketing Site App', () => {
  it('renders marketing heading', () => {
    render(<App />);
    expect(screen.getByText(/PlinthOS Marketing Site/i)).toBeDefined();
  });
});
