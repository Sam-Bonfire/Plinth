import { Button, Card, Col, Row, Typography } from 'antd';
import { useEffect, useState } from 'react';

const { Text, Title } = Typography;

export interface KdsItem {
  id: string;
  name: string;
  quantity: number;
}

export interface KdsTicket {
  id: string;
  orderNumber: string;
  createdAtMs: number;
  items: KdsItem[];
  status: 'active' | 'done';
}

export interface KdsDemoProps {
  initialTickets?: KdsTicket[];
}

export const advanceTicket = (tickets: KdsTicket[], ticketId: string): KdsTicket[] => {
  return tickets.map((ticket) =>
    ticket.id === ticketId ? { ...ticket, status: 'done' } : ticket
  );
};

export const formatElapsed = (createdAtMs: number, nowMs: number = Date.now()): string => {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const DEFAULT_TICKETS: KdsTicket[] = [
  {
    id: 't1',
    orderNumber: 'A12',
    createdAtMs: Date.now() - 120000,
    status: 'active',
    items: [
      { id: 'i1', name: 'Burger', quantity: 2 },
      { id: 'i2', name: 'Fries', quantity: 1 },
    ],
  },
  {
    id: 't2',
    orderNumber: 'A13',
    createdAtMs: Date.now() - 45000,
    status: 'active',
    items: [{ id: 'i3', name: 'Salad', quantity: 1 }],
  },
  {
    id: 't3',
    orderNumber: 'A14',
    createdAtMs: Date.now() - 15000,
    status: 'active',
    items: [{ id: 'i4', name: 'Soda', quantity: 3 }],
  }
];

export const KdsDemo: React.FC<KdsDemoProps> = ({ initialTickets = DEFAULT_TICKETS }) => {
  const [tickets, setTickets] = useState<KdsTicket[]>(initialTickets);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(() => Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBump = (id: string) => {
    setTickets((prev) => advanceTicket(prev, id));
  };

  const activeTickets = tickets.filter((t) => t.status === 'active');

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>KDS Live Sandbox</Title>
      <Row gutter={16}>
        {activeTickets.map((ticket) => (
          <Col span={8} key={ticket.id}>
            <Card
              title={`Order ${ticket.orderNumber}`}
              extra={<Text type="secondary">{formatElapsed(ticket.createdAtMs, nowMs)}</Text>}
              actions={[
                <Button key="bump" type="primary" onClick={() => handleBump(ticket.id)}>
                  Bump
                </Button>,
              ]}
            >
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                {ticket.items.map((item) => (
                  <li key={item.id} style={{ marginBottom: '8px' }}>
                    <Text strong>{item.quantity}x</Text> <Text>{item.name}</Text>
                  </li>
                ))}
              </ul>
            </Card>
          </Col>
        ))}
        {activeTickets.length === 0 && (
          <Col span={24}>
            <Text>No active tickets!</Text>
          </Col>
        )}
      </Row>
    </div>
  );
};
