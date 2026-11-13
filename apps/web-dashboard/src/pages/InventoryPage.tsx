import { AlertBanner, BarChart, InventoryStockBar } from "@plinth/ui-kit";
import type { CreatePurchaseOrderRequest, PurchaseOrder, StockItemResponseDto } from "@plinth/ui-kit";
import { App, Button, Card, Col, InputNumber, Modal, Row, Space, Statistic, Table, Tabs, Tag, Typography, type TableColumnsType } from "antd";
import React, { useCallback, useEffect, useState } from "react";
import { PurchaseOrderCreator, type StockItemOption } from "../components/PurchaseOrderCreator.js";
import { StockCountSheet } from "../components/StockCountSheet.js";
import { logAudit } from "../lib/auditTrail.js";
import { useAuth } from "../providers/AuthProvider.js";
import { RecipesPage } from "./RecipesPage.js";
import { VendorsPage } from "./VendorsPage.js";

interface StockRow {
  key: string;
  name: string;
  unit: string;
  current: number;
  par: number;
  unitCostMinor: number;
}

type VariancePoint = {
  cat: string;
  kind: string;
  value: number;
};

const seedVariance = (): VariancePoint[] => [
  { cat: "Proteins", kind: "Theoretical", value: 12200 },
  { cat: "Proteins", kind: "Actual", value: 11800 },
  { cat: "Dairy", kind: "Theoretical", value: 8400 },
  { cat: "Dairy", kind: "Actual", value: 8100 },
  { cat: "Produce", kind: "Theoretical", value: 6200 },
  { cat: "Produce", kind: "Actual", value: 5400 },
  { cat: "Spices", kind: "Theoretical", value: 3100 },
  { cat: "Spices", kind: "Actual", value: 3050 },
  { cat: "Grains", kind: "Theoretical", value: 4800 },
  { cat: "Grains", kind: "Actual", value: 4750 },
  { cat: "Beverages", kind: "Theoretical", value: 5500 },
  { cat: "Beverages", kind: "Actual", value: 5300 },
];

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type StockStatus = "OK" | "Low" | "Critical";
const stockStatus = (ing: StockRow): StockStatus => {
  if (ing.current <= 0) return "Critical";
  if (ing.current <= ing.par) return "Low";
  return "OK";
};
const statusColor = (s: StockStatus): string => (s === "OK" ? "success" : s === "Low" ? "warning" : "error");

const toRow = (s: StockItemResponseDto): StockRow => ({
  key: s.id,
  name: s.name,
  unit: s.unit,
  current: Number(s.current_quantity),
  par: Number(s.par_level),
  unitCostMinor: Math.round(Number(s.cost_per_unit.amount) * 100),
});

const poColor = (s: PurchaseOrder["status"]): string =>
  s === "Received" ? "success" : s === "Cancelled" ? "default" : s === "Submitted" ? "processing" : "warning";

