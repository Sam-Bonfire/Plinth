import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { activateLocale, mockCategories, mockMenuItems, type MenuCategory, type MenuItem } from "@plinth/ui-kit";
import { Button, Card, Col, Form, Input, InputNumber, List, Modal, Popconfirm, Row, Segmented, Select, Space, Switch, Tag, Tooltip, Typography, message } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { type ParsedItem } from "../components/MenuCsvUtils.js";
import { MenuCsvWizard } from "../components/MenuCsvWizard.js";
import { PRESET_COLORS, colorFor, moveCategory, type CategoryColorPrefs } from "../helpers/menu-ordering.js";
import { localizeCategory, type MenuLang } from "../lib/menuL10n.js";
import { useAuth } from "../providers/AuthProvider.js";

interface ItemFormValues {
  name: string;
  price: number;
  categoryId: string;
  isVeg: boolean;
  isAvailable: boolean;
}

let itemSeq = 100;

export type MenuItemWithDeps = MenuItem & { blockedBy?: string[] };




export const DeleteConfirm: React.FC<{ itemName: string; onConfirm: () => void; blockedBy?: string[] }> = ({ itemName, onConfirm, blockedBy }) => {
  if (blockedBy && blockedBy.length > 0) {
    return (
      <Tooltip title={`Cannot delete: active references (${blockedBy.join(", ")})`}>
        <span>
          <Button size="small" danger disabled>
            Delete
          </Button>
        </span>
      </Tooltip>
    );
  }
  return (
    <Popconfirm title={`Delete ${itemName}?`} okText="Yes" cancelText="No" onConfirm={onConfirm}>
      <Button size="small" danger>
        Delete
      </Button>
    </Popconfirm>
  );
};

