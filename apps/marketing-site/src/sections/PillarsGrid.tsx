import {
  ApiOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import React from 'react';

const { Title, Paragraph } = Typography;

export interface PillarItem {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface PillarsGridProps {
  pillars?: PillarItem[];
}

const DEFAULT_PILLARS: PillarItem[] = [
  {
    key: 'offline-first',
    icon: <WifiOutlined />,
    title: 'Offline-First',
    description: 'Keep your restaurant running smoothly even when the internet goes down.',
  },
  {
    key: 'double-entry',
    icon: <DatabaseOutlined />,
    title: 'Double-Entry Ledger',
    description: 'A solid financial foundation ensuring reliable and accurate accounting.',
  },
  {
    key: 'lan-kds',
    icon: <ApiOutlined />,
    title: 'LAN KDS',
    description: 'Lightning-fast local area network kitchen display system for instant updates.',
  },
  {
    key: 'edge-sync',
    icon: <CloudSyncOutlined />,
    title: 'Edge Sync',
    description: 'Seamlessly sync data across your devices and the cloud at the edge.',
  },
];

export const PillarsGrid: React.FC<PillarsGridProps> = ({
  pillars = DEFAULT_PILLARS,
}) => {
  return (
    <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <Row gutter={[24, 24]} justify="center">
        {pillars.map((pillar) => (
          <Col xs={24} sm={12} md={6} key={pillar.key}>
            <Card
              variant="borderless"
              style={{ height: '100%', textAlign: 'center' }}
            >
              <div style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }}>
                {pillar.icon}
              </div>
              <Title level={4} style={{ marginBottom: '12px' }}>
                {pillar.title}
              </Title>
              <Paragraph style={{ marginBottom: 0 }}>
                {pillar.description}
              </Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