export const InventoryPage: React.FC = () => {
  const { client } = useAuth();
  const [ingredients, setIngredients] = useState<StockRow[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [adjustValue, setAdjustValue] = useState<number>(0);
  const [counting, setCounting] = useState<boolean>(false);
  const [poOpen, setPoOpen] = useState<boolean>(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const { message } = App.useApp();

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const [stockData, vendorData, poData] = await Promise.all([
        client.getInventory(),
        client.listVendors(),
        client.listPurchaseOrders(),
      ]);
      setIngredients(stockData.map(toRow));
      setVendors(vendorData.map((v) => ({ id: v.id, name: v.name })));
      setPurchaseOrders(poData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const lowItems = ingredients.filter((i: StockRow): boolean => stockStatus(i) !== "OK");
  const variance = seedVariance();
  const theoretical = variance.filter((v: VariancePoint): boolean => v.kind === "Theoretical").reduce((s: number, v: VariancePoint): number => s + v.value, 0);
  const actual = variance.filter((v: VariancePoint): boolean => v.kind === "Actual").reduce((s: number, v: VariancePoint): number => s + v.value, 0);

  const openAdjust = (ing: StockRow): void => {
    setAdjustValue(ing.current);
    setAdjusting(ing);
  };

  const saveAdjust = async (): Promise<void> => {
    if (!adjusting) return;
    const value = Math.max(0, adjustValue);
    const delta = value - adjusting.current;
    try {
      await client.adjustStock({
        stock_item_id: adjusting.key,
        delta: String(delta),
        reason: "PhysicalCountCorrection",
        notes: null,
      });
      void message.success(`Stock for ${adjusting.name} set to ${value} ${adjusting.unit}.`);
      setAdjusting(null);
      void loadData();
    } catch (err) {
      void message.error(`Failed to adjust stock: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const openCount = (): void => {
    const initial: Record<string, number> = {};
    ingredients.forEach((i: StockRow): void => {
      initial[i.key] = i.current;
    });
    setCounts(initial);
    setCounting(true);
  };

  const saveCount = (): void => {
    setIngredients((prev: StockRow[]): StockRow[] =>
      prev.map((i: StockRow): StockRow => (counts[i.key] === undefined ? i : { ...i, current: Math.max(0, counts[i.key] as number) })),
    );
    void message.success(`Stock count saved for ${ingredients.length} ingredients.`);
    setCounting(false);
  };

  const submitPo = async (req: CreatePurchaseOrderRequest): Promise<void> => {
    try {
      await client.createPurchaseOrder(req);
      void message.success("Purchase order created.");
      void logAudit(client, "PO_CREATE", "purchase_order", req.vendor_id ?? "unknown");
      setPoOpen(false);
      void loadData();
    } catch (err) {
      void message.error(`Failed to create PO: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const receivePo = async (po: PurchaseOrder): Promise<void> => {
    try {
      await client.receivePurchaseOrder(po.id);
      void message.success(`PO for ${po.supplier_name} received into stock.`);
      void logAudit(client, "PO_RECEIVE", "purchase_order", po.id);
      void loadData();
    } catch (err) {
      void message.error(`Failed to receive PO: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const stockColumns: TableColumnsType<StockRow> = [
    { title: "Ingredient", dataIndex: "name", key: "name", render: (n: string): React.ReactNode => <Typography.Text strong>{n}</Typography.Text> },
    {
      title: "Current",
      dataIndex: "current",
      key: "current",
      width: 190,
      render: (current: number, row: StockRow): React.ReactNode => (
        <Space direction="vertical" size={0} style={{ width: "100%" }}>
          <Typography.Text style={{ fontFamily: "var(--mono)" }}>
            {current} {row.unit}
          </Typography.Text>
          <InventoryStockBar current={current} max={row.par * 2} lowThreshold={row.par} unit={row.unit} size="sm" />
        </Space>
      ),
    },
    { title: "PAR", dataIndex: "par", key: "par", width: 80, render: (par: number, row: StockRow): React.ReactNode => `${par} ${row.unit}` },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_: unknown, row: StockRow): React.ReactNode => {
        const s = stockStatus(row);
        return <Tag color={statusColor(s)}>{s}</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 90,
      render: (_: unknown, row: StockRow): React.ReactNode => (
        <Button size="small" onClick={(): void => openAdjust(row)}>
          Adjust
        </Button>
      ),
    },
  ];

  const poColumns: TableColumnsType<PurchaseOrder> = [
    { title: "Supplier", dataIndex: "supplier_name", key: "supplier", render: (s: string): React.ReactNode => <Typography.Text strong>{s}</Typography.Text> },
    { title: "Total", dataIndex: "total_minor", key: "total", align: "right", render: (v: number): React.ReactNode => inr(v / 100) },
    { title: "Status", dataIndex: "status", key: "status", width: 110, render: (s: PurchaseOrder["status"]): React.ReactNode => <Tag color={poColor(s)}>{s}</Tag> },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_: unknown, po: PurchaseOrder): React.ReactNode =>
        po.status === "Received" || po.status === "Cancelled" ? null : (
          <Button size="small" onClick={(): void => { void receivePo(po); }}>
            Receive
          </Button>
        ),
    },
  ];

  const stockItemOptions: StockItemOption[] = ingredients.map((i: StockRow): StockItemOption => ({
    id: i.key,
    name: i.name,
    unit: i.unit,
    unitCostMinor: i.unitCostMinor,
  }));

  const stockContent: React.ReactNode = (
    <div>
      {error !== null ? <Typography.Text type="danger">{error}</Typography.Text> : null}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total SKUs" value={ingredients.length} loading={loading} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Low Stock" value={lowItems.length} valueStyle={lowItems.length > 0 ? { color: "var(--r)" } : undefined} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Today's Depletion" value={inr(theoretical)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Variance" value={inr(theoretical - actual)} valueStyle={{ color: "var(--y)" }} />
          </Card>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={16}>
          <Card
            title="Stock Levels"
            style={{ marginBottom: 16 }}
            extra={
              <Space>
                <Button size="small" onClick={() => setSheetOpen(true)}>
                  Open Sheet
                </Button>
                <Button size="small" onClick={(): void => setPoOpen(true)}>
                  New PO
                </Button>
                <Button size="small" onClick={openCount}>
                  Stock Count
                </Button>
              </Space>
            }
          >
            <Table<StockRow> dataSource={ingredients} columns={stockColumns} rowKey="key" loading={loading} pagination={false} size="small" locale={{ emptyText: "No ingredients in this category." }} />
          </Card>
          <Card title="Purchase Orders">
            <Table<PurchaseOrder> dataSource={purchaseOrders} columns={poColumns} rowKey="id" loading={loading} pagination={false} size="small" locale={{ emptyText: "No purchase orders yet." }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Variance Report (₹)" style={{ marginBottom: 16 }}>
            <BarChart data={variance} xField="cat" yField="value" seriesField="kind" isGroup isCurrency currencySymbol="₹" height={220} />
          </Card>
          <Card title="Low Stock Alerts">
            {lowItems.length === 0 ? (
              <Typography.Text type="secondary">All ingredients above PAR.</Typography.Text>
            ) : (
              lowItems.map((i: StockRow): React.ReactNode => (
                <AlertBanner
                  key={i.key}
                  type={stockStatus(i) === "Critical" ? "error" : "warning"}
                  message={`${i.name} is ${stockStatus(i).toLowerCase()}`}
                  description={`${i.current} ${i.unit} on hand vs PAR ${i.par} ${i.unit}.`}
                />
              ))
            )}
          </Card>
        </Col>
      </Row>

      <Modal title={adjusting ? `Adjust ${adjusting.name}` : "Adjust Stock"} open={adjusting !== null} onOk={(): void => { void saveAdjust(); }} onCancel={(): void => setAdjusting(null)} okText="Save">
        <Space>
          <InputNumber min={0} value={adjustValue} onChange={(v: number | null): void => setAdjustValue(v ?? 0)} />
          <Typography.Text>{adjusting?.unit} on hand</Typography.Text>
        </Space>
      </Modal>

      <Modal title="Stock Count" open={counting} onOk={saveCount} onCancel={(): void => setCounting(false)} okText="Save Count" width={560}>
        <Table<StockRow>
          dataSource={ingredients}
          rowKey="key"
          pagination={false}
          size="small"
          columns={[
            { title: "Ingredient", dataIndex: "name", key: "name" },
            {
              title: "Counted",
              key: "counted",
              width: 160,
              render: (_: unknown, row: StockRow): React.ReactNode => (
                <InputNumber
                  min={0}
                  value={counts[row.key] ?? row.current}
                  onChange={(v: number | null): void => setCounts((prev) => ({ ...prev, [row.key]: v ?? 0 }))}
                />
              ),
            },
            { title: "Unit", dataIndex: "unit", key: "unit", width: 70 },
          ]}
        />
      </Modal>

      <StockCountSheet
        open={sheetOpen}
        onClose={(): void => setSheetOpen(false)}
        ingredients={ingredients}
      />

      <PurchaseOrderCreator
        vendors={vendors}
        stockItems={stockItemOptions}
        open={poOpen}
        onClose={(): void => setPoOpen(false)}
        onSubmit={(req: CreatePurchaseOrderRequest): void => {
          void submitPo(req);
        }}
      />
    </div>
  );
  return (
    <Tabs
      defaultActiveKey="stock"
      items={[
        { key: "stock", label: "Stock", children: stockContent },
        { key: "recipes", label: "Recipes", children: <RecipesPage /> },
        { key: "vendors", label: "Vendors", children: <VendorsPage /> },
      ]}
    />
  );
};
