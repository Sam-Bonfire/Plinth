import { CheckOutlined } from '@ant-design/icons';
import { Button, Card, Col, List, Row, Typography } from 'antd';
import React from 'react';

const { Title, Text } = Typography;

export interface PricingTier {
  id: string;
  name: string;
  price: string;
  features: string[];
  recommended?: boolean;
}

export interface PricingCardsProps {
  tiers?: PricingTier[];
}

const defaultTiers: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₹999/mo',
    features: [
      'Up to 1,000 customers',
      'Basic reporting',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₹2,999/mo',
    features: [
      'Up to 10,000 customers',
      'Advanced reporting',
      'Priority email & chat support',
      'Custom domains',
    ],
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    features: [
      'Unlimited customers',
      'Custom reporting',
      '24/7 dedicated support',
      'SLA guarantee',
      'On-premise deployment options',
    ],
  },
];

export const PricingCards: React.FC<PricingCardsProps> = ({ tiers = defaultTiers }) => {
  return (
    <div style={{ padding: '40px 0' }}>
      <Row gutter={[24, 24]} justify="center">
        {tiers.map((tier) => (
          <Col xs={24} md={8} lg={6} key={tier.id}>
            <Card
              hoverable
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderColor: tier.recommended ? '#1890ff' : undefined,
                borderWidth: tier.recommended ? 2 : 1,
                boxShadow: tier.recommended ? '0 8px 24px rgba(24,144,255,0.15)' : undefined,
                position: 'relative',
              }}
              styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%', flex: 1 } }}
            >
              {tier.recommended && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    backgroundColor: '#1890ff',
                    color: 'white',
                    padding: '4px 12px',
                    borderBottomLeftRadius: 8,
                    borderTopRightRadius: 8,
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                >
                  RECOMMENDED
                </div>
              )}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ marginBottom: 8 }}>{tier.name}</Title>
                <Title level={2} style={{ margin: 0, color: tier.recommended ? '#1890ff' : undefined }}>
                  {tier.price}
                </Title>
              </div>

              <List
                style={{ flex: 1, marginBottom: 24 }}
                dataSource={tier.features}
                renderItem={(item) => (
                  <List.Item style={{ borderBottom: 'none', padding: '8px 0' }}>
                    <Text>
                      <CheckOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                      {item}
                    </Text>
                  </List.Item>
                )}
              />

              <Button
                type={tier.recommended ? 'primary' : 'default'}
                size="large"
                block
                style={{ marginTop: 'auto' }}
              >
                {tier.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
