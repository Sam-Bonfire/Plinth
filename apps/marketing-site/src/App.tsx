import { getThemeConfig } from '@plinth/ui-kit';
import { useFontsLoaded } from '@plinth/ui-kit/fonts/loader.js';
import { ConfigProvider, message } from 'antd';
import React from 'react';
import { ApiPlayground } from './sections/ApiPlayground.js';
import { ByodMatrix } from './sections/ByodMatrix.js';
import { ComplianceBadges } from './sections/ComplianceBadges.js';
import { DocsPortal } from './sections/DocsPortal.js';
import { FaqAccordion } from './sections/FaqAccordion.js';
import { HeroSection } from './sections/HeroSection.js';
import { KdsDemo } from './sections/KdsDemo.js';
import { LeadForm, type LeadFormValues } from './sections/LeadForm.js';
import { MultiLocation } from './sections/MultiLocation.js';
import { OfflineSim } from './sections/OfflineSim.js';
import { PillarsGrid } from './sections/PillarsGrid.js';
import { PricingCards } from './sections/PricingCards.js';
import { RoiCalculator } from './sections/RoiCalculator.js';
import { SiteFooter } from './sections/SiteFooter.js';
import { SiteHeader } from './sections/SiteHeader.js';
import { Testimonials } from './sections/Testimonials.js';

const PlinthThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeConfig = getThemeConfig(false);
  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
};

const submitLead = async (values: LeadFormValues): Promise<void> => {
  const res = await fetch('/api/v1/marketing/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: values.name ?? '',
      phone: values.phone ?? '',
      outlets: values.outletCount ?? 1,
      city: values.city ?? '',
    }),
  });
  if (!res.ok) {
    void message.error('Could not submit your request. Please try again.');
    return;
  }
  void message.success('Thanks! We will reach out shortly.');
};

const App: React.FC = () => {
  const fontsLoaded = useFontsLoaded();

  if (!fontsLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <PlinthThemeProvider>
      <SiteHeader
        links={[
          { label: 'Product', href: '#product' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Docs', href: '#docs' },
          { label: 'Contact', href: '#contact' },
        ]}
        ctaLabel="Start Free Trial"
        onCtaClick={(): void => {
          document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      <main aria-label="PlinthOS overview">
        <HeroSection />
        <PillarsGrid />
        <RoiCalculator />
        <KdsDemo />
        <OfflineSim />
        <MultiLocation />
        <ByodMatrix />
        <PricingCards />
        <Testimonials />
        <ApiPlayground />
        <DocsPortal />
        <FaqAccordion />
        <LeadForm onSubmit={submitLead} />
        <ComplianceBadges />
      </main>
      <SiteFooter />
    </PlinthThemeProvider>
  );
};

export default App;
