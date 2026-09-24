import { Table, Tag } from 'antd';

export type ConnectionStatus = 'Supported' | 'Partial' | 'No';

export interface DeviceCompatibility {
  key: string;
  deviceType: string;
  usbStatus: ConnectionStatus;
  usbNotes?: string;
  bluetoothStatus: ConnectionStatus;
  bluetoothNotes?: string;
  lanStatus: ConnectionStatus;
  lanNotes?: string;
}

export interface ByodMatrixProps {
  data?: DeviceCompatibility[];
}

const DEFAULT_DATA: DeviceCompatibility[] = [
  {
    key: 'printers',
    deviceType: 'Printers',
    usbStatus: 'Supported',
    bluetoothStatus: 'Partial',
    bluetoothNotes: 'Requires BLE 4.0+',
    lanStatus: 'Supported',
  },
  {
    key: 'scanners',
    deviceType: 'Scanners',
    usbStatus: 'Supported',
    bluetoothStatus: 'Supported',
    lanStatus: 'No',
  },
  {
    key: 'cash-drawers',
    deviceType: 'Cash Drawers',
    usbStatus: 'Supported',
    usbNotes: 'Via RJ12 to USB adapter or printer integration',
    bluetoothStatus: 'No',
    lanStatus: 'No',
  },
  {
    key: 'card-readers',
    deviceType: 'Card Readers',
    usbStatus: 'Supported',
    bluetoothStatus: 'Supported',
    lanStatus: 'Partial',
    lanNotes: 'Select models only',
  },
];

const renderStatus = (status: ConnectionStatus, notes?: string) => {
  let color = 'default';
  if (status === 'Supported') color = 'success';
  if (status === 'Partial') color = 'warning';
  if (status === 'No') color = 'error';

  return (
    <div>
      <Tag color={color}>{status}</Tag>
      {notes && <div style={{ fontSize: '0.8em', marginTop: '4px', color: 'gray' }}>{notes}</div>}
    </div>
  );
};

export const ByodMatrix = ({ data = DEFAULT_DATA }: ByodMatrixProps): JSX.Element => {
  const columns = [
    {
      title: 'Device Type',
      dataIndex: 'deviceType',
      key: 'deviceType',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'USB',
      key: 'usb',
      render: (_: unknown, record: DeviceCompatibility) =>
        renderStatus(record.usbStatus, record.usbNotes),
    },
    {
      title: 'Bluetooth',
      key: 'bluetooth',
      render: (_: unknown, record: DeviceCompatibility) =>
        renderStatus(record.bluetoothStatus, record.bluetoothNotes),
    },
    {
      title: 'LAN/WiFi',
      key: 'lan',
      render: (_: unknown, record: DeviceCompatibility) =>
        renderStatus(record.lanStatus, record.lanNotes),
    },
  ];

  return <Table<DeviceCompatibility> columns={columns} dataSource={data} pagination={false} />;
};