export const MenuPage: React.FC = () => {
  const [items, setItems] = useState<MenuItemWithDeps[]>(mockMenuItems as MenuItemWithDeps[]);
  const [cats, setCats] = useState<MenuCategory[]>(mockCategories);
  const [selCat, setSelCat] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [lang, setLang] = useState<MenuLang>("en");

  const switchLang = (l: MenuLang): void => {
    setLang(l);
    void activateLocale(l);
  };
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [catOpen, setCatOpen] = useState<boolean>(false);
  const [catName, setCatName] = useState<string>("");
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [form] = Form.useForm<ItemFormValues>();
  const { client } = useAuth();
  const [syncing, setSyncing] = useState<boolean>(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [categoryColors, setCategoryColors] = useState<CategoryColorPrefs>({});

  useEffect(() => {
    const savedOrder = localStorage.getItem("plinth-category-order");
    const savedColors = localStorage.getItem("plinth-category-colors");
    if (savedOrder) setCategoryOrder(JSON.parse(savedOrder) as string[]);
    else setCategoryOrder(mockCategories.map((c: MenuCategory) => c.id));
    if (savedColors) setCategoryColors(JSON.parse(savedColors) as CategoryColorPrefs);
  }, []);

  const visible = useMemo((): MenuItemWithDeps[] => {
    const q = query.trim().toLowerCase();
    return items.filter((i: MenuItemWithDeps): boolean => {
      if (selCat !== "all" && i.categoryId !== selCat) return false;
      if (q !== "" && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, selCat, query]);

  const catNameOf = (id: string): string => {
    const name = cats.find((c: MenuCategory): boolean => c.id === id)?.name ?? id;
    return localizeCategory(name, lang);
  };
  const selCatName = selCat === "all" ? "All Items" : catNameOf(selCat);

  const toggleAvail = (id: string, avail: boolean): void => {
    setItems((prev: MenuItemWithDeps[]): MenuItemWithDeps[] => prev.map((i: MenuItemWithDeps): MenuItemWithDeps => (i.id === id ? { ...i, isAvailable: avail } : i)));
  };

  const openAdd = (): void => {
    form.setFieldsValue({ name: "", price: 0, categoryId: cats[0]?.id ?? "", isVeg: true, isAvailable: true });
    setEditingId("new");
  };

  const openEdit = (item: MenuItemWithDeps): void => {
    form.setFieldsValue({ name: item.name, price: item.price, categoryId: item.categoryId, isVeg: item.isVeg, isAvailable: item.isAvailable });
    setEditingId(item.id);
  };

  const saveItem = (values: ItemFormValues): void => {
    if (editingId === "new") {
      itemSeq += 1;
      setItems((prev: MenuItemWithDeps[]): MenuItemWithDeps[] => [
        ...prev,
        { id: `MI-${itemSeq}`, gstRate: 5, modifierGroups: [], ...values },
      ]);
      void message.success(`Menu item ${values.name} added.`);
    } else {
      setItems((prev: MenuItemWithDeps[]): MenuItemWithDeps[] => prev.map((i: MenuItemWithDeps): MenuItemWithDeps => (i.id === editingId ? { ...i, ...values } : i)));
      void message.success(`Menu item ${values.name} updated.`);
    }
    setEditingId(null);
  };

  const deleteItem = (item: MenuItemWithDeps): void => {
    setItems((prev: MenuItemWithDeps[]): MenuItemWithDeps[] => prev.filter((i: MenuItemWithDeps): boolean => i.id !== item.id));
    void message.success(`Menu item ${item.name} deleted.`);
  };

  const addCategory = (): void => {
    const name = catName.trim();
    if (name === "") return;
    const id = `CAT-${cats.length + 1}-${name.length}`;
    setCats((prev: MenuCategory[]): MenuCategory[] => [...prev, { id, name }]);
    setCategoryOrder((prev: string[]): string[] => {
      const newOrder = [...prev, id];
      localStorage.setItem("plinth-category-order", JSON.stringify(newOrder));
      return newOrder;
    });
    setCatName("");
    setCatOpen(false);
    void message.success(`Category ${name} added.`);
  };

  const handleImport = (parsedItems: ParsedItem[]): void => {
    setItems((prev: MenuItem[]) => {
      const next = [...prev];
      let updated = 0;
      let added = 0;

      for (const pi of parsedItems) {
        const idx = next.findIndex((i) => i.id === pi.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], name: pi.name, price: pi.price, categoryId: pi.categoryId, isAvailable: pi.isAvailable } as MenuItem;
          updated++;
        } else {
          // Add new item with defaults
          next.push({
            id: pi.id,
            name: pi.name,
            price: pi.price,
            categoryId: pi.categoryId,
            isAvailable: pi.isAvailable,
            gstRate: 5,
            isVeg: true,
            modifierGroups: [],
          });
          added++;
        }
      }

      void message.success(`Import complete. Updated: ${updated}, Added: ${added}`);
      return next;
    });
  };

  const sync = (): void => {
    setSyncing(true);
    client
      .queueMenuSync({
        platforms: ["Swiggy", "Zomato"],
        menu_version: `v${items.length}`,
        item_count: items.length,
      })
      .then((res) => {
        void message.success(`Menu sync queued · ${res.runs.length} platforms.`);
      })
      .catch((e: unknown) => {
        void message.error(e instanceof Error ? e.message : "Menu sync failed");
      })
      .finally(() => {
        setSyncing(false);
      });
  };

  const handleMoveCategory = (id: string, dir: "up" | "down"): void => {
    setCategoryOrder((prev: string[]): string[] => {
      const newOrder = moveCategory(prev, id, dir);
      localStorage.setItem("plinth-category-order", JSON.stringify(newOrder));
      return newOrder;
    });
  };

  const handleColorChange = (id: string, color: string): void => {
    setCategoryColors((prev: CategoryColorPrefs): CategoryColorPrefs => {
      const newColors = { ...prev, [id]: color };
      localStorage.setItem("plinth-category-colors", JSON.stringify(newColors));
      return newColors;
    });
  };

  const sortedCats = [...cats].sort((a: MenuCategory, b: MenuCategory) => {
    const idxA = categoryOrder.indexOf(a.id);
    const idxB = categoryOrder.indexOf(b.id);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card title="Categories">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button block type={selCat === "all" ? "primary" : "text"} onClick={(): void => setSelCat("all")}>
                All Items · {items.length}
              </Button>
              {sortedCats.map((c: MenuCategory): React.ReactNode => {
                const count = items.filter((i: MenuItemWithDeps): boolean => i.categoryId === c.id).length;
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Button style={{ flex: 1, textAlign: "left" }} type={selCat === c.id ? "primary" : "text"} onClick={(): void => setSelCat(c.id)}>
                      {localizeCategory(c.name, lang)} · {count}
                    </Button>
                    <Select
                      size="small"
                      style={{ width: 80 }}
                      placeholder="Color"
                      value={categoryColors[c.id]}
                      onChange={(color: string): void => handleColorChange(c.id, color)}
                      options={PRESET_COLORS.map((color) => ({ label: color, value: color }))}
                    />
                    <Button size="small" icon={<ArrowUpOutlined />} onClick={(): void => handleMoveCategory(c.id, "up")} />
                    <Button size="small" icon={<ArrowDownOutlined />} onClick={(): void => handleMoveCategory(c.id, "down")} />
                  </div>
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
                <Segmented options={[{ label: "EN", value: "en" }, { label: "हिं", value: "hi" }]} value={lang} onChange={(v: string | number): void => switchLang(v.toString() === "hi" ? "hi" : "en")} size="small" />
                <Typography.Text type="secondary">{visible.length} items</Typography.Text>
                <Button size="small" onClick={sync} loading={syncing}>
                  Sync
                </Button>
                <Button size="small" onClick={() => setWizardOpen(true)}>
                  Import / Export CSV
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
              renderItem={(item: MenuItemWithDeps): React.ReactNode => (
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
                    <DeleteConfirm key="del" itemName={item.name} onConfirm={(): void => deleteItem(item)} blockedBy={item.blockedBy} />,
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
                    description={
                      <Space>
                        {categoryColors[item.categoryId] ? (
                          <Tag color={colorFor(item.categoryId, categoryColors)}>{catNameOf(item.categoryId)}</Tag>
                        ) : (
                          <span>{catNameOf(item.categoryId)}</span>
                        )}
                        <span>· ₹{item.price} · {item.gstRate}% GST</span>
                      </Space>
                    }
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

      <MenuCsvWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        items={items}
        onImport={handleImport}
      />
    </div>
  );
};
