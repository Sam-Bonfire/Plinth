import { FrequencyChart, PlinthAvatar } from "@plinth/ui-kit";
import { Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, List, Modal, Rate, Row, Segmented, Space, Statistic, Table, Tabs, Tag, Timeline, Typography, message, type TableColumnsType } from "antd";
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

interface CustomerFormValues {
  name: string;
  phone: string;
}

type MessStatus = "Active" | "Suspended" | "Closed";

interface MessAccount {
  key: string;
  name: string;
  balance: number;
  status: MessStatus;
}

interface LedgerRow {
  date: string;
  account: string;
  type: string;
  amount: number;
  memo: string;
}

export interface Feedback {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
}

const seedMessAccounts = (): MessAccount[] => [
  { key: "M-01", name: "Corporate Staff", balance: 5000, status: "Active" },
  { key: "M-02", name: "Student Hostel A", balance: 1200, status: "Active" },
  { key: "M-03", name: "Guest Faculty", balance: -500, status: "Suspended" },
];

const seedLedgerRows = (): LedgerRow[] => [
  { date: "2023-10-01", account: "Corporate Staff", type: "Top-up", amount: 10000, memo: "Monthly allowance" },
  { date: "2023-10-05", account: "Corporate Staff", type: "Debit", amount: -5000, memo: "Lunch meals" },
  { date: "2023-10-02", account: "Student Hostel A", type: "Top-up", amount: 5000, memo: "Advance" },
  { date: "2023-10-06", account: "Student Hostel A", type: "Debit", amount: -3800, memo: "Breakfast + Dinner" },
  { date: "2023-10-03", account: "Guest Faculty", type: "Debit", amount: -500, memo: "Overdraft" },
];

const seedCustomers = (): Customer[] => [
  { key: "C-01", name: "Aarav Sharma", phone: "+91 98200 11223", orders: 48, spend: 18420, lastVisit: "Today 12:40", tier: "Gold" },
  { key: "C-02", name: "Priya Nair", phone: "+91 97401 22334", orders: 36, spend: 12980, lastVisit: "Today 11:05", tier: "Gold" },
  { key: "C-03", name: "Rohan Mehta", phone: "+91 98111 33445", orders: 21, spend: 7640, lastVisit: "Yesterday 20:15", tier: "Silver" },
  { key: "C-04", name: "Sneha Iyer", phone: "+91 96320 44556", orders: 12, spend: 3910, lastVisit: "Yesterday 13:50", tier: "Silver" },
  { key: "C-05", name: "Vikram Rao", phone: "+91 98860 55667", orders: 5, spend: 1620, lastVisit: "2 days ago", tier: "Bronze" },
  { key: "C-06", name: "Ananya Das", phone: "+91 97170 66778", orders: 1, spend: 340, lastVisit: "2 days ago", tier: "New" },
];

const seedFeedbacks = (): Feedback[] => [
  { id: "F-01", customerName: "Aarav Sharma", rating: 5, comment: "Excellent service and food quality!", date: "2023-10-09" },
  { id: "F-02", customerName: "Priya Nair", rating: 4, comment: "Good taste, but waiting time was a bit long.", date: "2023-10-08" },
  { id: "F-03", customerName: "Vikram Rao", rating: 5, comment: "Loved the new dessert menu.", date: "2023-10-05" },
  { id: "F-04", customerName: "Ananya Das", rating: 3, comment: "Average experience.", date: "2023-10-02" },
];

export const avgRating = (feedbacks: Feedback[]): number => {
  if (feedbacks.length === 0) return 0;
  const total = feedbacks.reduce((acc: number, f: Feedback): number => acc + f.rating, 0);
  return total / feedbacks.length;
};


const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const tierColor = (t: Tier): string => (t === "Gold" ? "gold" : t === "Silver" ? "geekblue" : t === "Bronze" ? "orange" : "green");

