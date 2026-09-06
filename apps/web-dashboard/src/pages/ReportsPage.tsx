import { BarChart, LineChart } from "@plinth/ui-kit";
import { Button, Card, Col, Row, Segmented, Space, Statistic, Table, Typography, message, type TableColumnsType } from "antd";
import React, { useState } from "react";

type RevenuePoint = {
  day: string;
  revenue: number;
};

type HourPoint = {
  hour: string;
  orders: number;
};

type LocationPoint = {
  outlet: string;
  revenue: number;
};

interface TopItem {
  key: string;
  rank: number;
  item: string;
  qty: number;
  revenue: number;
  share: string;
}

interface PeriodData {
  gross: string;
  grossDelta: string;
  orders: number;
  ordersDelta: string;
  aov: string;
  aovDelta: string;
  voids: string;
  voidsNote: string;
  revenue: RevenuePoint[];
}

const PERIODS: Record<string, PeriodData> = {
  today: {
    gross: "₹42,310", grossDelta: "↑ 9.2%", orders: 128, ordersDelta: "↑ 6%", aov: "₹331", aovDelta: "↑ ₹11", voids: "₹420", voidsNote: "1.0% rate",
    revenue: [
      { day: "09:00", revenue: 3200 }, { day: "11:00", revenue: 6840 }, { day: "13:00", revenue: 12100 },
      { day: "15:00", revenue: 5400 }, { day: "17:00", revenue: 4320 }, { day: "19:00", revenue: 7480 }, { day: "21:00", revenue: 2970 },
    ],
  },
  week: {
    gross: "₹2,84,510", grossDelta: "↑ 18.4%", orders: 847, ordersDelta: "↑ 12%", aov: "₹336", aovDelta: "↑ ₹18", voids: "₹3,240", voidsNote: "1.1% rate",
    revenue: [
      { day: "Mon", revenue: 34200 }, { day: "Tue", revenue: 36800 }, { day: "Wed", revenue: 39100 },
      { day: "Thu", revenue: 40500 }, { day: "Fri", revenue: 47200 }, { day: "Sat", revenue: 52100 }, { day: "Sun", revenue: 34610 },
    ],
  },
  month: {
    gross: "₹11,96,400", grossDelta: "↑ 14.1%", orders: 3562, ordersDelta: "↑ 9%", aov: "₹336", aovDelta: "↑ ₹14", voids: "₹13,900", voidsNote: "1.2% rate",
    revenue: [
      { day: "W1", revenue: 268400 }, { day: "W2", revenue: 291200 }, { day: "W3", revenue: 305800 }, { day: "W4", revenue: 331000 },
    ],
  },
};

const HOURLY: HourPoint[] = [
  { hour: "10:00", orders: 12 }, { hour: "12:00", orders: 48 }, { hour: "14:00", orders: 36 },
  { hour: "16:00", orders: 22 }, { hour: "18:00", orders: 34 }, { hour: "20:00", orders: 52 }, { hour: "22:00", orders: 18 },
];

const LOCATIONS: LocationPoint[] = [
  { outlet: "Koramangala", revenue: 128400 },
  { outlet: "Indiranagar", revenue: 96400 },
  { outlet: "HSR Layout", revenue: 59710 },
];

const TOP_ITEMS: TopItem[] = [
  { key: "1", rank: 1, item: "Butter Chicken", qty: 214, revenue: 68480, share: "24%" },
  { key: "2", rank: 2, item: "Garlic Naan", qty: 486, revenue: 29160, share: "10%" },
  { key: "3", rank: 3, item: "Paneer Tikka", qty: 162, revenue: 45360, share: "16%" },
  { key: "4", rank: 4, item: "Dal Makhani", qty: 148, revenue: 32560, share: "11%" },
  { key: "5", rank: 5, item: "Mango Lassi", qty: 203, revenue: 22330, share: "8%" },
];

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<string>("week");
  const data = PERIODS[period] ?? PERIODS.week;

  const exportReport = (kind: string): void => {
    void message.success(`${kind} report exported for ${period === "week" ? "this week" : period === "today" ? "today" : "this month"}.`);
  };

  const topColumns: TableColumnsType<TopItem> = [
    { title: "#", dataIndex: "rank", key: "rank", width: 50 },
    { title: "Item", dataIndex: "item", key: "item", render: (i: string): React.ReactNode => <Typography.Text strong>{i}</Typography.Text> },
    { title: "Qty", dataIndex: "qty", key: "qty", width: 80, align: "right" },
    { title: "Revenue", dataIndex: "revenue", key: "revenue", width: 110, align: "right", render: (r: number): React.ReactNode => inr(r) },
    { title: "Share", dataIndex: "share", key: "share", width: 80, align: "right" },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <Segmented value={period} onChange={(v): void => setPeriod(v as string)} options={[{ label: "Today", value: "today" }, { label: "This Week", value: "week" }, { label: "This Month", value: "month" }]} />
        <Space>
          <Button size="small" onClick={(): void => exportReport("PDF")}>
            PDF
          </Button>
          <Button size="small" onClick={(): void => exportReport("CSV")}>
            CSV
          </Button>
        </Space>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Gross Revenue" value={data.gross} suffix={<Typography.Text type="success" style={{ fontSize: 12 }}>{data.grossDelta}</Typography.Text>} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Total Orders" value={data.orders} suffix={<Typography.Text type="success" style={{ fontSize: 12 }}>{data.ordersDelta}</Typography.Text>} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Avg Order Value" value={data.aov} suffix={<Typography.Text type="success" style={{ fontSize: 12 }}>{data.aovDelta}</Typography.Text>} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Voids / Refunds" value={data.voids} suffix={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{data.voidsNote}</Typography.Text>} />
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <LineChart data={data.revenue} xField="day" yField="revenue" isArea title="Revenue Trend" height={220} />
        </Col>
        <Col span={12}>
          <BarChart data={HOURLY} xField="hour" yField="orders" title="Orders by Hour" height={220} />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Top Selling Items">
            <Table<TopItem> dataSource={TOP_ITEMS} columns={topColumns} rowKey="key" pagination={false} size="small" />
          </Card>
        </Col>
        <Col span={12}>
          <BarChart data={LOCATIONS} xField="outlet" yField="revenue" isCurrency currencySymbol="₹" title="Performance by Location" height={220} />
        </Col>
      </Row>
    </div>
  );
};
