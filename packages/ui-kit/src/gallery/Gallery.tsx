import React from 'react';
import { AlertBanner } from '../components/AlertBanner/AlertBanner.js';
import { PlinthBadge } from '../components/Badge/PlinthBadge.js';
import { PlinthButton } from '../components/Button/PlinthButton.js';
import { PlinthCard } from '../components/Card/PlinthCard.js';
import { PlinthPanel } from '../components/Panel/PlinthPanel.js';

export const Gallery = (): React.JSX.Element => {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px', backgroundColor: 'var(--bg)' }}>
      <h1>Plinth UI Kit Gallery</h1>

      <section>
        <h2>PlinthButton</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <PlinthButton variant="primary">Primary</PlinthButton>
          <PlinthButton variant="secondary">Secondary</PlinthButton>
          <PlinthButton variant="danger">Danger</PlinthButton>
          <PlinthButton variant="ghost">Ghost</PlinthButton>
          <PlinthButton variant="pos-action" shortcutKey="P">POS Action</PlinthButton>
        </div>
      </section>

      <section>
        <h2>PlinthCard</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <PlinthCard title="Default Card">Content goes here</PlinthCard>
          <PlinthCard title="Elevated Card" variant="elevated">Content goes here</PlinthCard>
        </div>
      </section>

      <section>
        <h2>PlinthPanel</h2>
        <PlinthPanel title="Panel Title">
          Panel content
        </PlinthPanel>
      </section>

      <section>
        <h2>PlinthBadge</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <PlinthBadge label="Default" color="var(--acc)" />
          <PlinthBadge label="Success" color="var(--success)" />
          <PlinthBadge label="Warning" color="var(--warning)" />
          <PlinthBadge label="Error" color="var(--danger)" />
        </div>
      </section>

      <section>
        <h2>AlertBanner</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AlertBanner message="Info Alert" type="info" />
          <AlertBanner message="Success Alert" type="success" />
          <AlertBanner message="Warning Alert" type="warning" />
          <AlertBanner message="Error Alert" type="error" />
        </div>
      </section>
    </div>
  );
};
