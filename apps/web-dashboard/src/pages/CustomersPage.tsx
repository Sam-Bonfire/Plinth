import { BarChart, PlinthAvatar } from "@plinth/ui-kit";
import { Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, List, Modal, Row, Select, Space, Statistic, Table, Tag, Timeline, Typography, message, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";

type Tier = "Gold" | "Silver" | "Bronze" | "New";

interface Customer {
  key: string;
  name: string;
  phone: string;
  visits: number;
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
  { key: "C-01", name: "Aarav Sharma", phone: "+91 98200 11223", visits: 48, spend: 18420, lastVisit: "Today 12:40", tier: "Gold" },
  { key: "C-02", name: "Priya Nair", phone: "+91 97401 22334", visits: 36, spend: 12980, lastVisit: "Today 11:05", tier: "Gold" },
  { key: "C-03", name: "Rohan Mehta", phone: "+91 98111 33445", visits: 21, spend: 7640, lastVisit: "Yesterday 20:15", tier: "Silver" },
  { key: "C-04", name: "Sneha Iyer", phone: "+91 96320 44556", visits: 12, spend: 3910, lastVisit: "Yesterday 13:50", tier: "Silver" },
  { key: "C-05", name: "Vikram Rao", phone: "+91 98860 55667", visits: 5, spend: 1620, lastVisit: "2 days ago", tier: "Bronze" },
  { key: "C-06", name: "Ananya Das", phone: "+91 97170 66778", visits: 1, spend: 340, lastVisit: "2 days ago", tier: "New" },
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
  const [tierFilter, setTierFilter] = useState<Tier | "All">("All");
  const [minVisits, setMinVisits] = useState<number | null>(null);
  const [minSpend, setMinSpend] = useState<number | null>(null);
  const [viewed, setViewed] = useState<Customer | null>(null);
  const [adding, setAdding] = useState<boolean>(false);
  const [form] = Form.useForm<CustomerFormValues>();

  const rows = useMemo((): Customer[] => {
    let result = customers;

    // Search
    const q = query.trim().toLowerCase();
    if (q !== "") {
      result = result.filter((c: Customer): boolean => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")));
    }

    // Tier filter
    if (tierFilter !== "All") {
      result = result.filter((c: Customer): boolean => c.tier === tierFilter);
    }

    // Min Visits filter
    if (minVisits !== null) {
      result = result.filter((c: Customer): boolean => c.visits >= minVisits);
    }

    // Min Spend filter
    if (minSpend !== null) {
      result = result.filter((c: Customer): boolean => c.spend >= minSpend);
    }

    return result;
  }, [customers, query, tierFilter, minVisits, minSpend]);

  const top = useMemo((): Customer[] => [...customers].sort((a: Customer, b: Customer): number => b.spend - a.spend).slice(0, 3), [customers]);

  const openAdd = (): void => {
    form.setFieldsValue({ name: "", phone: "" });
    setAdding(true);
  };

  const saveAdded = (values: CustomerFormValues): void => {
    const key = `C-${customers.length + 1}-${values.name.length}`;
    setCustomers((prev: Customer[]): Customer[] => [...prev, { key, visits: 0, spend: 0, lastVisit: "Just now", tier: "New", ...values }]);
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
    { title: "Visits", dataIndex: "visits", key: "visits", width: 80, align: "right" },
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
              <Button size="small" type="primary" onClick={openAdd}>
                + Add
              </Button>
            }
          >
            <Space style={{ marginBottom: 16 }} wrap>
              <Input allowClear placeholder="Search by name/phone…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 220 }} />
              <Select<Tier | "All">
                value={tierFilter}
                onChange={(val) => setTierFilter(val)}
                style={{ width: 120 }}
                options={[
                  { label: "All Tiers", value: "All" },
                  { label: "Gold", value: "Gold" },
                  { label: "Silver", value: "Silver" },
                  { label: "Bronze", value: "Bronze" },
                  { label: "New", value: "New" },
                ]}
              />
              <InputNumber
                placeholder="Min Visits"
                value={minVisits}
                onChange={(val) => setMinVisits(val)}
                min={0}
                style={{ width: 120 }}
              />
              <InputNumber
                placeholder="Min Spend (₹)"
                value={minSpend}
                onChange={(val) => setMinSpend(val)}
                min={0}
                style={{ width: 140 }}
              />
            </Space>
            <Table<Customer> dataSource={rows} columns={columns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No customers match." }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Top Customers" style={{ marginBottom: 16 }}>
            <List
              dataSource={top}
              renderItem={(c: Customer): React.ReactNode => (
                <List.Item>
                  <List.Item.Meta avatar={<PlinthAvatar name={c.name} size="sm" />} title={c.name} description={`${c.visits} visits`} />
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

      <Drawer
        title="Customer Profile"
        placement="right"
        width={400}
        onClose={(): void => setViewed(null)}
        open={viewed !== null}
      >
        {viewed !== null && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <PlinthAvatar name={viewed.name} size={64} style={{ marginBottom: 16 }} />
              <Typography.Title level={4} style={{ margin: 0 }}>
                {viewed.name}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                {viewed.phone}
              </Typography.Text>
              <Tag color={tierColor(viewed.tier)}>{viewed.tier}</Tag>
            </div>

            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Visits">{viewed.visits}</Descriptions.Item>
              <Descriptions.Item label="Total Spend">{inr(viewed.spend)}</Descriptions.Item>
              <Descriptions.Item label="Last Visit" span={2}>{viewed.lastVisit}</Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Title level={5}>Activity Timeline</Typography.Title>
              {/* Honest mock timeline until visit history API exists */}
              <Timeline
                items={Array.from({ length: Math.min(viewed.visits, 5) }).map((_, i) => ({
                  color: i === 0 ? "blue" : "gray",
                  children: (
                    <>
                      <Typography.Text strong>{i === 0 ? viewed.lastVisit : `${i + 1} visits ago`}</Typography.Text>
                      <br />
                      <Typography.Text type="secondary">
                        Spent {inr(Math.round(viewed.spend / viewed.visits))}
                      </Typography.Text>
                    </>
                  ),
                }))}
              />
            </div>
          </Space>
        )}
      </Drawer>

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
