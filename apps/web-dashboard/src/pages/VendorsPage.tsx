import { PlinthAvatar } from "@plinth/ui-kit";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Rate, Row, Space, Table, Tag, Typography, message } from "antd";
import type { TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";

interface Vendor {
  id: string;
  name: string;
  contact: string;
  itemsSupplied: string[];
  leadTimeDays: number;
  rating: number;
}

const SEED_VENDORS: Vendor[] = [
  {
    id: "v-1",
    name: "Fresh Farms Produce",
    contact: "contact@freshfarms.in",
    itemsSupplied: ["Vegetables", "Fruits", "Herbs"],
    leadTimeDays: 1,
    rating: 4.5,
  },
  {
    id: "v-2",
    name: "Quality Meats Ltd",
    contact: "orders@qualitymeats.in",
    itemsSupplied: ["Chicken", "Beef", "Pork"],
    leadTimeDays: 2,
    rating: 4.0,
  },
  {
    id: "v-3",
    name: "Oceanic Seafoods",
    contact: "sales@oceanic.in",
    itemsSupplied: ["Fish", "Prawns", "Squid"],
    leadTimeDays: 1,
    rating: 3.5,
  },
  {
    id: "v-4",
    name: "Sunrise Dairy",
    contact: "hello@sunrisedairy.in",
    itemsSupplied: ["Milk", "Cheese", "Butter"],
    leadTimeDays: 1,
    rating: 5.0,
  },
];

export const VendorsPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>(SEED_VENDORS);
  const [query, setQuery] = useState("");
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const filteredVendors = useMemo(() => {
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(query.toLowerCase()) ||
        v.contact.toLowerCase().includes(query.toLowerCase()),
    );
  }, [vendors, query]);

  const handleOpenModal = (vendor?: Vendor): void => {
    if (vendor) {
      setEditingVendor(vendor);
      form.setFieldsValue({
        ...vendor,
        itemsSupplied: vendor.itemsSupplied.join(", "),
      });
    } else {
      setEditingVendor(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCloseModal = (): void => {
    setIsModalVisible(false);
    setEditingVendor(null);
    form.resetFields();
  };

  const handleSave = (values: { name: string; contact: string; itemsSupplied: string | string[]; leadTimeDays: number; rating: number }): void => {
    const items = typeof values.itemsSupplied === "string"
      ? values.itemsSupplied.split(",").map((i: string): string => i.trim()).filter(Boolean)
      : Array.isArray(values.itemsSupplied)
      ? values.itemsSupplied
      : [];

    const newVendor: Vendor = {
      id: editingVendor ? editingVendor.id : `v-${Date.now()}`,
      name: values.name,
      contact: values.contact,
      itemsSupplied: items,
      leadTimeDays: values.leadTimeDays,
      rating: values.rating,
    };

    if (editingVendor) {
      setVendors(vendors.map((v) => (v.id === editingVendor.id ? newVendor : v)));
      void message.success("Vendor updated successfully");
    } else {
      setVendors([...vendors, newVendor]);
      void message.success("Vendor added successfully");
    }
    handleCloseModal();
  };

  const columns: TableColumnsType<Vendor> = [
    {
      title: "Vendor",
      dataIndex: "name",
      key: "name",
      render: (name: string): React.ReactNode => (
        <Space>
          <PlinthAvatar name={name} size="sm" />
          <Typography.Text strong>{name}</Typography.Text>
        </Space>
      ),
    },
    { title: "Contact", dataIndex: "contact", key: "contact" },
    {
      title: "Items Supplied",
      dataIndex: "itemsSupplied",
      key: "itemsSupplied",
      render: (items: string[]): React.ReactNode => (
        <Space wrap>
          {items.map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Lead Time (Days)",
      dataIndex: "leadTimeDays",
      key: "leadTimeDays",
      align: "right",
    },
    {
      title: "Rating",
      dataIndex: "rating",
      key: "rating",
      render: (rating: number): React.ReactNode => <Rate disabled allowHalf defaultValue={rating} />,
    },
    {
      title: "Action",
      key: "action",
      render: (_: unknown, row: Vendor): React.ReactNode => (
        <Button size="small" onClick={() => handleOpenModal(row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="Vendor / Supplier Directory"
            extra={
              <Space>
                <Input
                  allowClear
                  placeholder="Search by name/contact…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ width: 250 }}
                />
                <Button type="primary" onClick={() => handleOpenModal()}>
                  + Add Vendor
                </Button>
              </Space>
            }
          >
            <Table<Vendor>
              dataSource={filteredVendors}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: "No vendors match." }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingVendor ? "Edit Vendor" : "Add Vendor"}
        open={isModalVisible}
        onOk={() => {
          void form.submit();
        }}
        onCancel={handleCloseModal}
        okText="Save"
      >
        <Form form={form} layout="vertical" onFinish={handleSave} preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Vendor name" />
          </Form.Item>
          <Form.Item name="contact" label="Contact" rules={[{ required: true, message: "Contact is required" }]}>
            <Input placeholder="Email or Phone" />
          </Form.Item>
          <Form.Item name="itemsSupplied" label="Items Supplied" rules={[{ required: true, message: "Items supplied is required" }]}>
            <Input placeholder="e.g. Tomatoes, Onions, Garlic (comma separated)" />
          </Form.Item>
          <Form.Item
            name="leadTimeDays"
            label="Lead Time (Days)"
            rules={[
              { required: true, message: "Lead time is required" },
              { type: "number", min: 0, message: "Lead time must be >= 0" },
            ]}
          >
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="rating" label="Rating">
            <Rate allowHalf />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
