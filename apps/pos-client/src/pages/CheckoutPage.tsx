import { Button, Card, Form, Input, Space, Table, Typography, message, type TableColumnsType } from "antd";
import React, { useState } from "react";
import { useTauriIpc, type OrderLineItem } from "../hooks/useTauriIpc.js";
import { usePosSession } from "../providers/PosProviders.js";
import { selectItemCount, selectSubtotal, usePosCartStore, type CartLine } from "../stores/posCart.js";

interface CheckoutForm {
  tenantId: string;
  locationId: string;
  terminalId: string;
}

export const CheckoutPage: React.FC = () => {
  const lines = usePosCartStore((s) => s.lines);
  const clear = usePosCartStore((s) => s.clear);
  const subtotal = usePosCartStore(selectSubtotal);
  const itemCount = usePosCartStore(selectItemCount);
  const { session } = usePosSession();
  const { submitOrder } = useTauriIpc();
  const [placing, setPlacing] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const placeOrder = async (values: CheckoutForm): Promise<void> => {
    if (!session) {
      void message.error("Sign in first");
      return;
    }
    setPlacing(true);
    try {
      const items: OrderLineItem[] = lines.map((l: CartLine): OrderLineItem => ({
        id: l.key,
        menu_item_id: l.menuItemId,
        name: l.name,
        base_price: { amount: String(l.unitPrice), currency: "INR" },
        modifier_selections: [],
        modifier_total: { amount: "0", currency: "INR" },
        unit_price: { amount: String(l.unitPrice), currency: "INR" },
        quantity: l.qty,
        fired_quantity: 0,
        tax_rate: "FivePercent",
        notes: null,
        seat_number: null,
      }));
      const id = await submitOrder({
        tenant_id: values.tenantId,
        location_id: values.locationId,
        terminal_id: values.terminalId,
        channel: "DineIn",
        created_by: session.staffId,
        table_id: null,
        seat_number: null,
        items,
      });
      setOrderId(id);
      clear();
      void message.success(`Order placed · ${itemCount} items`);
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "Order failed");
    } finally {
      setPlacing(false);
    }
  };

  const columns: TableColumnsType<CartLine> = [
    { title: "Item", dataIndex: "name", key: "name" },
    { title: "Qty", dataIndex: "qty", key: "qty", width: 70 },
    {
      title: "Amount",
      key: "amount",
      align: "right",
      render: (_: unknown, row: CartLine): React.ReactNode => <Typography.Text strong>₹{row.qty * row.unitPrice}</Typography.Text>,
    },
  ];

  return (
    <div>
      <Card title="Checkout" style={{ marginBottom: 16 }}>
        <Space size="large">
          <Typography.Text>
            Items: <strong>{itemCount}</strong>
          </Typography.Text>
          <Typography.Text>
            Subtotal: <strong>₹{subtotal}</strong>
          </Typography.Text>
          {orderId !== null && <Typography.Text type="success">Last order: {orderId}</Typography.Text>}
        </Space>
      </Card>
      <Card title="Outlet & Terminal">
        <Form layout="vertical" onFinish={(v): Promise<void> => placeOrder(v as CheckoutForm)}>
          <Form.Item label="Tenant ID" name="tenantId" rules={[{ required: true, message: "Tenant is required" }]}>
            <Input placeholder="tenant uuid" />
          </Form.Item>
          <Form.Item label="Location ID" name="locationId" rules={[{ required: true, message: "Location is required" }]}>
            <Input placeholder="location uuid" />
          </Form.Item>
          <Form.Item label="Terminal ID" name="terminalId" rules={[{ required: true, message: "Terminal is required" }]}>
            <Input placeholder="terminal uuid" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={placing} disabled={lines.length === 0}>
              Place Order
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Card title="Cart" style={{ marginTop: 16 }}>
        <Table<CartLine> dataSource={lines} columns={columns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "Cart is empty." }} />
      </Card>
    </div>
  );
};
