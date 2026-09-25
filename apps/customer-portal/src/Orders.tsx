import { Card, Flex, List, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { loadOrders } from './session.js';

const { Title, Text } = Typography;

export const Orders = (): React.JSX.Element => {
  const [orders] = useState(loadOrders);

  if (orders.length === 0) {
    return (
      <Flex vertical align="center" justify="center" style={{ minHeight: '100vh', padding: '16px' }}>
        <Title level={2}>My Orders</Title>
        <Text type="secondary" style={{ textAlign: 'center' }}>
          No orders yet.
        </Text>
        <Link to="/">Browse the menu</Link>
      </Flex>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <Title level={2} style={{ textAlign: 'center' }}>
        My Orders
      </Title>
      <List
        dataSource={orders}
        renderItem={(o) => (
          <List.Item key={o.order_id}>
            <Card size="small" style={{ width: '100%' }}>
              <Flex justify="space-between" align="center">
                <div>
                  <Text strong>{o.order_id}</Text>
                  <br />
                  <Text type="secondary">
                    {o.itemCount} items · ${(o.total_minor / 100).toFixed(2)} · Ticket {o.ticket_id}
                  </Text>
                </div>
                <Tag color="processing">Placed</Tag>
              </Flex>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};
