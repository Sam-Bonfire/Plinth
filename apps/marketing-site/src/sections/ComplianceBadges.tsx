import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import React from 'react';

const { Text, Title } = Typography;

export interface ComplianceBadgesProps {
  soc2?: string;
  iso27001?: string;
  gdpr?: string;
  pciDss?: string;
  dataOwnership?: string;
}

const defaultProps: ComplianceBadgesProps = {
  soc2: 'SOC 2 Type II Certified',
  iso27001: 'ISO 27001 Compliant',
  gdpr: 'GDPR Ready',
  pciDss: 'PCI-DSS Aware',
  dataOwnership: 'Your Data is Yours',
};

export const ComplianceBadges: React.FC<ComplianceBadgesProps> = (props) => {
  const { soc2, iso27001, gdpr, pciDss, dataOwnership } = { ...defaultProps, ...props };

  const badges = [
    { title: 'SOC 2', description: soc2 },
    { title: 'ISO 27001', description: iso27001 },
    { title: 'GDPR', description: gdpr },
    { title: 'PCI-DSS', description: pciDss },
    { title: 'Data Ownership', description: dataOwnership },
  ];

  return (
    <section style={{ padding: '64px 24px', backgroundColor: '#fafafa' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <Title level={2} style={{ marginBottom: 48 }}>
          Security & Compliance First
        </Title>
        <Row gutter={[24, 24]} justify="center">
          {badges.map((badge, index) => (
            <Col xs={24} sm={12} md={8} lg={4} key={index}>
              <Card
                variant="borderless"
                style={{ height: '100%', textAlign: 'center' }}
                styles={{ body: { padding: '24px 12px' } }}
              >
                <SafetyCertificateOutlined style={{ fontSize: 32, color: '#1677ff', marginBottom: 16 }} />
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    {badge.title}
                  </Text>
                  <Text type="secondary">{badge.description}</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
};
