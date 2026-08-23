import { Badge, Button, Card, Col, Divider, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import React from 'react';

const { Title, Text } = Typography;

export type ShowcaseSceneName = 'active-order' | 'kds-station' | 'shift-reconciliation';

interface OrderItemRow {
  key: string;
  item: string;
  qty: number;
  price: string;
  tax: string;
  notes?: string;
}

export const ShowcaseActiveOrder: React.FC = () => {
  const dataSource: OrderItemRow[] = [
    { key: '1', item: 'Butter Chicken (Double Bone)', qty: 2, price: '₹760.00', tax: '5% GST', notes: 'Medium Spicy' },
    { key: '2', item: 'Garlic Naan (Crisp)', qty: 4, price: '₹240.00', tax: '5% GST', notes: 'Extra Butter' },
    { key: '3', item: 'Mango Lassi (Cold)', qty: 2, price: '₹220.00', tax: '12% GST', notes: 'No Ice' },
  ];

  const columns = [
    {
      title: 'Item Description',
      dataIndex: 'item',
      key: 'item',
      render: (text: string, record: OrderItemRow): React.ReactNode => (
        <div>
          <Text strong>{text}</Text>
          {record.notes && <div><Text type="secondary" style={{ fontSize: 12 }}>Note: {record.notes}</Text></div>}
        </div>
      ),
    },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 60 },
    { title: 'Tax Slab', dataIndex: 'tax', key: 'tax', width: 90, render: (t: string): React.ReactNode => <Tag color="blue">{t}</Tag> },
    { title: 'Amount', dataIndex: 'price', key: 'price', width: 110, align: 'right' as const },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Row gutter={24}>
        <Col span={16}>
          <Card title="Table T-04 — Current Dine-In Order #ORD-1098" extra={<Tag color="green">CONFIRMED (FIRED)</Tag>}>
            <Table dataSource={dataSource} columns={columns} pagination={false} size="middle" />
            <Divider />
            <Row justify="space-between">
              <Col span={12}>
                <Text type="secondary">Server: Rajesh K. (ID #402)</Text><br />
                <Text type="secondary">Terminal: POS-MAIN-01</Text>
              </Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <div><Text>Subtotal: </Text><Text strong>₹1,220.00</Text></div>
                <div><Text>Discount (Happy Hour 10%): </Text><Text type="danger">-₹122.00</Text></div>
                <div><Text>GST Tax Total (5% & 12%): </Text><Text strong>₹78.30</Text></div>
                <Divider style={{ margin: '8px 0' }} />
                <Title level={4} style={{ margin: 0 }}>Total Due: ₹1,176.30</Title>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Tender & Quick Actions">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block>Split Bill / Table Transfer</Button>
              <Button size="large" block style={{ background: '#52c41a', color: '#fff' }}>Accept UPI Payment</Button>
              <Button size="large" block>Accept Cash / Card</Button>
              <Button danger size="large" block>Supervisor Void</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const ShowcaseKdsStation: React.FC = () => {
  return (
    <div style={{ padding: 24, background: '#141414', minHeight: '100vh', color: '#fff' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col><Title level={3} style={{ color: '#fff', margin: 0 }}>KDS Station — Grill & Tandoor [Station #02]</Title></Col>
        <Col><Tag color="orange" style={{ fontSize: 16, padding: '4px 12px' }}>3 Active Tickets</Tag></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="KOT #042 — Table T-04" extra={<Badge status="error" text={<span style={{ color: '#ff4d4f' }}>14m (Late)</span>} />}>
            <p><strong>2x</strong> Butter Chicken (Double Bone)</p>
            <p><strong>4x</strong> Garlic Naan (Crisp)</p>
            <Divider />
            <Button type="primary" danger block size="large">BUMP TICKET</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="KOT #043 — Swiggy #SW-9921" extra={<Badge status="warning" text={<span style={{ color: '#faad14' }}>6m (Warning)</span>} />}>
            <p><strong>1x</strong> Chicken Tikka Masala</p>
            <p><strong>2x</strong> Tandoori Roti</p>
            <Divider />
            <Button type="primary" block size="large">BUMP TICKET</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="KOT #044 — Table T-09" extra={<Badge status="processing" text={<span style={{ color: '#52c41a' }}>2m (On Time)</span>} />}>
            <p><strong>2x</strong> Paneer Tikka (Ajwaini)</p>
            <p><strong>1x</strong> Tandoori Chaap</p>
            <Divider />
            <Button type="primary" block size="large">BUMP TICKET</Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const ShowcaseShiftReconciliation: React.FC = () => {
  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Card title="Shift Close & Till Reconciliation — Shift #SH-881" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Row gutter={24}>
          <Col span={8}><Statistic title="Opening Float" value={5000} prefix="₹" /></Col>
          <Col span={8}><Statistic title="Gross Cash Sales" value={18420} prefix="₹" /></Col>
          <Col span={8}><Statistic title="Expected Cash in Drawer" value={23420} prefix="₹" valueStyle={{ color: '#3f8600' }} /></Col>
        </Row>
        <Divider />
        <Row gutter={24}>
          <Col span={12}><Statistic title="UPI / QR Digital Settlements" value={42950} prefix="₹" /></Col>
          <Col span={12}><Statistic title="Credit / Debit Card Settlements" value={31200} prefix="₹" /></Col>
        </Row>
        <Divider />
        <Button type="primary" size="large" block>Authorize & Generate Z-Report</Button>
      </Card>
    </div>
  );
};

export const ShowcaseView: React.FC<{ scene?: string }> = ({ scene = 'active-order' }) => {
  if (scene === 'kds-station') return <ShowcaseKdsStation />;
  if (scene === 'shift-reconciliation') return <ShowcaseShiftReconciliation />;
  return <ShowcaseActiveOrder />;
};
