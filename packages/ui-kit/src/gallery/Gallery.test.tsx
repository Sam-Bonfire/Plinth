import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Gallery } from './Gallery.js';

// Mock window.matchMedia for antd
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Gallery', () => {
  it('renders all sections without crashing', () => {
    const { getByText } = render(<Gallery />);
    expect(getByText('Plinth UI Kit Gallery')).toBeDefined();
    expect(getByText('Primary')).toBeDefined();
    expect(getByText('Default Card')).toBeDefined();
    expect(getByText('Panel Title')).toBeDefined();
    expect(getByText('Info Alert')).toBeDefined();
  });
});
