import { Card, Col, Input, Row, Space, Statistic, Table, Typography, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";
import { seedRecipes, type Recipe } from "../data/recipes.js";

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const RecipesPage: React.FC = () => {
  const [recipes] = useState<Recipe[]>(seedRecipes);
  const [query, setQuery] = useState<string>("");

  const rows = useMemo((): Recipe[] => {
    const q = query.trim().toLowerCase();
    if (q === "") {
      return recipes;
    }
    return recipes.filter(
      (r: Recipe): boolean =>
        r.item.toLowerCase().includes(q) || r.uses.toLowerCase().includes(q),
    );
  }, [recipes, query]);

  const avgCost = rows.length === 0 ? 0 : rows.reduce((s: number, r: Recipe): number => s + r.cost, 0) / rows.length;

  const columns: TableColumnsType<Recipe> = [
    { title: "Recipe", dataIndex: "item", key: "item", render: (v: string): React.ReactNode => <Typography.Text strong>{v}</Typography.Text> },
    { title: "Uses", dataIndex: "uses", key: "uses" },
    { title: "Food Cost", dataIndex: "cost", key: "cost", align: "right", render: (v: number): React.ReactNode => inr(v) },
    { title: "Margin", dataIndex: "margin", key: "margin", width: 90 },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <Statistic title="Recipes" value={rows.length} />
          <Statistic title="Avg Food Cost" value={inr(avgCost)} />
        </Space>
      </Card>
      <Card
        title="Recipes"
        extra={
          <Input allowClear placeholder="Search recipes or ingredients…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 240 }} />
        }
      >
        <Table<Recipe> dataSource={rows} columns={columns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No recipes match." }} />
      </Card>
    </div>
  );
};
