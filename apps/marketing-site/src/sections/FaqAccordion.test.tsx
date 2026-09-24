/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { FaqAccordion } from './FaqAccordion';

describe('FaqAccordion', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders all default FAQ questions', () => {
    render(<FaqAccordion />);
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();

    const questions = [
      'Does PlinthOS work offline?',
      'What is the pricing model?',
      'What hardware is required?',
      'Who owns my data?',
      'What kind of support is available?',
      'How does the onboarding process work?',
    ];

    questions.forEach((q) => {
      expect(screen.getByText(q)).toBeInTheDocument();
    });
  });

  it('expands and collapses FAQ items when clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<FaqAccordion />);

    const firstQuestion = screen.getByText('Does PlinthOS work offline?');
    const firstAnswerText = 'Yes, PlinthOS provides offline capabilities so your business can continue running smoothly even during internet outages.';

    // The answer should not be in the DOM before click, since Collapse components often defer rendering or use display:none without render
    // By default Antd Collapse doesn't render children until expanded for the first time, unless forceRender is used.
    expect(screen.queryByText(firstAnswerText)).not.toBeInTheDocument();

    // Click to expand
    await user.click(firstQuestion);

    // Check if it appears in DOM
    const answer = await screen.findByText(firstAnswerText);
    expect(answer).toBeInTheDocument();

    // Click to collapse
    await user.click(firstQuestion);

    // After collapsing, antd typically uses CSS to hide or unmounts. Let's check parent div for aria-expanded
    const headerDiv = container.querySelector('.ant-collapse-header');
    await waitFor(() => {
        expect(headerDiv).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('uses custom items when provided via props', async () => {
    const user = userEvent.setup();
    const customItems = [
      {
        key: 'custom-1',
        question: 'Custom Q1?',
        answer: <div>Custom A1</div>,
      }
    ];

    render(<FaqAccordion items={customItems} />);

    expect(screen.getByText('Custom Q1?')).toBeInTheDocument();

    // Default items should not be present
    expect(screen.queryByText('Does PlinthOS work offline?')).not.toBeInTheDocument();

    // Answer won't be visible until clicked
    expect(screen.queryByText('Custom A1')).not.toBeInTheDocument();

    const question = screen.getByText('Custom Q1?');
    await user.click(question);

    const answer = await screen.findByText('Custom A1');
    expect(answer).toBeInTheDocument();
  });
});
