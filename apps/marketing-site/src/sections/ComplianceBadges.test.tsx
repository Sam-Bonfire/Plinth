import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComplianceBadges } from './ComplianceBadges.js';

vi.mock('@ant-design/icons', () => ({
  SafetyCertificateOutlined: () => <div data-testid="safety-icon" />,
}));

describe('ComplianceBadges', () => {
  it('renders with default props', () => {
    render(<ComplianceBadges />);

    expect(screen.getByText('Security & Compliance First')).toBeInTheDocument();

    // Check titles
    expect(screen.getByText('SOC 2')).toBeInTheDocument();
    expect(screen.getByText('ISO 27001')).toBeInTheDocument();
    expect(screen.getByText('GDPR')).toBeInTheDocument();
    expect(screen.getByText('PCI-DSS')).toBeInTheDocument();
    expect(screen.getByText('Data Ownership')).toBeInTheDocument();

    // Check default descriptions
    expect(screen.getByText('SOC 2 Type II Certified')).toBeInTheDocument();
    expect(screen.getByText('ISO 27001 Compliant')).toBeInTheDocument();
    expect(screen.getByText('GDPR Ready')).toBeInTheDocument();
    expect(screen.getByText('PCI-DSS Aware')).toBeInTheDocument();
    expect(screen.getByText('Your Data is Yours')).toBeInTheDocument();

    // Verify icons are rendered
    expect(screen.getAllByTestId('safety-icon')).toHaveLength(5);
  });

  it('renders with custom props', () => {
    render(
      <ComplianceBadges
        soc2="Custom SOC 2"
        iso27001="Custom ISO"
        gdpr="Custom GDPR"
        pciDss="Custom PCI"
        dataOwnership="Custom Ownership"
      />
    );

    expect(screen.getByText('Custom SOC 2')).toBeInTheDocument();
    expect(screen.getByText('Custom ISO')).toBeInTheDocument();
    expect(screen.getByText('Custom GDPR')).toBeInTheDocument();
    expect(screen.getByText('Custom PCI')).toBeInTheDocument();
    expect(screen.getByText('Custom Ownership')).toBeInTheDocument();

    // Ensure defaults are overridden
    expect(screen.queryByText('SOC 2 Type II Certified')).not.toBeInTheDocument();
  });
});
