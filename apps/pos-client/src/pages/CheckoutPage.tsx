import { Button, Card, Form, Input, InputNumber, Modal, Segmented, Space, Table, Typography, message, type TableColumnsType } from "antd";
import React, { useState } from "react";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner.js";
import { useTauriIpc, type OrderLineItem } from "../hooks/useTauriIpc.js";
import { playTone } from "../lib/sounds.js";
import { usePosSession } from "../providers/PosProviders.js";
import { selectItemCount, selectSubtotal, usePosCartStore, type CartLine } from "../stores/posCart.js";

interface CheckoutForm {
  tenantId: string;
  locationId: string;
  terminalId: string;
}

export type TenderMethod = "Cash" | "UPI" | "Card";

/** Change due (negative when under-tendered). */
export const tenderChange = (total: number, tendered: number): number => tendered - total;

/** Builds monospace receipt lines for an order. */
export const formatReceipt = (orderId: string, lines: CartLine[], subtotal: number, tendered: number, change: number): string[] => {
  const out: string[] = ["PLINTH POS", `Order: ${orderId}`, "--------------------------------"];
  for (const l of lines) {
    out.push(`${l.qty}x ${l.name}`.padEnd(24, " ") + `Rs.${l.qty * l.unitPrice}`);
  }
  out.push("--------------------------------");
  out.push(`Subtotal: Rs.${subtotal}`);
  out.push(`Tendered: Rs.${tendered}`);
  out.push(`Change: Rs.${change}`);
  return out;
};

export const CheckoutPage: React.FC = () => {
  const lines = usePosCartStore((s) => s.lines);
  const clear = usePosCartStore((s) => s.clear);
  const subtotal = usePosCartStore(selectSubtotal);
  const itemCount = usePosCartStore(selectItemCount);
  const { session } = usePosSession();
  const { submitOrder, printReceipt } = useTauriIpc();
  const [placing, setPlacing] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [sku, setSku] = useState<string>("");
  const [method, setMethod] = useState<TenderMethod>("Cash");
  const [tendered, setTendered] = useState<number | null>(null);
  const [receiptOpen, setReceiptOpen] = useState<boolean>(false);
  const [receiptLines, setReceiptLines] = useState<string[]>([]);

  useBarcodeScanner((code: string) => {
    setSku(code);
  });

  const placeOrder = async (values: CheckoutForm): Promise<void> => {
    if (!session) {
      void message.error("Sign in first");
      return;
    }
    if (lines.length === 0) {
      void message.error("Cart is empty");
      return;
    }
    if (method === "Cash" && (tendered === null || tendered < subtotal)) {
      void message.error(`Cash short by Rs.${subtotal - (tendered ?? 0)}`);
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
      const paid = method === "Cash" ? (tendered ?? subtotal) : subtotal;
      setReceiptLines(formatReceipt(id, lines, subtotal, paid, paid - subtotal));
      setReceiptOpen(true);
      clear();
      playTone("success");
      void message.success(`Order placed · ${itemCount} items`);
    } catch (e) {
      playTone("error");
      void message.error(e instanceof Error ? e.message : "Order failed");
    } finally {
      setPlacing(false);
    }
  };

  const print = async (): Promise<void> => {
    try {
      const bytes = Array.from(new TextEncoder().encode(receiptLines.join("\n")));
      const jobId = await printReceipt(bytes);
      void message.success(`Receipt queued: ${jobId}`);
      setReceiptOpen(false);
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "Print failed");
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
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space size="large">
            <Typography.Text>
              Items: <strong>{itemCount}</strong>
            </Typography.Text>
            <Typography.Text>
              Subtotal: <strong>₹{subtotal}</strong>
            </Typography.Text>
            {orderId !== null && <Typography.Text type="success">Last order: {orderId}</Typography.Text>}
          </Space>
          <Input
            value={sku}
            onChange={(e): void => setSku(e.target.value)}
            placeholder="SKU/search field"
            style={{ maxWidth: 300 }}
          />
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
          <Form.Item label="Pay method">
            <Segmented options={["Cash", "UPI", "Card"]} value={method} onChange={(v: string | number): void => setMethod(v.toString() as TenderMethod)} />
          </Form.Item>
          {method === "Cash" && (
            <Form.Item label="Cash tendered">
              <InputNumber min={0} value={tendered} onChange={(v: number | null): void => setTendered(v)} style={{ width: "100%" }} />
            </Form.Item>
          )}
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={placing} disabled={lines.length === 0}>
              Place Order
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Modal title="Receipt" open={receiptOpen} onCancel={(): void => setReceiptOpen(false)} onOk={print} okText="Print">
        <Typography.Text code style={{ whiteSpace: "pre-wrap" }}>
          {receiptLines.join("\n")}
        </Typography.Text>
      </Modal>
      <Card title="Cart" style={{ marginTop: 16 }}>
        <Table<CartLine> dataSource={lines} columns={columns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "Cart is empty." }} />
      </Card>
    </div>
  );
};
