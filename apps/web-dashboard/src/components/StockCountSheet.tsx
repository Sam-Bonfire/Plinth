import { App, Button, InputNumber, Modal, Space, Table, Typography, type TableColumnsType } from "antd";
import React, { useMemo, useState, useEffect } from "react";

export interface StockCountIngredient {
  key: string;
  name: string;
  unit: string;
  current: number;
}

export interface StockCountSheetProps {
  open: boolean;
  onClose: () => void;
  ingredients: StockCountIngredient[];
}

export const StockCountSheet: React.FC<StockCountSheetProps> = ({ open, onClose, ingredients }) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      const initial: Record<string, number> = {};
      ingredients.forEach((i) => {
        initial[i.key] = 0; // Default to 0 or leave empty
      });
      setCounts(initial);
    }
  }, [open, ingredients]);

  const totalVariance = useMemo(() => {
    return ingredients.reduce((sum, ing) => {
      const count = counts[ing.key] ?? 0;
      return sum + (count - ing.current);
    }, 0);
  }, [counts, ingredients]);

  const exportCsv = (): void => {
    const header = "Name,Unit,System Qty,Counted Qty,Variance";
    const rows = ingredients.map((ing) => {
      const count = counts[ing.key] ?? 0;
      const variance = count - ing.current;
      return `${ing.name},${ing.unit},${ing.current},${count},${variance}`;
    });
    const csv = [header, ...rows].join("\n");
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "stock_count_sheet.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
    void message.success("Exported stock count sheet.");
  };

  const columns: TableColumnsType<StockCountIngredient> = [
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Unit", dataIndex: "unit", key: "unit" },
    { title: "System Qty", dataIndex: "current", key: "current" },
    {
      title: "Count",
      key: "count",
      render: (_, row) => (
        <InputNumber
          min={0}
          value={counts[row.key]}
          onChange={(v) => setCounts((prev) => ({ ...prev, [row.key]: v ?? 0 }))}
        />
      ),
    },
    {
      title: "Variance",
      key: "variance",
      render: (_, row) => {
        const count = counts[row.key] ?? 0;
        const variance = count - row.current;
        return (
          <Typography.Text type={variance === 0 ? "success" : variance > 0 ? "success" : "danger"}>
            {variance > 0 ? `+${variance}` : variance}
          </Typography.Text>
        );
      },
    },
  ];

  return (
    <Modal
      title="Stock Count Sheet"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="print" onClick={() => window.print()}>
          Print
        </Button>,
        <Button key="export" onClick={exportCsv}>
          Export CSV
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={800}
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Table<StockCountIngredient>
          dataSource={ingredients}
          columns={columns}
          rowKey="key"
          pagination={false}
          size="small"
        />
        <Typography.Text strong>Total Variance: {totalVariance > 0 ? `+${totalVariance}` : totalVariance}</Typography.Text>
      </Space>
    </Modal>
  );
};
