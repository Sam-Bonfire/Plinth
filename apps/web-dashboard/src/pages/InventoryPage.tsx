import { AlertBanner, BarChart, InventoryStockBar } from "@plinth/ui-kit";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography, message, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";

interface Ingredient {
  key: string;
  name: string;
  category: string;
  unit: string;
  current: number;
  par: number;
  lastCount: string;
}

interface Recipe {
  key: string;
  item: string;
  uses: string;
  cost: number;
  margin: string;
}

type VariancePoint = {
  cat: string;
  kind: string;
  value: number;
};

interface IngredientFormValues {
  name: string;
  category: string;
  unit: string;
  current: number;
  par: number;
}

const CATEGORIES: string[] = ["Proteins", "Dairy", "Produce", "Spices", "Grains", "Beverages"];

const seedIngredients = (): Ingredient[] => [
  { key: "ING-01", name: "Chicken Breast", category: "Proteins", unit: "kg", current: 24, par: 15, lastCount: "Today 08:10" },
  { key: "ING-02", name: "Paneer", category: "Dairy", unit: "kg", current: 18, par: 10, lastCount: "Today 08:10" },
  { key: "ING-03", name: "Tomato", category: "Produce", unit: "kg", current: 3, par: 10, lastCount: "Yesterday 21:40" },
  { key: "ING-04", name: "Garam Masala", category: "Spices", unit: "kg", current: 0, par: 5, lastCount: "Yesterday 21:40" },
  { key: "ING-05", name: "Basmati Rice", category: "Grains", unit: "kg", current: 42, par: 20, lastCount: "Today 08:10" },
  { key: "ING-06", name: "Milk", category: "Dairy", unit: "L", current: 4, par: 12, lastCount: "Today 08:10" },
  { key: "ING-07", name: "Onion", category: "Produce", unit: "kg", current: 30, par: 15, lastCount: "Today 08:10" },
  { key: "ING-08", name: "Butter", category: "Dairy", unit: "kg", current: 9, par: 6, lastCount: "Today 08:10" },
];

const seedRecipes = (): Recipe[] => [
  { key: "REC-01", item: "Butter Chicken", uses: "Chicken, Garam Masala, Butter", cost: 98, margin: "69%" },
  { key: "REC-02", item: "Paneer Tikka", uses: "Paneer, Garam Masala", cost: 72, margin: "74%" },
  { key: "REC-03", item: "Dal Makhani", uses: "Butter, Garam Masala", cost: 48, margin: "78%" },
  { key: "REC-04", item: "Garlic Naan", uses: "Butter", cost: 12, margin: "80%" },
];

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
const stockStatus = (ing: Ingredient): StockStatus => {
  if (ing.current <= 0) return "Critical";
  if (ing.current <= ing.par) return "Low";
  return "OK";
};
const statusColor = (s: StockStatus): string => (s === "OK" ? "success" : s === "Low" ? "warning" : "error");

