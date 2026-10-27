import { Card, Flex, List, Tag, Typography, Steps } from 'antd';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inr } from './cart.js';
import { loadOrders } from './session.js';

const { Title, Text } = Typography;

const apiBase = (): string => import.meta.env.VITE_API_BASE_URL || '';

export const Orders = (): React.JSX.Element => {
  const [orders] = useState(loadOrders);
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const TERMINAL_STATUSES = ['Served', 'Settled', 'Voided', 'Refunded'];
    
    const refresh = async (): Promise<void> => {
      // Create a mutable copy to avoid updating state if nothing changed, 
      // but simpler to just fetch non-terminal ones and merge.
      
      const toFetch = orders.filter(o => {
        // liveStatus holds previous states, if it's already terminal, don't poll
        const current = liveStatus[o.order_id];
        return !current || !TERMINAL_STATUSES.includes(current);
      });
      
      if (toFetch.length === 0) return;

      const entries = await Promise.all(
        toFetch.map(async (o) => {
          try {
            const res = await fetch(`${apiBase()}/api/v1/public/orders/${o.order_id}/status?tenant_id=${o.tenant_id}`);
            if (!res.ok) return null;
            const data = (await res.json()) as { status?: string };
            return typeof data.status === 'string' ? ([o.order_id, data.status] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setLiveStatus(prev => {
          const updates = Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
          if (Object.keys(updates).length === 0) return prev;
          return { ...prev, ...updates };
        });
      }
    };
    
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return (): void => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orders, liveStatus]);

  if (orders.length === 0) {
    return (
      <Flex vertical align="center" justify="center" style={{ minHeight: '100vh', padding: '16px' }}>
        <Title level={1} style={{ fontSize: 24 }}>My Orders</Title>
        <Text type="secondary" style={{ textAlign: 'center' }}>
          No orders yet.
        </Text>
        <Link to="/">Browse the menu</Link>
      </Flex>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <Title level={1} style={{ textAlign: 'center', fontSize: 24 }}>
        My Orders
      </Title>
      <List
        dataSource={orders}
        renderItem={(o) => {
          const status = liveStatus[o.order_id] ?? 'Draft';
          const isError = status === 'Voided' || status === 'Refunded';
          
          let currentStep = 0;
          if (status === 'Preparing') currentStep = 1;
          else if (status === 'Ready') currentStep = 2;
          else if (status === 'Served' || status === 'Settled') currentStep = 3;

          return (
            <List.Item key={o.order_id}>
              <Card size="small" style={{ width: '100%' }}>
                <Flex justify="space-between" align="flex-start" style={{ marginBottom: isError ? 0 : 16 }}>
                  <div>
                    <Text strong>{o.order_id}</Text>
                    <br />
                    <Text type="secondary">
                      {o.itemCount} items · {inr(o.total_minor)} · Ticket {o.ticket_id}
                    </Text>
                  </div>
                  {isError && <Tag color="error">{status}</Tag>}
                </Flex>
                {!isError && (
                  <Steps
                    size="small"
                    current={currentStep}
                    items={[
                      { title: 'Confirmed' },
                      { title: 'Preparing' },
                      { title: 'Ready' },
                      { title: 'Served' },
                    ]}
                  />
                )}
              </Card>
            </List.Item>
          );
        }}
      />
    </div>
  );
};
