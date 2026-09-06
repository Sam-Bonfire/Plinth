import { mockCategories, mockMenuItems, type MenuCategory, type MenuItem } from "@plinth/ui-kit";
import { Button, Card, Col, Form, Input, InputNumber, List, Modal, Popconfirm, Row, Select, Space, Switch, Tag, Typography, message } from "antd";
import React, { useMemo, useState } from "react";

interface ItemFormValues {
  name: string;
  price: number;
  categoryId: string;
  isVeg: boolean;
  isAvailable: boolean;
}

let itemSeq = 100;

export const MenuPage: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>(mockMenuItems);
  const [cats, setCats] = useState<MenuCategory[]>(mockCategories);
  const [selCat, setSelCat] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [catOpen, setCatOpen] = useState<boolean>(false);
  const [catName, setCatName] = useState<string>("");
  const [form] = Form.useForm<ItemFormValues>();

  const visible = useMemo((): MenuItem[] => {
    const q = query.trim().toLowerCase();
    return items.filter((i: MenuItem): boolean => {
      if (selCat !== "all" && i.categoryId !== selCat) return false;
      if (q !== "" && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, selCat, query]);

  const catNameOf = (id: string): string => cats.find((c: MenuCategory): boolean => c.id === id)?.name ?? id;
  const selCatName = selCat === "all" ? "All Items" : catNameOf(selCat);

  const toggleAvail = (id: string, avail: boolean): void => {
    setItems((prev: MenuItem[]): MenuItem[] => prev.map((i: MenuItem): MenuItem => (i.id === id ? { ...i, isAvailable: avail } : i)));
  };

  const openAdd = (): void => {
    form.setFieldsValue({ name: "", price: 0, categoryId: cats[0]?.id ?? "", isVeg: true, isAvailable: true });
    setEditingId("new");
  };

  const openEdit = (item: MenuItem): void => {
    form.setFieldsValue({ name: item.name, price: item.price, categoryId: item.categoryId, isVeg: item.isVeg, isAvailable: item.isAvailable });
    setEditingId(item.id);
  };

  const saveItem = (values: ItemFormValues): void => {
    if (editingId === "new") {
      itemSeq += 1;
      setItems((prev: MenuItem[]): MenuItem[] => [
        ...prev,
        { id: `MI-${itemSeq}`, gstRate: 5, modifierGroups: [], ...values },
      ]);
      void message.success(`Menu item ${values.name} added.`);
    } else {
      setItems((prev: MenuItem[]): MenuItem[] => prev.map((i: MenuItem): MenuItem => (i.id === editingId ? { ...i, ...values } : i)));
      void message.success(`Menu item ${values.name} updated.`);
    }
    setEditingId(null);
  };

  const deleteItem = (item: MenuItem): void => {
    setItems((prev: MenuItem[]): MenuItem[] => prev.filter((i: MenuItem): boolean => i.id !== item.id));
    void message.success(`Menu item ${item.name} deleted.`);
  };

  const addCategory = (): void => {
    const name = catName.trim();
    if (name === "") return;
    const id = `CAT-${cats.length + 1}-${name.length}`;
    setCats((prev: MenuCategory[]): MenuCategory[] => [...prev, { id, name }]);
    setCatName("");
    setCatOpen(false);
    void message.success(`Category ${name} added.`);
  };

  const sync = (): void => {
    void message.success(`Menu synced to aggregators · ${items.length} items.`);
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card title="Categories">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button block type={selCat === "all" ? "primary" : "text"} onClick={(): void => setSelCat("all")}>
                All Items · {items.length}
              </Button>
              {cats.map((c: MenuCategory): React.ReactNode => {
                const count = items.filter((i: MenuItem): boolean => i.categoryId === c.id).length;
                return (
                  <Button key={c.id} block type={selCat === c.id ? "primary" : "text"} onClick={(): void => setSelCat(c.id)}>
                    {c.name} · {count}
                  </Button>
                );
              })}
              <Button block onClick={(): void => setCatOpen(true)}>
                + Add Category
              </Button>
            </Space>
          </Card>
        </Col>
        <Col span={18}>
          <Card
            title={selCatName}
            extra={
              <Space>
                <Input allowClear placeholder="Search items…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 200 }} />
                <Typography.Text type="secondary">{visible.length} items</Typography.Text>
                <Button size="small" onClick={sync}>
                  Sync
                </Button>
                <Button size="small" type="primary" onClick={openAdd}>
                  + Add Item
                </Button>
              </Space>
            }
          >
            <List
              dataSource={visible}
              locale={{ emptyText: "No items in this category." }}
              renderItem={(item: MenuItem): React.ReactNode => (
                <List.Item
                  actions={[
                    <Switch
                      key="avail"
                      checked={item.isAvailable}
                      checkedChildren="Live"
                      unCheckedChildren="86'd"
                      onChange={(v: boolean): void => toggleAvail(item.id, v)}
                    />,
                    <Button key="edit" size="small" onClick={(): void => openEdit(item)}>
                      Edit
                    </Button>,
                    <Popconfirm key="del" title={`Delete ${item.name}?`} okText="Yes" cancelText="No" onConfirm={(): void => deleteItem(item)}>
                      <Button size="small" danger>
                        Delete
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Typography.Text strong delete={!item.isAvailable}>
                          {item.name}
                        </Typography.Text>
                        <Tag color={item.isVeg ? "green" : "red"}>{item.isVeg ? "VEG" : "NON-VEG"}</Tag>
                        {!item.isAvailable && <Tag color="red">86&apos;d</Tag>}
                      </Space>
                    }
                    description={`${catNameOf(item.categoryId)} · ₹${item.price} · ${item.gstRate}% GST`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Modal title={editingId === "new" ? "Add Menu Item" : "Edit Menu Item"} open={editingId !== null} onOk={(): void => { void form.submit(); }} onCancel={(): void => setEditingId(null)} okText="Save">
        <Form form={form} layout="vertical" onFinish={saveItem} preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Item name" />
          </Form.Item>
          <Form.Item name="price" label="Price (₹)" rules={[{ required: true, message: "Price is required" }]}>
            <InputNumber min={0} style={{ width: "100%" }} placeholder="Price" />
          </Form.Item>
          <Form.Item name="categoryId" label="Category" rules={[{ required: true, message: "Category is required" }]}>
            <Select options={cats.map((c: MenuCategory) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="isVeg" label="Vegetarian" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isAvailable" label="Available" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Add Category" open={catOpen} onOk={addCategory} onCancel={(): void => setCatOpen(false)} okText="Add">
        <Input placeholder="Category name" value={catName} onChange={(e): void => setCatName(e.target.value)} />
      </Modal>
    </div>
  );
};
