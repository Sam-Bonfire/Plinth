import { mockCategories, mockMenuItems, type MenuItem } from "@plinth/ui-kit";
import { Button, Card, Col, Input, InputNumber, List, Modal, Radio, Row, Segmented, Space, Table, Tag, Typography, message, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";

const CHANNELS: string[] = ["Dine-in", "Takeaway", "Swiggy", "Zomato"];
const PAY_METHODS: string[] = ["UPI", "Cash", "Card"];

interface CartLine {
  key: string;
  itemId: string;
  name: string;
  detail: string;
  qty: number;
  rate: number;
  gstRate: number;
}

interface CartRow extends CartLine {
  amount: number;
}

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

let lineSeq = 0;
const nextKey = (): string => {
  lineSeq += 1;
  return `line-${lineSeq}`;
};

export const PosPage: React.FC = () => {
  const [categoryId, setCategoryId] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState<string>(CHANNELS[0]);
  const [payMethod, setPayMethod] = useState<string>(PAY_METHODS[0]);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [orderNote, setOrderNote] = useState<string>("");
  const [orderSeq, setOrderSeq] = useState<number>(4427);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [pendingMods, setPendingMods] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState<boolean>(false);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [discOpen, setDiscOpen] = useState<boolean>(false);
  const [discDraft, setDiscDraft] = useState<number>(0);

  const visibleItems = useMemo((): MenuItem[] => {
    const q = query.trim().toLowerCase();
    return mockMenuItems.filter((item: MenuItem): boolean => {
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      if (q !== "" && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categoryId, query]);

  const pushLine = (item: MenuItem, modifiers: string[]): void => {
    setLines((prev: CartLine[]): CartLine[] => [
      ...prev,
      { key: nextKey(), itemId: item.id, name: item.name, detail: modifiers.join(" · "), qty: 1, rate: item.price, gstRate: item.gstRate },
    ]);
  };

  const handleItemClick = (item: MenuItem): void => {
    if (!item.isAvailable) return;
    if (item.modifierGroups.length === 0) {
      pushLine(item, []);
      return;
    }
    setPendingMods({});
    setPendingItem(item);
  };

  const confirmModifiers = (): void => {
    if (!pendingItem) return;
    const mods = pendingItem.modifierGroups.map((g): string => pendingMods[g.name] ?? "");
    pushLine(pendingItem, mods);
    setPendingItem(null);
  };

  const changeQty = (key: string, qty: number | null): void => {
    if (qty === null || qty < 1) return;
    setLines((prev: CartLine[]): CartLine[] => prev.map((l: CartLine): CartLine => (l.key === key ? { ...l, qty } : l)));
  };

  const removeLine = (key: string): void => {
    setLines((prev: CartLine[]): CartLine[] => prev.filter((l: CartLine): boolean => l.key !== key));
  };

  const subtotal = lines.reduce((sum: number, l: CartLine): number => sum + l.qty * l.rate, 0);
  const gstTotal = lines.reduce((sum: number, l: CartLine): number => sum + (l.qty * l.rate * l.gstRate) / 100, 0);
  const discount = (subtotal * discountPct) / 100;
  const total = subtotal + gstTotal - discount;

  const rows: CartRow[] = lines.map((l: CartLine): CartRow => ({ ...l, amount: l.qty * l.rate }));

  const columns: TableColumnsType<CartRow> = [
    {
      title: "Item",
      dataIndex: "name",
      key: "name",
      render: (name: string, row: CartRow): React.ReactNode => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          {row.detail !== "" && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.detail}
              </Typography.Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      width: 90,
      render: (qty: number, row: CartRow): React.ReactNode => (
        <InputNumber min={1} max={20} value={qty} size="small" onChange={(v: number | null): void => changeQty(row.key, v)} />
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 90,
      align: "right",
      render: (amount: number): React.ReactNode => <Typography.Text strong>{inr(amount)}</Typography.Text>,
    },
    {
      title: "",
      key: "action",
      width: 48,
      render: (_: unknown, row: CartRow): React.ReactNode => (
        <Button type="link" danger size="small" onClick={(): void => removeLine(row.key)}>
          Remove
        </Button>
      ),
    },
  ];

  const clearOrder = (): void => {
    setLines([]);
    setDiscountPct(0);
    setOrderNote("");
  };

  const openNote = (): void => {
    setNoteDraft(orderNote);
    setNoteOpen(true);
  };

  const saveNote = (): void => {
    setOrderNote(noteDraft.trim());
    setNoteOpen(false);
  };

  const openDisc = (): void => {
    setDiscDraft(discountPct);
    setDiscOpen(true);
  };

  const saveDisc = (): void => {
    setDiscountPct(Math.min(100, Math.max(0, discDraft)));
    setDiscOpen(false);
  };

  const placeOrder = (): void => {
    if (lines.length === 0) {
      void message.warning("Cart is empty — add items before placing the order.");
      return;
    }
    const itemCount = lines.reduce((sum: number, l: CartLine): number => sum + l.qty, 0);
    void message.success(`Order #${orderSeq} placed · ${itemCount} items · ${inr(total)} via ${payMethod}.`);
    setOrderSeq((seq: number): number => seq + 1);
    clearOrder();
  };

  const modsComplete = pendingItem !== null && pendingItem.modifierGroups.every((g): boolean => pendingMods[g.name] !== undefined);

  return (
    <div>
      <Row gutter={16}>
        <Col span={15}>
          <Card
            title="Menu"
            extra={
              <Input
                allowClear
                placeholder="Search menu items…"
                value={query}
                onChange={(e): void => setQuery(e.target.value)}
                style={{ width: 220 }}
              />
            }
          >
            <Segmented
              value={categoryId}
              onChange={(v): void => setCategoryId(v as string)}
              options={[{ label: "All", value: "all" }, ...mockCategories.map((c) => ({ label: c.name, value: c.id }))]}
              style={{ marginBottom: 12 }}
            />
            <List
              grid={{ gutter: 8, column: 3 }}
              dataSource={visibleItems}
              locale={{ emptyText: "No items match the current filter." }}
              renderItem={(item: MenuItem): React.ReactNode => (
                <List.Item>
                  <Card
                    size="small"
                    hoverable={item.isAvailable}
                    onClick={(): void => handleItemClick(item)}
                    style={item.isAvailable ? undefined : { opacity: 0.55 }}
                  >
                    <Space direction="vertical" size={2} style={{ width: "100%" }}>
                      <Space>
                        <Tag color={item.isVeg ? "green" : "red"}>{item.isVeg ? "VEG" : "NON-VEG"}</Tag>
                        {!item.isAvailable && <Tag color="red">86&apos;d</Tag>}
                      </Space>
                      <Typography.Text strong>{item.name}</Typography.Text>
                      <Typography.Text type="secondary">{inr(item.price)}</Typography.Text>
                    </Space>
                  </Card>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={9}>
          <Card
            title={`Order #${orderSeq}`}
            extra={
              <Space>
                <Button size="small" onClick={openNote}>
                  Note
                </Button>
                <Button size="small" onClick={openDisc}>
                  Disc.
                </Button>
                <Button size="small" danger onClick={clearOrder}>
                  Clear
                </Button>
              </Space>
            }
          >
            <Segmented value={channel} onChange={(v): void => setChannel(v as string)} options={CHANNELS} block style={{ marginBottom: 12 }} />
            {orderNote !== "" && (
              <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                Note: {orderNote}
              </Typography.Paragraph>
            )}
            <Table<CartRow> dataSource={rows} columns={columns} pagination={false} size="small" rowKey="key" locale={{ emptyText: "Cart is empty — tap a menu item." }} />
            <div style={{ marginTop: 12 }}>
              <Row justify="space-between">
                <Typography.Text type="secondary">Subtotal</Typography.Text>
                <Typography.Text>{inr(subtotal)}</Typography.Text>
              </Row>
              <Row justify="space-between">
                <Typography.Text type="secondary">GST</Typography.Text>
                <Typography.Text>{inr(gstTotal)}</Typography.Text>
              </Row>
              {discount > 0 && (
                <Row justify="space-between">
                  <Typography.Text type="secondary">Discount ({discountPct}%)</Typography.Text>
                  <Typography.Text type="success">-{inr(discount)}</Typography.Text>
                </Row>
              )}
              <Row justify="space-between" style={{ marginTop: 4 }}>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  TOTAL
                </Typography.Title>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {inr(total)}
                </Typography.Title>
              </Row>
            </div>
            <Radio.Group value={payMethod} onChange={(e): void => setPayMethod(e.target.value as string)} style={{ marginTop: 12 }} options={PAY_METHODS} optionType="button" buttonStyle="solid" />
            <Button type="primary" block size="large" style={{ marginTop: 12 }} onClick={placeOrder}>
              Place Order
            </Button>
          </Card>
        </Col>
      </Row>

      <Modal title={pendingItem?.name ?? "Modifiers"} open={pendingItem !== null} onOk={confirmModifiers} okButtonProps={{ disabled: !modsComplete }} onCancel={(): void => setPendingItem(null)} okText="Add to Order">
        <Space direction="vertical" style={{ width: "100%" }}>
          {pendingItem?.modifierGroups.map((g) => (
            <div key={g.name}>
              <Typography.Text strong>{g.name}</Typography.Text>
              <div>
                <Radio.Group
                  value={pendingMods[g.name]}
                  onChange={(e): void => setPendingMods((prev) => ({ ...prev, [g.name]: e.target.value as string }))}
                  options={g.options.map((o) => ({ label: o.name, value: o.name }))}
                  optionType="button"
                />
              </div>
            </div>
          ))}
        </Space>
      </Modal>

      <Modal title="Order Note" open={noteOpen} onOk={saveNote} onCancel={(): void => setNoteOpen(false)}>
        <Input.TextArea rows={3} value={noteDraft} onChange={(e): void => setNoteDraft(e.target.value)} placeholder="e.g. Extra spicy, no onion…" />
      </Modal>

      <Modal title="Apply Discount" open={discOpen} onOk={saveDisc} onCancel={(): void => setDiscOpen(false)}>
        <Space>
          <InputNumber min={0} max={100} value={discDraft} onChange={(v: number | null): void => setDiscDraft(v ?? 0)} />
          <Typography.Text>% off subtotal</Typography.Text>
        </Space>
      </Modal>
    </div>
  );
};
