import { Button, Input, InputNumber, Modal, Select, Space, Statistic, Table, Typography, message, type TableColumnsType } from "antd";
import React, { useEffect, useState } from "react";

export interface PoLine {
  key: string;
  item: string;
  qty: number;
  unitCost: number;
}

export interface PurchaseOrder {
  supplier: string;
  lines: PoLine[];
  total: number;
}

const DRAFT_KEY = "plinth-po-draft";

export const poTotal = (lines: Pick<PoLine, "qty" | "unitCost">[]): number =>
  lines.reduce((sum: number, l: Pick<PoLine, "qty" | "unitCost">): number => sum + l.qty * l.unitCost, 0);

export const validatePo = (supplier: string, lines: PoLine[]): string[] => {
  const errors: string[] = [];
  if (supplier.trim() === "") errors.push("Supplier is required.");
  if (lines.length === 0) errors.push("Add at least one line.");
  if (lines.some((l: PoLine): boolean => l.item.trim() === "")) errors.push("Every line needs an item.");
  if (lines.some((l: PoLine): boolean => !(l.qty > 0))) errors.push("Quantities must be > 0.");
  if (lines.some((l: PoLine): boolean => !(l.unitCost > 0))) errors.push("Unit costs must be > 0.");
  return errors;
};

interface Props {
  items: string[];
  open: boolean;
  onClose: () => void;
  onSubmit: (po: PurchaseOrder) => void;
}

export const PurchaseOrderCreator: React.FC<Props> = ({ items, open, onClose, onSubmit }: Props) => {
  const [supplier, setSupplier] = useState<string>("");
  const [lines, setLines] = useState<PoLine[]>([]);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw === null) return;
      const draft = JSON.parse(raw) as { supplier?: string; lines?: PoLine[] };
      if (typeof draft.supplier === "string") setSupplier(draft.supplier);
      if (Array.isArray(draft.lines)) setLines(draft.lines);
    } catch {
      // Corrupt draft: start fresh.
    }
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ supplier, lines }));
    } catch {
      // Storage unavailable (private mode): draft simply won't persist.
    }
  }, [open, supplier, lines]);

  const addLine = (): void => {
    setLines((prev: PoLine[]): PoLine[] => [...prev, { key: `L-${prev.length}-${Date.now() % 1000}`, item: items[0] ?? "", qty: 1, unitCost: 0 }]);
  };

  const patchLine = (key: string, patch: Partial<PoLine>): void => {
    setLines((prev: PoLine[]): PoLine[] => prev.map((l: PoLine): PoLine => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string): void => {
    setLines((prev: PoLine[]): PoLine[] => prev.filter((l: PoLine): boolean => l.key !== key));
  };

  const submit = (): void => {
    const errors = validatePo(supplier, lines);
    if (errors.length > 0) {
      void message.error(errors[0]);
      return;
    }
    onSubmit({ supplier: supplier.trim(), lines, total: poTotal(lines) });
    setSupplier("");
    setLines([]);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to clean up.
    }
  };

  const columns: TableColumnsType<PoLine> = [
    {
      title: "Item",
      dataIndex: "item",
      key: "item",
      render: (_: unknown, row: PoLine): React.ReactNode => (
        <Select value={row.item} onChange={(v: string): void => patchLine(row.key, { item: v })} options={items.map((i: string): { label: string; value: string } => ({ label: i, value: i }))} style={{ width: 160 }} />
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
      dataIndex: "unitCost",
      key: "unitCost",
      width: 120,
      render: (_: unknown, row: PoLine): React.ReactNode => <InputNumber value={row.unitCost} min={0} onChange={(v: number | null): void => patchLine(row.key, { unitCost: v ?? 0 })} style={{ width: 110 }} />,
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
        <Input placeholder="Supplier name" value={supplier} onChange={(e): void => setSupplier(e.target.value)} />
        <Button size="small" onClick={addLine}>
          + Add Line
        </Button>
        <Table<PoLine> dataSource={lines} columns={columns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No lines yet." }} />
        <Statistic title="PO Total" value={poTotal(lines)} prefix={<Typography.Text>₹</Typography.Text>} />
      </Space>
    </Modal>
  );
};