export const InventoryPage: React.FC = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(seedIngredients);
  const [recipes, setRecipes] = useState<Recipe[]>(seedRecipes);
  const [category, setCategory] = useState<string>("all");
  const [adjusting, setAdjusting] = useState<Ingredient | null>(null);
  const [adjustValue, setAdjustValue] = useState<number>(0);
  const [adding, setAdding] = useState<boolean>(false);
  const [counting, setCounting] = useState<boolean>(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recipeCosts, setRecipeCosts] = useState<Record<string, number>>({});
  const [recipesOpen, setRecipesOpen] = useState<boolean>(false);
  const [form] = Form.useForm<IngredientFormValues>();

  const rows = useMemo(
    (): Ingredient[] => ingredients.filter((i: Ingredient): boolean => category === "all" || i.category === category),
    [ingredients, category],
  );
  const lowItems = ingredients.filter((i: Ingredient): boolean => stockStatus(i) !== "OK");
  const variance = seedVariance();
  const theoretical = variance.filter((v: VariancePoint): boolean => v.kind === "Theoretical").reduce((s: number, v: VariancePoint): number => s + v.value, 0);
  const actual = variance.filter((v: VariancePoint): boolean => v.kind === "Actual").reduce((s: number, v: VariancePoint): number => s + v.value, 0);

  const openAdjust = (ing: Ingredient): void => {
    setAdjustValue(ing.current);
    setAdjusting(ing);
  };

  const saveAdjust = (): void => {
    if (!adjusting) return;
    const value = Math.max(0, adjustValue);
    setIngredients((prev: Ingredient[]): Ingredient[] =>
      prev.map((i: Ingredient): Ingredient => (i.key === adjusting.key ? { ...i, current: value, lastCount: "Just now" } : i)),
    );
    void message.success(`Stock for ${adjusting.name} set to ${value} ${adjusting.unit}.`);
    setAdjusting(null);
  };

  const openAdd = (): void => {
    form.setFieldsValue({ name: "", category: CATEGORIES[0], unit: "kg", current: 0, par: 0 });
    setAdding(true);
  };

  const saveAdded = (values: IngredientFormValues): void => {
    const key = `ING-${ingredients.length + 1}-${values.name.length}`;
    setIngredients((prev: Ingredient[]): Ingredient[] => [...prev, { key, lastCount: "Just now", ...values }]);
    void message.success(`Ingredient ${values.name} added.`);
    setAdding(false);
  };

  const openCount = (): void => {
    const initial: Record<string, number> = {};
    ingredients.forEach((i: Ingredient): void => {
      initial[i.key] = i.current;
    });
    setCounts(initial);
    setCounting(true);
  };

  const saveCount = (): void => {
    setIngredients((prev: Ingredient[]): Ingredient[] =>
      prev.map((i: Ingredient): Ingredient => (counts[i.key] === undefined ? i : { ...i, current: Math.max(0, counts[i.key] as number), lastCount: "Just now" })),
    );
    void message.success(`Stock count saved for ${ingredients.length} ingredients.`);
    setCounting(false);
  };

  const openRecipes = (): void => {
    const initial: Record<string, number> = {};
    recipes.forEach((r: Recipe): void => {
      initial[r.key] = r.cost;
    });
    setRecipeCosts(initial);
    setRecipesOpen(true);
  };

  const saveRecipes = (): void => {
    setRecipes((prev: Recipe[]): Recipe[] =>
      prev.map((r: Recipe): Recipe => (recipeCosts[r.key] === undefined ? r : { ...r, cost: recipeCosts[r.key] as number })),
    );
    void message.success("Recipe costs updated.");
    setRecipesOpen(false);
  };

  const stockColumns: TableColumnsType<Ingredient> = [
    { title: "Ingredient", dataIndex: "name", key: "name", render: (n: string): React.ReactNode => <Typography.Text strong>{n}</Typography.Text> },
    { title: "Category", dataIndex: "category", key: "category", width: 100 },
    {
      title: "Current",
      dataIndex: "current",
      key: "current",
      width: 190,
      render: (current: number, row: Ingredient): React.ReactNode => (
        <Space direction="vertical" size={0} style={{ width: "100%" }}>
          <Typography.Text style={{ fontFamily: "var(--mono)" }}>
            {current} {row.unit}
          </Typography.Text>
          <InventoryStockBar current={current} max={row.par * 2} lowThreshold={row.par} unit={row.unit} size="sm" />
        </Space>
      ),
    },
    { title: "PAR", dataIndex: "par", key: "par", width: 80, render: (par: number, row: Ingredient): React.ReactNode => `${par} ${row.unit}` },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_: unknown, row: Ingredient): React.ReactNode => {
        const s = stockStatus(row);
        return <Tag color={statusColor(s)}>{s}</Tag>;
      },
    },
    { title: "Last Count", dataIndex: "lastCount", key: "lastCount", width: 130 },
    {
      title: "Action",
      key: "action",
      width: 90,
      render: (_: unknown, row: Ingredient): React.ReactNode => (
        <Button size="small" onClick={(): void => openAdjust(row)}>
          Adjust
        </Button>
      ),
    },
  ];

  const recipeColumns: TableColumnsType<Recipe> = [
    { title: "Menu Item", dataIndex: "item", key: "item" },
    { title: "Recipe Uses", dataIndex: "uses", key: "uses" },
    { title: "Cost/Serving", dataIndex: "cost", key: "cost", width: 120, align: "right", render: (c: number): React.ReactNode => inr(c) },
    { title: "Margin", dataIndex: "margin", key: "margin", width: 90 },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total SKUs" value={ingredients.length} />
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
                <Segmented value={category} onChange={(v): void => setCategory(v as string)} options={["all", ...CATEGORIES]} />
                <Button size="small" onClick={openCount}>
                  Stock Count
                </Button>
                <Button size="small" type="primary" onClick={openAdd}>
                  + Add
                </Button>
              </Space>
            }
          >
            <Table<Ingredient> dataSource={rows} columns={stockColumns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No ingredients in this category." }} />
          </Card>
          <Card title="Recipe Mapping" extra={<Button size="small" onClick={openRecipes}>Manage</Button>}>
            <Table<Recipe> dataSource={recipes} columns={recipeColumns} rowKey="key" pagination={false} size="small" />
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
              lowItems.map((i: Ingredient): React.ReactNode => (
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

      <Modal title={adjusting ? `Adjust ${adjusting.name}` : "Adjust Stock"} open={adjusting !== null} onOk={saveAdjust} onCancel={(): void => setAdjusting(null)} okText="Save">
        <Space>
          <InputNumber min={0} value={adjustValue} onChange={(v: number | null): void => setAdjustValue(v ?? 0)} />
          <Typography.Text>{adjusting?.unit} on hand</Typography.Text>
        </Space>
      </Modal>

      <Modal title="Add Ingredient" open={adding} onOk={(): void => { void form.submit(); }} onCancel={(): void => setAdding(false)} okText="Add">
        <Form form={form} layout="vertical" onFinish={saveAdded} preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Ingredient name" />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map((c: string) => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
            <Select options={["kg", "L", "pcs", "pack"].map((u: string) => ({ label: u, value: u }))} />
          </Form.Item>
          <Form.Item name="current" label="Current stock" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="par" label="PAR level" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Stock Count" open={counting} onOk={saveCount} onCancel={(): void => setCounting(false)} okText="Save Count" width={560}>
        <Table<Ingredient>
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
              render: (_: unknown, row: Ingredient): React.ReactNode => (
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

      <Modal title="Manage Recipes" open={recipesOpen} onOk={saveRecipes} onCancel={(): void => setRecipesOpen(false)} okText="Save" width={560}>
        <Table<Recipe>
          dataSource={recipes}
          rowKey="key"
          pagination={false}
          size="small"
          columns={[
            { title: "Menu Item", dataIndex: "item", key: "item" },
            {
              title: "Cost/Serving (₹)",
              key: "cost",
              width: 180,
              render: (_: unknown, row: Recipe): React.ReactNode => (
                <InputNumber
                  min={0}
                  value={recipeCosts[row.key] ?? row.cost}
                  onChange={(v: number | null): void => setRecipeCosts((prev) => ({ ...prev, [row.key]: v ?? 0 }))}
                />
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};
