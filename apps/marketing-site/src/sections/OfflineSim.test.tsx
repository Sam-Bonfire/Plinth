import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { OfflineSim, simulateStates } from './OfflineSim';

describe('simulateStates helper', () => {
  it('returns correctly for Online', () => {
    const states = simulateStates('Online');
    expect(states).toEqual({
      pos: 'Sending Order',
      kds: 'Receiving Order',
      sync: 'Synced to Edge',
    });
  });

  it('returns correctly for Offline', () => {
    const states = simulateStates('Offline');
    expect(states).toEqual({
      pos: 'Queueing Locally',
      kds: 'Disconnected',
      sync: 'Pending Sync',
    });
  });

  it('returns correctly for Degraded LAN', () => {
    const states = simulateStates('Degraded LAN');
    expect(states).toEqual({
      pos: 'Sending Order (Slow)',
      kds: 'Receiving Order (Delayed)',
      sync: 'Syncing Intermittently',
    });
  });
});

describe('OfflineSim Component', () => {
  it('renders with default props', () => {
    render(<OfflineSim />);
    expect(screen.getByText('Offline-First Resilience Interactive Simulation')).toBeInTheDocument();

    // Check for default 'Online' mode active
    expect(screen.getByText('Sending Order')).toBeInTheDocument();
    expect(screen.getByText('Receiving Order')).toBeInTheDocument();
    expect(screen.getByText('Synced to Edge')).toBeInTheDocument();
  });

  it('changes states when radio buttons are clicked', () => {
    render(<OfflineSim />);

    const offlineRadio = screen.getByLabelText('Offline');
    fireEvent.click(offlineRadio);

    expect(screen.getByText('Queueing Locally')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Pending Sync')).toBeInTheDocument();

    const degradedRadio = screen.getByLabelText('Degraded LAN');
    fireEvent.click(degradedRadio);

    expect(screen.getByText('Sending Order (Slow)')).toBeInTheDocument();
    expect(screen.getByText('Receiving Order (Delayed)')).toBeInTheDocument();
    expect(screen.getByText('Syncing Intermittently')).toBeInTheDocument();
  });
});
