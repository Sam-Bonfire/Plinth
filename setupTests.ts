import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia for Ant Design components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
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

// Mock global fetch for happy-dom to prevent external network calls during tests
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({}),
  })
) as unknown as typeof fetch;
