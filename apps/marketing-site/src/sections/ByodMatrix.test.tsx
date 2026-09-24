import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ByodMatrix, DeviceCompatibility } from './ByodMatrix.js';

describe('ByodMatrix', () => {
  beforeAll(() => {
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
  });

  it('renders default data correctly', () => {
    render(<ByodMatrix />);

    // Check headers
    expect(screen.getByText('Device Type')).toBeInTheDocument();
    expect(screen.getByText('USB')).toBeInTheDocument();
    expect(screen.getByText('Bluetooth')).toBeInTheDocument();
    expect(screen.getByText('LAN/WiFi')).toBeInTheDocument();

    // Check device types
    expect(screen.getByText('Printers')).toBeInTheDocument();
    expect(screen.getByText('Scanners')).toBeInTheDocument();
    expect(screen.getByText('Cash Drawers')).toBeInTheDocument();
    expect(screen.getByText('Card Readers')).toBeInTheDocument();

    // Check some specific statuses and notes
    expect(screen.getByText('Requires BLE 4.0+')).toBeInTheDocument();
    expect(screen.getByText('Via RJ12 to USB adapter or printer integration')).toBeInTheDocument();
    expect(screen.getByText('Select models only')).toBeInTheDocument();
  });

  it('renders custom data correctly', () => {
    const customData: DeviceCompatibility[] = [
      {
        key: 'custom-device',
        deviceType: 'Custom Device',
        usbStatus: 'No',
        bluetoothStatus: 'Partial',
        lanStatus: 'Supported',
        bluetoothNotes: 'Only v5.0',
      },
    ];

    render(<ByodMatrix data={customData} />);

    expect(screen.getByText('Custom Device')).toBeInTheDocument();
    expect(screen.getByText('Only v5.0')).toBeInTheDocument();
    expect(screen.queryByText('Printers')).not.toBeInTheDocument();
  });
});
