import { Button, Card, Empty, List, Typography } from 'antd';
import React from 'react';
import { usePosCartStore } from '../stores/posCart.js';

const { Text } = Typography;

export const ParkedOrders: React.FC = () => {
  const parkedOrders = usePosCartStore((state) => state.parkedOrders);
  const resumeOrder = usePosCartStore((state) => state.resumeOrder);
  const voidOrder = usePosCartStore((state) => state.voidOrder);

  if (parkedOrders.length === 0) {
    return (
      <Empty
        description="No parked orders"
        styles={{ image: { height: 60 } }}
      />
    );
  }

  return (
    <List
      dataSource={parkedOrders}
      renderItem={(order) => {
        const itemCount = order.lines.reduce((sum, line) => sum + line.qty, 0);
        const subtotal = order.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);

        return (
          <List.Item>
            <Card
              size="small"
              style={{ width: '100%' }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong>{order.customerLabel}</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {new Date(order.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </div>
              }
            >
              <div style={{ marginBottom: '12px' }}>
                <Text>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Text>
                <br />
                <Text type="secondary">Total: ${(subtotal / 100).toFixed(2)}</Text>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button
                  danger
                  onClick={() => voidOrder(order.id)}
                >
                  Void
                </Button>
                <Button
                  type="primary"
                  onClick={() => resumeOrder(order.id)}
                >
                  Resume
                </Button>
              </div>
            </Card>
          </List.Item>
        );
      }}
    />
  );
};
