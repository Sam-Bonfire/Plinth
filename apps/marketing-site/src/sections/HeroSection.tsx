import { Button, Card, Col, List, Row, Typography } from 'antd';
import React, { useState } from 'react';

const { Title, Paragraph } = Typography;

export interface MenuItem {
  id: string;
  name: string;
  priceCents: number;
}

export interface BillItem extends MenuItem {
  quantity: number;
}

export interface HeroSectionProps {
  headline?: string;
  subcopy?: string;
  primaryCtaText?: string;
  secondaryCtaText?: string;
  onPrimaryCtaClick?: () => void;
  onSecondaryCtaClick?: () => void;
}

export const calculateTotal = (items: BillItem[]): number => {
  return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
};

const DEFAULT_MENU: MenuItem[] = [
  { id: '1', name: 'Espresso', priceCents: 350 },
  { id: '2', name: 'Latte', priceCents: 450 },
  { id: '3', name: 'Croissant', priceCents: 300 },
  { id: '4', name: 'Avocado Toast', priceCents: 850 },
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  headline = 'Power Your Restaurant',
  subcopy = 'The all-in-one POS and management system built for modern hospitality.',
  primaryCtaText = 'Get Started',
  secondaryCtaText = 'Book a Demo',
  onPrimaryCtaClick,
  onSecondaryCtaClick,
}) => {
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  const handleAddItem = (menuItem: MenuItem) => {
    setBillItems((prev) => {
      const existingItem = prev.find((item) => item.id === menuItem.id);
      if (existingItem) {
        return prev.map((item) =>
          item.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...menuItem, quantity: 1 }];
    });
  };

  const totalCents = calculateTotal(billItems);
  const formattedTotal = `$${(totalCents / 100).toFixed(2)}`;

  return (
    <section style={{ padding: '4rem 2rem', background: '#f5f5f5' }}>
      <Row gutter={[32, 32]} align="middle" justify="center">
        <Col xs={24} lg={10}>
          <Title level={1}>{headline}</Title>
          <Paragraph style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
            {subcopy}
          </Paragraph>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button type="primary" size="large" onClick={onPrimaryCtaClick}>
              {primaryCtaText}
            </Button>
            <Button size="large" onClick={onSecondaryCtaClick}>
              {secondaryCtaText}
            </Button>
          </div>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="POS Terminal Mockup" style={{ minHeight: '400px' }} variant="borderless">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Title level={4}>Menu</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {DEFAULT_MENU.map((item) => (
                    <Button
                      key={item.id}
                      style={{ height: '80px', whiteSpace: 'normal' }}
                      onClick={() => handleAddItem(item)}
                    >
                      {item.name}<br />
                      ${(item.priceCents / 100).toFixed(2)}
                    </Button>
                  ))}
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <Title level={4}>Current Bill</Title>
                <Card styles={{ body: { padding: '12px' } }}>
                  <List
                    size="small"
                    dataSource={billItems}
                    locale={{ emptyText: 'No items yet' }}
                    renderItem={(item) => (
                      <List.Item
                        extra={<span>${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>}
                      >
                        {item.quantity}x {item.name}
                      </List.Item>
                    )}
                  />
                  <div style={{ marginTop: '16px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Title level={4} style={{ margin: 0 }}>Total</Title>
                      <Title level={4} style={{ margin: 0 }}>{formattedTotal}</Title>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </section>
  );
};
