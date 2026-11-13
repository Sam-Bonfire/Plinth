import { PlinthAvatar } from "@plinth/ui-kit";
import type { Vendor } from "@plinth/ui-kit";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Space, Switch, Table, Tag, Typography, message } from "antd";
import type { TableColumnsType } from "antd";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider.js";

interface VendorFormValues {
  name: string;
  contact: string;
  rate: number;
  active: boolean;
}

export const VendorsPage: React.FC = () => {
  const { client } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState("");
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm<VendorFormValues>();

  const loadVendors = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await client.listVendors();
      setVendors(data);
    } catch (err) {
      console.error("Failed to load vendors", err);
      void message.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

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
        name: vendor.name,
        contact: vendor.contact,
        rate: Number(vendor.rate),
        active: vendor.active,
      });
    } else {
      setEditingVendor(null);
      form.resetFields();
      form.setFieldsValue({ active: true });
    }
    setIsModalVisible(true);
  };

  const handleCloseModal = (): void => {
    setIsModalVisible(false);
    setEditingVendor(null);
    form.resetFields();
  };

  const handleSave = async (values: VendorFormValues): Promise<void> => {
    try {
      if (editingVendor) {
        await client.updateVendor(editingVendor.id, {
          name: values.name,
          contact: values.contact,
          rate: String(values.rate),
          active: values.active,
        });
        void message.success("Vendor updated successfully");
      } else {
        await client.createVendor({
          name: values.name,
          contact: values.contact,
          rate: String(values.rate),
        });
        void message.success("Vendor added successfully");
      }
      handleCloseModal();
      void loadVendors();
    } catch (err) {
      void message.error(`Failed to save vendor: ${err instanceof Error ? err.message : String(err)}`);
    }
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
      title: "Rate",
      dataIndex: "rate",
      key: "rate",
      align: "right",
      render: (rate: string): React.ReactNode => `₹${rate}`,
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "active",
      render: (active: boolean): React.ReactNode => (
        <Tag color={active ? "success" : "default"}>{active ? "Active" : "Inactive"}</Tag>
      ),
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
              loading={loading}
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
        <Form form={form} layout="vertical" onFinish={(values): void => { void handleSave(values); }} preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Vendor name" />
          </Form.Item>
          <Form.Item name="contact" label="Contact" rules={[{ required: true, message: "Contact is required" }]}>
            <Input placeholder="Email or Phone" />
          </Form.Item>
          <Form.Item
            name="rate"
            label="Rate (₹)"
            rules={[
              { required: true, message: "Rate is required" },
              { type: "number", min: 0, message: "Rate must be >= 0" },
            ]}
          >
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
