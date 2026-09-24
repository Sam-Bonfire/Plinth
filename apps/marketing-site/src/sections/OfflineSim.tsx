import { Card, Radio, Space, Tag } from 'antd';
import { useState } from 'react';

export type NetworkMode = 'Online' | 'Offline' | 'Degraded LAN';

export interface SimulatedStates {
  pos: string;
  kds: string;
  sync: string;
}

export function simulateStates(mode: NetworkMode): SimulatedStates {
  switch (mode) {
    case 'Online':
      return {
        pos: 'Sending Order',
        kds: 'Receiving Order',
        sync: 'Synced to Edge',
      };
    case 'Offline':
      return {
        pos: 'Queueing Locally',
        kds: 'Disconnected',
        sync: 'Pending Sync',
      };
    case 'Degraded LAN':
      return {
        pos: 'Sending Order (Slow)',
        kds: 'Receiving Order (Delayed)',
        sync: 'Syncing Intermittently',
      };
    default:
      return {
        pos: 'Unknown',
        kds: 'Unknown',
        sync: 'Unknown',
      };
  }
}

export interface OfflineSimProps {
  initialMode?: NetworkMode;
  title?: string;
}

export const OfflineSim = ({
  initialMode = 'Online',
  title = 'Offline-First Resilience Interactive Simulation',
}: OfflineSimProps): JSX.Element => {
  const [mode, setMode] = useState<NetworkMode>(initialMode);
  const states = simulateStates(mode);

  return (
    <Card title={title}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Radio.Group
          buttonStyle="solid"
          optionType="button"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as NetworkMode);
          }}
        >
          <Radio.Button value="Online">Online</Radio.Button>
          <Radio.Button value="Offline">Offline</Radio.Button>
          <Radio.Button value="Degraded LAN">Degraded LAN</Radio.Button>
        </Radio.Group>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Card title="POS (Point of Sale)" type="inner">
            <Tag color={mode === 'Offline' ? 'warning' : 'processing'}>{states.pos}</Tag>
          </Card>
          <Card title="LAN KDS (Kitchen Display System)" type="inner">
            <Tag color={mode === 'Offline' ? 'error' : 'processing'}>{states.kds}</Tag>
          </Card>
          <Card title="Edge Sync" type="inner">
            <Tag color={mode === 'Online' ? 'success' : 'warning'}>{states.sync}</Tag>
          </Card>
        </Space>
      </Space>
    </Card>
  );
};
