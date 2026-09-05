import {
  OrderChannelBadge,
  OrderStatusBadge,
  mockActiveDineInOrder,
  mockAggregatorOrders,
  mockTakeawayOrder,
  type OrderChannel,
  type OrderItem,
  type OrderStatus,
} from "@plinth/ui-kit";
import { Button, Card, Descriptions, Input, Modal, Popconfirm, Segmented, Space, Table, Typography, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";

interface OrderRow {
  key: string;
  id: string;
  channel: OrderChannel;
  channelRef: string;
  items: OrderItem[];
  status: OrderStatus;
  placedAt: string;
  total: number;
  payment: string;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Preparing: "Ready",
  Ready: "Served",
  Served: "Settled",
};

const STATUS_OPTIONS: string[] = ["all", "Preparing", "Ready", "Served", "Settled", "Voided"];
const CHANNEL_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Dine-in", value: "DineIn" },
  { label: "Takeaway", value: "Takeaway" },
  { label: "Swiggy", value: "Swiggy" },
  { label: "Zomato", value: "Zomato" },
];

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const seedOrders = (): OrderRow[] => [
  {
    key: mockActiveDineInOrder.id,
    id: mockActiveDineInOrder.id,
    channel: "DineIn",
    channelRef: "Table T-04",
    items: mockActiveDineInOrder.items,
    status: "Preparing",
    placedAt: "12:04",
    total: mockActiveDineInOrder.total,
    payment: "Unsettled",
  },
  {
    key: mockTakeawayOrder.id,
    id: mockTakeawayOrder.id,
    channel: "Takeaway",
    channelRef: "Counter",
    items: mockTakeawayOrder.items,
    status: "Settled",
    placedAt: "11:47",
    total: mockTakeawayOrder.total,
    payment: "UPI",
  },
  ...mockAggregatorOrders.map(
    (o, i): OrderRow => ({
      key: o.id,
      id: o.aggregatorId ?? o.id,
      channel: o.aggregator === "Zomato" ? "Zomato" : "Swiggy",
      channelRef: o.id,
      items: o.items,
      status: o.status === "InProgress" ? "Preparing" : "Settled",
      placedAt: i === 0 ? "12:09" : "11:52",
      total: o.total,
      payment: "Aggregator",
    }),
  ),
];

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderRow[]>(seedOrders);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [viewed, setViewed] = useState<OrderRow | null>(null);

  const rows = useMemo((): OrderRow[] => {
    const q = query.trim().toLowerCase();
    return orders.filter((o: OrderRow): boolean => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (channelFilter !== "all" && o.channel !== channelFilter) return false;
      if (q !== "" && !o.id.toLowerCase().includes(q) && !o.channelRef.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, statusFilter, channelFilter, query]);

  const advance = (key: string): void => {
    setOrders((prev: OrderRow[]): OrderRow[] =>
      prev.map((o: OrderRow): OrderRow => {
        const next = NEXT_STATUS[o.status];
        return o.key === key && next !== undefined ? { ...o, status: next } : o;
      }),
    );
  };

  const voidOrder = (key: string): void => {
    setOrders((prev: OrderRow[]): OrderRow[] => prev.map((o: OrderRow): OrderRow => (o.key === key ? { ...o, status: "Voided" } : o)));
  };

  const columns: TableColumnsType<OrderRow> = [
    {
      title: "Order",
      dataIndex: "id",
      key: "id",
      render: (id: string, row: OrderRow): React.ReactNode => (
        <div>
          <Typography.Text strong style={{ fontFamily: "var(--mono)" }}>
            {id}
          </Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.channelRef}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "Channel",
      dataIndex: "channel",
      key: "channel",
      render: (channel: OrderChannel): React.ReactNode => <OrderChannelBadge channel={channel} />,
    },
    {
      title: "Items",
      dataIndex: "items",
      key: "items",
      render: (items: OrderItem[]): React.ReactNode => {
        const qty = items.reduce((sum: number, i: OrderItem): number => sum + i.quantity, 0);
        return `${qty} items · ${items[0]?.name ?? ""}`;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: OrderStatus): React.ReactNode => <OrderStatusBadge status={status} />,
    },
    { title: "Time", dataIndex: "placedAt", key: "placedAt", width: 80 },
    {
      title: "Amount",
      dataIndex: "total",
      key: "total",
      align: "right",
      render: (total: number): React.ReactNode => <Typography.Text strong>{inr(total)}</Typography.Text>,
    },
    { title: "Payment", dataIndex: "payment", key: "payment", width: 110 },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, row: OrderRow): React.ReactNode => (
        <Space>
          {NEXT_STATUS[row.status] !== undefined && (
            <Button size="small" onClick={(): void => advance(row.key)}>
              Advance
            </Button>
          )}
          <Button size="small" onClick={(): void => setViewed(row)}>
            View
          </Button>
          {row.status !== "Voided" && row.status !== "Settled" && (
            <Popconfirm title="Void this order?" okText="Yes" cancelText="No" onConfirm={(): void => voidOrder(row.key)}>
              <Button size="small" danger>
                Void
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Segmented value={statusFilter} onChange={(v): void => setStatusFilter(v as string)} options={STATUS_OPTIONS} />
        <Segmented value={channelFilter} onChange={(v): void => setChannelFilter(v as string)} options={CHANNEL_OPTIONS} />
        <Input allowClear placeholder="Search order…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 200 }} />
      </Space>
      <Card>
        <Table<OrderRow> dataSource={rows} columns={columns} rowKey="key" pagination={false} locale={{ emptyText: "No orders match the current filters." }} />
      </Card>
      <Modal title={viewed ? `Order ${viewed.id}` : "Order"} open={viewed !== null} onCancel={(): void => setViewed(null)} footer={null}>
        {viewed !== null && (
          <div>
            <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Channel">{viewed.channelRef}</Descriptions.Item>
              <Descriptions.Item label="Status">{viewed.status}</Descriptions.Item>
              <Descriptions.Item label="Time">{viewed.placedAt}</Descriptions.Item>
              <Descriptions.Item label="Payment">{viewed.payment}</Descriptions.Item>
              <Descriptions.Item label="Total">{inr(viewed.total)}</Descriptions.Item>
            </Descriptions>
            <Table<OrderItem>
              dataSource={viewed.items}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: "Item", dataIndex: "name", key: "name" },
                { title: "Qty", dataIndex: "quantity", key: "quantity", width: 70 },
                { title: "Price", dataIndex: "price", key: "price", width: 100, align: "right", render: (p: number): React.ReactNode => inr(p) },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
