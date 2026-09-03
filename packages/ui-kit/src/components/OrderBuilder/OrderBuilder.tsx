import { Form, InputNumber, Select, Input, Button, Card, Divider } from "antd";
import React from "react";

export interface OrderBuilderItem {
  menuItemId: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  taxRate: string;
  seatNumber: number | null;
  notes: string | null;
}

export interface OrderBuilderProps {
  items: OrderBuilderItem[];
  onAddItem: (item: OrderBuilderItem) => void;
  onRemoveItem: (index: number) => void;
  onSubmit: () => void;
  currencySymbol?: string;
}

export const OrderBuilder: React.FC<OrderBuilderProps> = ({
  items,
  onAddItem,
  onRemoveItem,
  onSubmit,
  currencySymbol = "₹",
}) => {
  const [form] = Form.useForm<OrderBuilderItem>();

  const handleAdd = (values: OrderBuilderItem): void => {
    onAddItem(values);
    form.resetFields();
  };

  const runningTotalMinor = items.reduce((sum, it) => sum + it.unitPriceMinor * it.quantity, 0);
  const runningTotal = (runningTotalMinor / 100).toFixed(2);

  return (
    <div>
      <Card title="Add Item" size="small">
        <Form<OrderBuilderItem> form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="menuItemId" label="Menu Item ID" rules={[{ required: true }]}>
            <Input placeholder="item-101" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Butter Chicken" />
          </Form.Item>
          <Form.Item name="unitPriceMinor" label="Unit Price (minor)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={1} defaultValue={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="taxRate" label="Tax Rate" initialValue="FivePercent">
            <Select
              options={[
                { value: "Exempt", label: "Exempt" },
                { value: "FivePercent", label: "5%" },
                { value: "TwelvePercent", label: "12%" },
                { value: "EighteenPercent", label: "18%" },
                { value: "TwentyEightPercent", label: "28%" },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Add to Order
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Divider />
      <Card title={`Order Preview — Total: ${currencySymbol}${runningTotal}`} size="small">
        {items.length === 0 ? (
          <p>No items</p>
        ) : (
          items.map((it, idx) => (
            <div key={`${it.menuItemId}-${idx}`} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span>
                {it.name} × {it.quantity} @ {currencySymbol}
                {(it.unitPriceMinor / 100).toFixed(2)}
              </span>
              <Button size="small" danger onClick={(): void => onRemoveItem(idx)}>
                Remove
              </Button>
            </div>
          ))
        )}
        <Divider />
        <Button type="primary" onClick={onSubmit} disabled={items.length === 0}>
          Submit Order
        </Button>
      </Card>
    </div>
  );
};
