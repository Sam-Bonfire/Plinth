import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SiteFooter } from './SiteFooter';

describe('SiteFooter', () => {
  it('renders default company name and legal information', () => {
    render(<SiteFooter />);

    expect(screen.getByText('PlinthOS')).toBeInTheDocument();
    expect(screen.getByText(/FSSAI: 10000000000000/)).toBeInTheDocument();
    expect(screen.getByText(/GST: 22AAAAA0000A1Z5/)).toBeInTheDocument();
    expect(screen.getByText(/© \d{4} PlinthOS\. All rights reserved\./)).toBeInTheDocument();
  });

  it('renders custom company name and legal information', () => {
    render(
      <SiteFooter
        companyName="Custom Corp"
        fssaiNumber="98765432109876"
        gstNumber="99BBBBB9999B9Y9"
      />
    );

    expect(screen.getByText('Custom Corp')).toBeInTheDocument();
    expect(screen.getByText(/FSSAI: 98765432109876/)).toBeInTheDocument();
    expect(screen.getByText(/GST: 99BBBBB9999B9Y9/)).toBeInTheDocument();
    expect(screen.getByText(/© \d{4} Custom Corp\. All rights reserved\./)).toBeInTheDocument();
  });

  it('renders default link groups', () => {
    render(<SiteFooter />);

    // Check group titles
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();

    // Check some specific links
    expect(screen.getByText('Features')).toHaveAttribute('href', '/features');
    expect(screen.getByText('Privacy Policy')).toHaveAttribute('href', '/privacy');
  });

  it('renders custom link groups', () => {
    const customLinkGroups = [
      {
        title: 'Custom Group',
        links: [{ label: 'Custom Link', url: '/custom-url' }],
      },
    ];

    render(<SiteFooter linkGroups={customLinkGroups} />);

    expect(screen.getByText('Custom Group')).toBeInTheDocument();
    expect(screen.getByText('Custom Link')).toHaveAttribute('href', '/custom-url');

    // Default groups shouldn't be rendered
    expect(screen.queryByText('Product')).not.toBeInTheDocument();
  });
});