const activityFor = (c: Customer): { label: string; text: string }[] => [
  { label: c.lastVisit, text: `Most recent visit • lifetime ${c.orders} visits` },
  { label: "Lifetime", text: `Total spend ${inr(c.spend)} across ${c.orders} visits` },
  { label: "Tier", text: `${c.tier} tier customer` },
];

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(seedCustomers);
  const [query, setQuery] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("All");
  const [minOrders, setMinOrders] = useState<number | null>(null);
  const [minSpend, setMinSpend] = useState<number | null>(null);
  const [viewed, setViewed] = useState<Customer | null>(null);
  const [adding, setAdding] = useState<boolean>(false);
  const [form] = Form.useForm<CustomerFormValues>();

  const [messAccounts, setMessAccounts] = useState<MessAccount[]>(seedMessAccounts);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>(seedLedgerRows);
  const [feedbacks] = useState<Feedback[]>(seedFeedbacks());
  const [messQuery, setMessQuery] = useState<string>("");
  const [topUpAccount, setTopUpAccount] = useState<MessAccount | null>(null);
  const [topUpForm] = Form.useForm<{ amount: number; memo: string }>();

  const frequencyEntries = useMemo(() => customers.map(c => ({ visits: c.orders })), [customers]);

  const rows = useMemo((): Customer[] => {
    const q = query.trim().toLowerCase();
    return customers.filter((c: Customer): boolean => {
      if (q !== "" && !c.name.toLowerCase().includes(q) && !c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) return false;
      if (tierFilter !== "All" && c.tier !== tierFilter) return false;
      if (minOrders !== null && c.orders < minOrders) return false;
      if (minSpend !== null && c.spend < minSpend) return false;
      return true;
    });
  }, [customers, query, tierFilter, minOrders, minSpend]);

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

  const messRows = useMemo((): MessAccount[] => {
    const q = messQuery.trim().toLowerCase();
    if (q === "") return messAccounts;
    return messAccounts.filter((m: MessAccount): boolean => m.name.toLowerCase().includes(q));
  }, [messAccounts, messQuery]);

  const exportCsv = (): void => {
    const csv = ["date,account,type,amount,memo", ...ledgerRows.map((r: LedgerRow): string => [r.date, r.account, r.type, r.amount.toString(), r.memo].join(","))].join("\n");
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "mess_invoices.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
    void message.success(`Exported ${ledgerRows.length} ledger rows.`);
  };

  const submitTopUp = (values: { amount: number; memo: string }): void => {
    if (!topUpAccount) return;
    setMessAccounts((prev: MessAccount[]): MessAccount[] =>
      prev.map((m: MessAccount): MessAccount => (m.key === topUpAccount.key ? { ...m, balance: m.balance + values.amount } : m)),
    );
    setLedgerRows((prev: LedgerRow[]): LedgerRow[] => [
      ...prev,
      {
        date: new Date().toISOString().split("T")[0] ?? "2023-10-10",
        account: topUpAccount.name,
        type: "Top-up",
        amount: values.amount,
        memo: values.memo ?? "Top-up",
      },
    ]);
    void message.success(`Added ${inr(values.amount)} to ${topUpAccount.name}`);
    setTopUpAccount(null);
    topUpForm.resetFields();
  };

  const messColumns: TableColumnsType<MessAccount> = [
    { title: "Account Name", dataIndex: "name", key: "name" },
    { title: "Balance", dataIndex: "balance", key: "balance", align: "right", render: (b: number): React.ReactNode => <Typography.Text type={b < 0 ? "danger" : undefined}>{inr(b)}</Typography.Text> },
    { title: "Status", dataIndex: "status", key: "status", width: 120, render: (s: MessStatus): React.ReactNode => <Tag color={s === "Active" ? "success" : s === "Suspended" ? "error" : "default"}>{s}</Tag> },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_: unknown, row: MessAccount): React.ReactNode => (
        <Button size="small" onClick={(): void => setTopUpAccount(row)}>
          Top-up
        </Button>
      ),
    },
  ];

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
      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: "1",
            label: "Directory",
            children: (
              <>
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
                        <Space wrap>
                          <Input allowClear placeholder="Search by name/phone…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 180 }} />
                          <Segmented options={["All", "Gold", "Silver", "Bronze", "New"]} value={tierFilter} onChange={(v: string | number): void => setTierFilter(v.toString())} size="small" />
                          <InputNumber placeholder="Min orders" value={minOrders} onChange={(v: number | null): void => setMinOrders(v)} style={{ width: 110 }} size="small" min={0} />
                          <InputNumber placeholder="Min spend ₹" value={minSpend} onChange={(v: number | null): void => setMinSpend(v)} style={{ width: 120 }} size="small" min={0} />
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
                      <FrequencyChart entries={frequencyEntries} height={200} />
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
          {
            key: "2",
            label: "Mess Accounts",
            children: (
              <Row gutter={16}>
                <Col span={24}>
                  <Card
                    title="Mess Accounts"
                    extra={
                      <Space>
                        <Input allowClear placeholder="Search by name…" value={messQuery} onChange={(e): void => setMessQuery(e.target.value)} style={{ width: 220 }} />
                        <Button size="small" type="primary" onClick={exportCsv}>
                          Export Monthly Invoice
                        </Button>
                      </Space>
                    }
                  >
                    <Table<MessAccount> dataSource={messRows} columns={messColumns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No mess accounts match." }} />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "3",
            label: "Feedback",
            children: (
              <Row gutter={16}>
                <Col span={8}>
                  <Card>
                    <Statistic title="Average Rating" value={avgRating(feedbacks)} precision={1} suffix=" / 5" />
                  </Card>
                </Col>
                <Col span={24} style={{ marginTop: 16 }}>
                  <Card title="Customer Reviews">
                    <List
                      dataSource={feedbacks}
                      renderItem={(f: Feedback): React.ReactNode => (
                        <List.Item>
                          <List.Item.Meta avatar={<PlinthAvatar name={f.customerName} size="sm" />} title={<Space><span>{f.customerName}</span><Rate disabled value={f.rating} style={{ fontSize: 14 }} /></Space>} description={f.comment} />
                          <Typography.Text type="secondary">{f.date}</Typography.Text>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Drawer title={viewed?.name ?? "Customer"} open={viewed !== null} onClose={(): void => setViewed(null)} width={380}>
        {viewed !== null && (
          <>
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Phone">{viewed.phone}</Descriptions.Item>
              <Descriptions.Item label="Tier">{viewed.tier}</Descriptions.Item>
              <Descriptions.Item label="Orders">{viewed.orders}</Descriptions.Item>
              <Descriptions.Item label="Total Spend">{inr(viewed.spend)}</Descriptions.Item>
              <Descriptions.Item label="Last Visit">{viewed.lastVisit}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>Activity Timeline</Typography.Title>
            <Timeline items={activityFor(viewed).map((a: { label: string; text: string }): { label: string; children: string } => ({ label: a.label, children: a.text }))} />
          </>
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

      <Modal
        title={`Top-up ${topUpAccount?.name ?? "Account"}`}
        open={topUpAccount !== null}
        onOk={(): void => {
          void topUpForm.submit();
        }}
        onCancel={(): void => setTopUpAccount(null)}
        okText="Top-up"
      >
        <Form form={topUpForm} layout="vertical" onFinish={submitTopUp} preserve={false}>
          <Form.Item name="amount" label="Amount" rules={[{ required: true, message: "Amount is required" }, { type: "number", min: 1, message: "Amount must be > 0" }]}>
            <InputNumber prefix="₹" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="memo" label="Memo" rules={[{ required: true, message: "Memo is required" }]}>
            <Input placeholder="e.g. Monthly allowance" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
