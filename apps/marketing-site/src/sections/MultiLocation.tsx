import {
  BankOutlined,
  BranchesOutlined,
  GlobalOutlined,
  PieChartOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import React from 'react';

const { Title, Paragraph } = Typography;

export interface StatItem {
  key: string;
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: React.ReactNode;
}

export interface FeatureItem {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface MultiLocationProps {
  title?: string;
  description?: string;
  stats?: StatItem[];
  features?: FeatureItem[];
}

const DEFAULT_STATS: StatItem[] = [
  {
    key: 'locations',
    title: 'Locations Managed',
    value: '500+',
    prefix: <BankOutlined />,
  },
  {
    key: 'uptime',
    title: 'Enterprise Uptime',
    value: 99.99,
    suffix: '%',
    prefix: <SafetyCertificateOutlined />,
  },
  {
    key: 'global',
    title: 'Global Regions',
    value: 12,
    prefix: <GlobalOutlined />,
  },
];

const DEFAULT_FEATURES: FeatureItem[] = [
  {
    key: 'central-menu',
    icon: <BranchesOutlined />,
    title: 'Central Menu Control',
    description:
      'Manage menus, pricing, and promotions across all your locations from a single dashboard.',
  },
  {
    key: 'consolidated-reports',
    icon: <PieChartOutlined />,
    title: 'Consolidated Reports',
    description:
      'Get real-time insights with enterprise-grade reporting aggregated from every store.',
  },
  {
    key: 'inter-store',
    icon: <GlobalOutlined />,
    title: 'Inter-Store Transfers',
    description:
      'Seamlessly transfer inventory and track movements between your locations.',
  },
  {
    key: 'role-hierarchies',
    icon: <TeamOutlined />,
    title: 'Role Hierarchies',
    description:
      'Enforce granular permissions for regional managers, store managers, and staff.',
  },
];

export const MultiLocation: React.FC<MultiLocationProps> = ({
  title = 'Enterprise Management at Scale',
  description = 'Empower your multi-location restaurant brand with robust tools designed for complex operations.',
  stats = DEFAULT_STATS,
  features = DEFAULT_FEATURES,
}) => {
  return (
    <div style={{ padding: '60px 20px', backgroundColor: '#f0f2f5' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <Title level={2}>{title}</Title>
          <Paragraph style={{ fontSize: '18px', maxWidth: '800px', margin: '0 auto' }}>
            {description}
          </Paragraph>
        </div>

        <Row gutter={[24, 24]} justify="center" style={{ marginBottom: '48px' }}>
          {stats.map((stat) => (
            <Col xs={24} sm={8} key={stat.key}>
              <Card variant="borderless" style={{ textAlign: 'center' }}>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[24, 24]}>
          {features.map((feature) => (
            <Col xs={24} md={12} key={feature.key}>
              <Card variant="borderless" style={{ height: '100%' }}>
                <Row wrap={false} gutter={16}>
                  <Col>
                    <div style={{ fontSize: '32px', color: '#1890ff' }}>
                      {feature.icon}
                    </div>
                  </Col>
                  <Col flex="auto">
                    <Title level={4} style={{ marginTop: 0 }}>
                      {feature.title}
                    </Title>
                    <Paragraph style={{ marginBottom: 0, color: '#595959' }}>
                      {feature.description}
                    </Paragraph>
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};
