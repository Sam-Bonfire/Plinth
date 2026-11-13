import type { Recipe } from "@plinth/ui-kit";
import { Card, Col, Input, Row, Space, Statistic, Table, Typography, type TableColumnsType } from "antd";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider.js";

interface RecipeRow {
  key: string;
  item: string;
  uses: string;
  cost: number;
  margin: string;
}

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const RecipesPage: React.FC = () => {
  const { client } = useAuth();
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");

  const loadRecipes = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const [recipeData, stockData, catalog] = await Promise.all([
        client.listRecipes(),
        client.getInventory(),
        client.getMenuCatalog(),
      ]);

      const stockById = new Map(stockData.map((s) => [s.id, s]));
      const menuItems = catalog.categories.flatMap((c) => c.items);
      const menuById = new Map(menuItems.map((m) => [m.id, m]));

      const rows: RecipeRow[] = recipeData.map((r: Recipe): RecipeRow => {
        let cost = 0;
        let hasUnknown = false;
        const uses: string[] = [];
        for (const ing of r.ingredients) {
          const stock = stockById.get(ing.stock_item_id);
          if (stock === undefined) {
            hasUnknown = true;
            continue;
          }
          uses.push(stock.name);
          cost += Number(ing.quantity.value) * Number(stock.cost_per_unit.amount) * (1 + Number(ing.wastage_percent) / 100);
        }
        if (hasUnknown) uses.push("unmapped item");
        const menuItem = menuById.get(r.menu_item_id);
        const price = menuItem !== undefined ? menuItem.price_minor / 100 : 0;
        const margin = menuItem !== undefined && price > 0 && cost > 0 ? `${Math.round(((price - cost) / price) * 100)}%` : "—";
        return {
          key: r.id,
          item: menuItem?.name ?? r.menu_item_id,
          uses: uses.join(", "),
          cost,
          margin,
        };
      });

      setRecipes(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  const filteredRecipes = useMemo((): RecipeRow[] => {
    const q = query.trim().toLowerCase();
    if (q === "") {
      return recipes;
    }
    return recipes.filter((r: RecipeRow): boolean => r.item.toLowerCase().includes(q) || r.uses.toLowerCase().includes(q));
  }, [recipes, query]);

  const avgCost = filteredRecipes.length === 0 ? 0 : filteredRecipes.reduce((s: number, r: RecipeRow): number => s + r.cost, 0) / filteredRecipes.length;

  const columns: TableColumnsType<RecipeRow> = [
    { title: "Recipe", dataIndex: "item", key: "item", render: (v: string): React.ReactNode => <Typography.Text strong>{v}</Typography.Text> },
    { title: "Uses", dataIndex: "uses", key: "uses" },
    {
      title: "Food Cost",
      dataIndex: "cost",
      key: "cost",
      align: "right",
      render: (v: number): React.ReactNode => inr(v),
    },
    { title: "Margin", dataIndex: "margin", key: "margin", width: 90 },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card>
            <Space size="large">
              <Statistic title="Recipes" value={filteredRecipes.length} loading={loading} />
              <Statistic title="Avg Food Cost" value={inr(avgCost)} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title="Recipes"
        extra={
          <Space>
            <Input allowClear placeholder="Search recipes or ingredients…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 240 }} />
          </Space>
        }
      >
        {error !== null ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        <Table<RecipeRow> dataSource={filteredRecipes} columns={columns} rowKey="key" loading={loading} pagination={false} size="small" locale={{ emptyText: "No recipes match." }} />
      </Card>
    </div>
  );
};
