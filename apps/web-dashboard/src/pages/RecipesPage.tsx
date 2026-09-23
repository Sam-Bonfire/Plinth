import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Space, Statistic, Table, Typography, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";
import { seedRecipes, subRecipeCost, type Recipe } from "../data/recipes.js";

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

interface RecipeFormValues {
  item: string;
  uses: { ingredient: string }[];
  cost: number;
  margin: string;
}

export const RecipesPage: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>(seedRecipes);
  const [query, setQuery] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingIsSub, setEditingIsSub] = useState<boolean>(false);
  const [form] = Form.useForm<RecipeFormValues>();

  const filteredRecipes = useMemo((): Recipe[] => {
    const q = query.trim().toLowerCase();
    if (q === "") {
      return recipes;
    }
    return recipes.filter(
      (r: Recipe): boolean =>
        r.item.toLowerCase().includes(q) || r.uses.toLowerCase().includes(q),
    );
  }, [recipes, query]);

  const mainRecipes = filteredRecipes.filter(r => !r.isSubRecipe);
  const subRecipes = filteredRecipes.filter(r => r.isSubRecipe);

  const avgCost = mainRecipes.length === 0 ? 0 : mainRecipes.reduce((s: number, r: Recipe): number => s + subRecipeCost(r, recipes), 0) / mainRecipes.length;

  const openEdit = (recipe: Recipe | null, isSub: boolean): void => {
    setEditingIsSub(isSub);
    if (recipe) {
      setEditingId(recipe.key);
      form.setFieldsValue({
        item: recipe.item,
        uses: recipe.uses.split(',').filter(s => s.trim().length > 0).map(s => ({ ingredient: s.trim() })),
        cost: recipe.cost,
        margin: recipe.margin,
      });
    } else {
      setEditingId("new");
      form.resetFields();
      form.setFieldsValue({ uses: [{ ingredient: "" }] });
    }
  };

  const saveRecipe = (): void => {
    form.validateFields().then((values: RecipeFormValues) => {
      const usesString = (values.uses || []).map(u => u.ingredient.trim()).filter(Boolean).join(", ");

      if (editingId === "new") {
        const newRecipe: Recipe = {
          key: `REC-NEW-${Date.now()}`,
          item: values.item,
          uses: usesString,
          cost: values.cost || 0,
          margin: values.margin || "0%",
          isSubRecipe: editingIsSub,
        };
        setRecipes([...recipes, newRecipe]);
      } else {
        setRecipes(recipes.map(r =>
          r.key === editingId
            ? { ...r, item: values.item, uses: usesString, cost: values.cost || 0, margin: values.margin || "0%" }
            : r
        ));
      }
      setEditingId(null);
    }).catch(() => {
      // validation failed
    });
  };

  const columns: TableColumnsType<Recipe> = [
    { title: "Recipe", dataIndex: "item", key: "item", render: (v: string): React.ReactNode => <Typography.Text strong>{v}</Typography.Text> },
    { title: "Uses", dataIndex: "uses", key: "uses" },
    {
      title: "Food Cost",
      key: "cost",
      align: "right",
      render: (_: unknown, r: Recipe): React.ReactNode => {
        const cost = subRecipeCost(r, recipes);
        return inr(cost);
      }
    },
    { title: "Margin", dataIndex: "margin", key: "margin", width: 90 },
    {
      key: "action",
      width: 90,
      render: (_: unknown, row: Recipe): React.ReactNode => (
        <Button size="small" onClick={() => openEdit(row, !!row.isSubRecipe)}>
          Edit
        </Button>
      ),
    },
  ];

  const subColumns: TableColumnsType<Recipe> = [
    { title: "Base Recipe", dataIndex: "item", key: "item", render: (v: string): React.ReactNode => <Typography.Text strong>{v}</Typography.Text> },
    { title: "Uses", dataIndex: "uses", key: "uses" },
    {
      title: "Base Cost",
      dataIndex: "cost",
      key: "cost",
      align: "right",
      render: (v: number): React.ReactNode => inr(v)
    },
    {
      key: "action",
      width: 90,
      render: (_: unknown, row: Recipe): React.ReactNode => (
        <Button size="small" onClick={() => openEdit(row, true)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card>
            <Space size="large">
              <Statistic title="Main Recipes" value={mainRecipes.length} />
              <Statistic title="Avg Food Cost" value={inr(avgCost)} />
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic title="Base Recipes" value={subRecipes.length} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Recipes"
        extra={
          <Space>
            <Input allowClear placeholder="Search recipes or ingredients…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 240 }} />
            <Button onClick={() => openEdit(null, true)}>Add Base Recipe</Button>
            <Button type="primary" onClick={() => openEdit(null, false)}>Add Recipe</Button>
          </Space>
        }
      >
        <Typography.Title level={5}>Main Recipes</Typography.Title>
        <Table<Recipe> dataSource={mainRecipes} columns={columns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No main recipes match." }} style={{ marginBottom: 24 }} />

        <Typography.Title level={5}>Base Recipes (Sub-Recipes)</Typography.Title>
        <Table<Recipe> dataSource={subRecipes} columns={subColumns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No base recipes match." }} />
      </Card>

      <Modal
        title={editingId === "new" ? (editingIsSub ? "Add Base Recipe" : "Add Recipe") : (editingIsSub ? "Edit Base Recipe" : "Edit Recipe")}
        open={editingId !== null}
        onOk={saveRecipe}
        onCancel={(): void => setEditingId(null)}
        okText="Save"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="item" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Recipe Name" />
          </Form.Item>

          <Form.Item label="Ingredients (Uses)">
            <Form.List name="uses">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'ingredient']}
                        rules={[{ required: true, message: 'Missing ingredient' }]}
                        style={{ margin: 0, width: '100%' }}
                      >
                        <Input placeholder="Ingredient Name" style={{ width: 300 }} />
                      </Form.Item>
                      <Button danger onClick={() => remove(name)}>Remove</Button>
                    </Space>
                  ))}
                  <Form.Item style={{ marginTop: 8 }}>
                    <Button type="dashed" onClick={() => add()} block>
                      + Add Ingredient
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cost" label="Base Cost (₹)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            {!editingIsSub && (
              <Col span={12}>
                <Form.Item name="margin" label="Margin">
                  <Input placeholder="e.g. 70%" />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
