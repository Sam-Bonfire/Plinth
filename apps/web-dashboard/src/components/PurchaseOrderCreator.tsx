import type { CreatePurchaseOrderRequest } from "@plinth/ui-kit";
import { Button, InputNumber, Modal, Select, Space, Statistic, Table, Typography, message, type TableColumnsType } from "antd";
import React, { useState } from "react";

export interface VendorOption {
  id: string;
  name: string;
}

export interface StockItemOption {
  id: string;
  name: string;
  unit: string;
  /** Default per-unit cost in paise, pre-filled when the item is picked. */
  unitCostMinor: number;
}

export interface PoLine {
  key: string;
  stockItemId: string;
  qty: number;
  unitCostMinor: number;
}

export const poTotal = (lines: Pick<PoLine, "qty" | "unitCostMinor">[]): number =>
  lines.reduce((sum: number, l: Pick<PoLine, "qty" | "unitCostMinor">): number => sum + Math.round(l.qty * l.unitCostMinor), 0);

export const validatePo = (vendorId: string, lines: PoLine[]): string[] => {
  const errors: string[] = [];
  if (vendorId === "") errors.push("Vendor is required.");
  if (lines.length === 0) errors.push("Add at least one line.");
  if (lines.some((l: PoLine): boolean => l.stockItemId === "")) errors.push("Every line needs an item.");
  if (lines.some((l: PoLine): boolean => !(l.qty > 0))) errors.push("Quantities must be > 0.");
  if (lines.some((l: PoLine): boolean => !(l.unitCostMinor > 0))) errors.push("Unit costs must be > 0.");
  return errors;
};

interface Props {
  vendors: VendorOption[];
  stockItems: StockItemOption[];
  open: boolean;
  onClose: () => void;
  onSubmit: (req: CreatePurchaseOrderRequest) => void;
}

export const PurchaseOrderCreator: React.FC<Props> = ({ vendors, stockItems, open, onClose, onSubmit }: Props) => {
  const [vendorId, setVendorId] = useState<string>("");
  const [lines, setLines] = useState<PoLine[]>([]);

  const addLine = (): void => {
    setLines((prev: PoLine[]): PoLine[] => [...prev, { key: `L-${prev.length}-${Date.now() % 1000}`, stockItemId: stockItems[0]?.id ?? "", qty: 1, unitCostMinor: stockItems[0]?.unitCostMinor ?? 0 }]);
  };

  const patchLine = (key: string, patch: Partial<PoLine>): void => {
    setLines((prev: PoLine[]): PoLine[] => prev.map((l: PoLine): PoLine => (l.key === key ? { ...l, ...patch } : l)));
  };

  const pickItem = (key: string, stockItemId: string): void => {
    const item = stockItems.find((i: StockItemOption): boolean => i.id === stockItemId);
    patchLine(key, { stockItemId, unitCostMinor: item?.unitCostMinor ?? 0 });
  };

  const removeLine = (key: string): void => {
    setLines((prev: PoLine[]): PoLine[] => prev.filter((l: PoLine): boolean => l.key !== key));
  };

  const submit = (): void => {
    const errors = validatePo(vendorId, lines);
    if (errors.length > 0) {
      void message.error(errors[0]);
      return;
    }
    const vendor = vendors.find((v: VendorOption): boolean => v.id === vendorId);
    onSubmit({
      vendor_id: vendorId,
      supplier_name: vendor?.name ?? null,
      lines: lines.map((l: PoLine): { stock_item_id: string; quantity: string; unit_cost_minor: number } => ({
        stock_item_id: l.stockItemId,
        quantity: String(l.qty),
        unit_cost_minor: l.unitCostMinor,
      })),
    });
    setVendorId("");
    setLines([]);
  };

  const columns: TableColumnsType<PoLine> = [
    {
      title: "Item",
      dataIndex: "stockItemId",
      key: "item",
      render: (_: unknown, row: PoLine): React.ReactNode => (
        <Select
          value={row.stockItemId || undefined}
          onChange={(v: string): void => pickItem(row.key, v)}
          options={stockItems.map((i: StockItemOption): { label: string; value: string } => ({ label: i.name, value: i.id }))}
          style={{ width: 200 }}
          placeholder="Pick item"
        />
      ),
    },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      width: 100,
      render: (_: unknown, row: PoLine): React.ReactNode => <InputNumber value={row.qty} min={0} onChange={(v: number | null): void => patchLine(row.key, { qty: v ?? 0 })} style={{ width: 90 }} />,
    },
    {
      title: "Unit Cost ₹",
      dataIndex: "unitCostMinor",
      key: "unitCostMinor",
      width: 130,
      render: (_: unknown, row: PoLine): React.ReactNode => (
        <InputNumber
          value={row.unitCostMinor / 100}
          min={0}
          onChange={(v: number | null): void => patchLine(row.key, { unitCostMinor: Math.round((v ?? 0) * 100) })}
          style={{ width: 110 }}
        />
      ),
    },
    {
      title: "",
      key: "action",
      width: 60,
      render: (_: unknown, row: PoLine): React.ReactNode => (
        <Button size="small" danger onClick={(): void => removeLine(row.key)}>
          Remove
        </Button>
      ),
    },
  ];

  return (
    <Modal title="New Purchase Order" open={open} onCancel={onClose} onOk={submit} okText="Submit PO" width={640}>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Select
          placeholder="Vendor"
          value={vendorId || undefined}
          onChange={(v: string): void => setVendorId(v)}
          options={vendors.map((v: VendorOption): { label: string; value: string } => ({ label: v.name, value: v.id }))}
          style={{ width: 300 }}
        />
        <Button size="small" onClick={addLine}>
          + Add Line
        </Button>
        <Table<PoLine> dataSource={lines} columns={columns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No lines yet." }} />
        <Statistic title="PO Total" value={poTotal(lines) / 100} precision={2} prefix={<Typography.Text>₹</Typography.Text>} />
      </Space>
    </Modal>
  );
};
