import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock("./lib/sounds.js", () => ({
  useSoundEnabled: vi.fn().mockReturnValue({ enabled: true, toggle: vi.fn() }),
  playTone: vi.fn(),
}));

describe('POS Client App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeDefined();
  });
});
