import { BarChart, PlinthAvatar } from "@plinth/ui-kit";
import { Button, Card, Col, Descriptions, Form, Input, List, Modal, Row, Space, Statistic, Table, Tag, Typography, message, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";

type Tier = "Gold" | "Silver" | "Bronze" | "New";

interface Customer {
  key: string;
  name: string;
  phone: string;
  orders: number;
  spend: number;
  lastVisit: string;
  tier: Tier;
}

type FreqPoint = {
  day: string;
  visits: number;
};

interface CustomerFormValues {
  name: string;
  phone: string;
}

const seedCustomers = (): Customer[] => [
  { key: "C-01", name: "Aarav Sharma", phone: "+91 98200 11223", orders: 48, spend: 18420, lastVisit: "Today 12:40", tier: "Gold" },
  { key: "C-02", name: "Priya Nair", phone: "+91 97401 22334", orders: 36, spend: 12980, lastVisit: "Today 11:05", tier: "Gold" },
  { key: "C-03", name: "Rohan Mehta", phone: "+91 98111 33445", orders: 21, spend: 7640, lastVisit: "Yesterday 20:15", tier: "Silver" },
  { key: "C-04", name: "Sneha Iyer", phone: "+91 96320 44556", orders: 12, spend: 3910, lastVisit: "Yesterday 13:50", tier: "Silver" },
  { key: "C-05", name: "Vikram Rao", phone: "+91 98860 55667", orders: 5, spend: 1620, lastVisit: "2 days ago", tier: "Bronze" },
  { key: "C-06", name: "Ananya Das", phone: "+91 97170 66778", orders: 1, spend: 340, lastVisit: "2 days ago", tier: "New" },
];

const frequency: FreqPoint[] = [
  { day: "Mon", visits: 96 },
  { day: "Tue", visits: 104 },
  { day: "Wed", visits: 118 },
  { day: "Thu", visits: 122 },
  { day: "Fri", visits: 164 },
  { day: "Sat", visits: 201 },
  { day: "Sun", visits: 187 },
];

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const tierColor = (t: Tier): string => (t === "Gold" ? "gold" : t === "Silver" ? "geekblue" : t === "Bronze" ? "orange" : "green");

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(seedCustomers);
  const [query, setQuery] = useState<string>("");
  const [viewed, setViewed] = useState<Customer | null>(null);
  const [adding, setAdding] = useState<boolean>(false);
  const [form] = Form.useForm<CustomerFormValues>();

  const rows = useMemo((): Customer[] => {
    const q = query.trim().toLowerCase();
    if (q === "") return customers;
    return customers.filter((c: Customer): boolean => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")));
  }, [customers, query]);

  const top = useMemo((): Customer[] => [...customers].sort((a: Customer, b: Customer): number => b.spend - a.spend).slice(0, 3), [customers]);

  const openAdd = (): void => {
    form.setFieldsValue({ name: "", phone: "" });
    setAdding(true);
  };

  const saveAdded = (values: CustomerFormValues): void => {
    const key = `C-${customers.length + 1}-${values.name.length}`;
    setCustomers((prev: Customer[]): Customer[] => [...prev, { key, orders: 0, spend: 0, lastVisit: "Just now", tier: "New", ...values }]);
    void message.success(`Customer ${values.name} added.`);
    setAdding(false);
  };

  const columns: TableColumnsType<Customer> = [
    {
      title: "Customer",
      dataIndex: "name",
      key: "name",
      render: (name: string): React.ReactNode => (
        <Space>
          <PlinthAvatar name={name} size="sm" />
          <Typography.Text strong>{name}</Typography.Text>
        </Space>
      ),
    },
    { title: "Phone", dataIndex: "phone", key: "phone", width: 160 },
    { title: "Orders", dataIndex: "orders", key: "orders", width: 80, align: "right" },
    { title: "Total Spend", dataIndex: "spend", key: "spend", width: 120, align: "right", render: (s: number): React.ReactNode => inr(s) },
    { title: "Last Visit", dataIndex: "lastVisit", key: "lastVisit", width: 140 },
    { title: "Tier", dataIndex: "tier", key: "tier", width: 100, render: (t: Tier): React.ReactNode => <Tag color={tierColor(t)}>{t}</Tag> },
    {
      title: "Action",
      key: "action",
      width: 80,
      render: (_: unknown, row: Customer): React.ReactNode => (
        <Button size="small" onClick={(): void => setViewed(row)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Customers" value={1842} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Returning Rate" value={61} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Avg Order Value" value={inr(336)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Orders Today" value={847} />
          </Card>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={16}>
          <Card
            title="Customer Directory"
            extra={
              <Space>
                <Input allowClear placeholder="Search by name/phone…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 220 }} />
                <Button size="small" type="primary" onClick={openAdd}>
                  + Add
                </Button>
              </Space>
            }
          >
            <Table<Customer> dataSource={rows} columns={columns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No customers match." }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Top Customers" style={{ marginBottom: 16 }}>
            <List
              dataSource={top}
              renderItem={(c: Customer): React.ReactNode => (
                <List.Item>
                  <List.Item.Meta avatar={<PlinthAvatar name={c.name} size="sm" />} title={c.name} description={`${c.orders} orders`} />
                  <Typography.Text strong>{inr(c.spend)}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>
          <Card title="Visit Frequency">
            <BarChart data={frequency} xField="day" yField="visits" height={200} />
          </Card>
        </Col>
      </Row>

      <Modal title={viewed?.name ?? "Customer"} open={viewed !== null} onCancel={(): void => setViewed(null)} footer={null}>
        {viewed !== null && (
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="Phone">{viewed.phone}</Descriptions.Item>
            <Descriptions.Item label="Tier">{viewed.tier}</Descriptions.Item>
            <Descriptions.Item label="Orders">{viewed.orders}</Descriptions.Item>
            <Descriptions.Item label="Total Spend">{inr(viewed.spend)}</Descriptions.Item>
            <Descriptions.Item label="Last Visit">{viewed.lastVisit}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal title="Add Customer" open={adding} onOk={(): void => { void form.submit(); }} onCancel={(): void => setAdding(false)} okText="Add">
        <Form form={form} layout="vertical" onFinish={saveAdded} preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Customer name" />
          </Form.Item>
          <Form.Item name="phone" label="Phone" rules={[{ required: true, message: "Phone is required" }]}>
            <Input placeholder="+91 …" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
