import { Button, Card, Col, Form, Input, InputNumber, Menu, Modal, Row, Select, Switch, Table, Typography, message, type MenuProps, type TableColumnsType } from "antd";
import React, { useState } from "react";

type SettingValue = string | number | boolean;

interface SettingDef {
  key: string;
  name: string;
  desc: string;
  kind: "switch" | "text" | "number" | "select";
  options?: string[];
  min?: number;
  max?: number;
}

interface Location {
  key: string;
  name: string;
  city: string;
  tables: number;
  active: boolean;
}

interface LocationFormValues {
  name: string;
  city: string;
  tables: number;
}

const TABS: { key: string; label: string }[] = [
  { key: "general", label: "General" },
  { key: "locations", label: "Locations" },
  { key: "integrations", label: "Integrations" },
  { key: "devices", label: "Devices" },
  { key: "tax", label: "Tax & Pricing" },
  { key: "offline", label: "Offline Config" },
  { key: "notifications", label: "Notifications" },
];

const DEFS: Record<string, SettingDef[]> = {
  general: [
    { key: "restaurantName", name: "Restaurant name", desc: "Shown on receipts, KDS and aggregator menus.", kind: "text" },
    { key: "currency", name: "Currency", desc: "Used for all money formatting.", kind: "select", options: ["INR", "USD"] },
    { key: "dayStart", name: "Business day starts at", desc: "Sales after this hour count to the next day.", kind: "select", options: ["00:00", "04:00", "06:00"] },
    { key: "darkMode", name: "Dark mode", desc: "Use the dark theme on back-office screens.", kind: "switch" },
  ],
  integrations: [
    { key: "swiggy", name: "Swiggy ordering", desc: "Accept and fire Swiggy orders.", kind: "switch" },
    { key: "swiggyKey", name: "Swiggy API key", desc: "Issued in the Swiggy partner portal.", kind: "text" },
    { key: "zomato", name: "Zomato ordering", desc: "Accept and fire Zomato orders.", kind: "switch" },
    { key: "razorpay", name: "Razorpay payouts", desc: "Settle UPI and card tenders.", kind: "switch" },
  ],
  devices: [
    { key: "kdsRefresh", name: "KDS refresh interval", desc: "Seconds between board refreshes.", kind: "number", min: 5, max: 120 },
    { key: "printer", name: "Receipt printer", desc: "Default printer for KOTs and bills.", kind: "select", options: ["TP-80 (USB)", "TP-80 (LAN)", "None"] },
    { key: "cashDrawer", name: "Cash drawer", desc: "Pop the drawer on cash tender.", kind: "switch" },
    { key: "sounds", name: "KDS sounds", desc: "Audio alert on incoming tickets.", kind: "switch" },
  ],
  tax: [
    { key: "gstDineIn", name: "GST dine-in %", desc: "Applied to dine-in order lines.", kind: "number", min: 0, max: 28 },
    { key: "gstTakeaway", name: "GST takeaway %", desc: "Applied to takeaway and delivery lines.", kind: "number", min: 0, max: 28 },
    { key: "packaging", name: "Packaging charge (₹)", desc: "Flat charge per takeaway order.", kind: "number", min: 0, max: 500 },
    { key: "serviceCharge", name: "Service charge", desc: "Add a dine-in service charge.", kind: "switch" },
  ],
  offline: [
    { key: "offlineMode", name: "Offline-first mode", desc: "Queue orders locally when the network drops.", kind: "switch" },
    { key: "syncInterval", name: "Sync interval (min)", desc: "How often the queue syncs when online.", kind: "number", min: 1, max: 60 },
    { key: "maxQueued", name: "Max queued orders", desc: "Oldest queued orders are flagged past this limit.", kind: "number", min: 10, max: 1000 },
  ],
  notifications: [
    { key: "lowStock", name: "Low-stock alerts", desc: "Notify managers when ingredients hit PAR.", kind: "switch" },
    { key: "payoutShortfall", name: "Payout shortfall alerts", desc: "Flag aggregator settlements below expected.", kind: "switch" },
    { key: "summaryEmail", name: "Daily summary email", desc: "Z-report summary recipient.", kind: "text" },
  ],
};

const DEFAULTS: Record<string, Record<string, SettingValue>> = {
  general: { restaurantName: "Plinth Demo Kitchen", currency: "INR", dayStart: "04:00", darkMode: false },
  integrations: { swiggy: true, swiggyKey: "sw_live_••••", zomato: true, razorpay: true },
  devices: { kdsRefresh: 15, printer: "TP-80 (USB)", cashDrawer: true, sounds: true },
  tax: { gstDineIn: 5, gstTakeaway: 5, packaging: 30, serviceCharge: false },
  offline: { offlineMode: true, syncInterval: 5, maxQueued: 200 },
  notifications: { lowStock: true, payoutShortfall: true, summaryEmail: "owner@example.com" },
};

const seedLocations = (): Location[] => [
  { key: "L-01", name: "Koramangala", city: "Bengaluru", tables: 14, active: true },
  { key: "L-02", name: "Indiranagar", city: "Bengaluru", tables: 10, active: true },
  { key: "L-03", name: "HSR Layout", city: "Bengaluru", tables: 8, active: false },
];

export const SettingsPage: React.FC = () => {
  const [tab, setTab] = useState<string>("general");
  const [values, setValues] = useState<Record<string, Record<string, SettingValue>>>(DEFAULTS);
  const [locations, setLocations] = useState<Location[]>(seedLocations);
  const [editing, setEditing] = useState<Location | "new" | null>(null);
  const [form] = Form.useForm<LocationFormValues>();

  const setValue = (t: string, key: string, value: SettingValue): void => {
    setValues((prev) => ({ ...prev, [t]: { ...prev[t], [key]: value } }));
  };

  const saveTab = (): void => {
    void message.success("Settings saved.");
  };

  const toggleLocation = (key: string, active: boolean): void => {
    setLocations((prev: Location[]): Location[] => prev.map((l: Location): Location => (l.key === key ? { ...l, active } : l)));
  };

  const openAdd = (): void => {
    form.setFieldsValue({ name: "", city: "", tables: 0 });
    setEditing("new");
  };

  const openEdit = (loc: Location): void => {
    form.setFieldsValue({ name: loc.name, city: loc.city, tables: loc.tables });
    setEditing(loc);
  };

  const saveLocation = (v: LocationFormValues): void => {
    if (editing === "new") {
      const key = `L-${locations.length + 1}-${v.name.length}`;
      setLocations((prev: Location[]): Location[] => [...prev, { key, active: true, ...v }]);
      void message.success(`Location ${v.name} added.`);
    } else if (editing !== null) {
      setLocations((prev: Location[]): Location[] => prev.map((l: Location): Location => (l.key === editing.key ? { ...l, ...v } : l)));
      void message.success(`Location ${v.name} updated.`);
    }
    setEditing(null);
  };

  const renderControl = (t: string, def: SettingDef): React.ReactNode => {
    const value = values[t]?.[def.key];
    if (def.kind === "switch") {
      return <Switch checked={value === true} onChange={(v: boolean): void => setValue(t, def.key, v)} />;
    }
    if (def.kind === "number") {
      return <InputNumber min={def.min} max={def.max} value={typeof value === "number" ? value : 0} onChange={(v: number | null): void => setValue(t, def.key, v ?? 0)} style={{ width: 160 }} />;
    }
    if (def.kind === "select") {
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onChange={(v): void => setValue(t, def.key, v as string)}
          options={(def.options ?? []).map((o: string) => ({ label: o, value: o }))}
          style={{ width: 200 }}
        />
      );
    }
    return <Input value={typeof value === "string" ? value : ""} onChange={(e): void => setValue(t, def.key, e.target.value)} style={{ width: 240 }} />;
  };

  const locationColumns: TableColumnsType<Location> = [
    { title: "Location", dataIndex: "name", key: "name", render: (n: string): React.ReactNode => <Typography.Text strong>{n}</Typography.Text> },
    { title: "City", dataIndex: "city", key: "city", width: 140 },
    { title: "Tables", dataIndex: "tables", key: "tables", width: 90, align: "right" },
    {
      title: "Active",
      dataIndex: "active",
      key: "active",
      width: 100,
      render: (active: boolean, row: Location): React.ReactNode => <Switch checked={active} onChange={(v: boolean): void => toggleLocation(row.key, v)} />,
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      render: (_: unknown, row: Location): React.ReactNode => (
        <Button size="small" onClick={(): void => openEdit(row)}>
          Edit
        </Button>
      ),
    },
  ];

  const navItems: MenuProps["items"] = TABS.map((t) => ({ key: t.key, label: t.label }));
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div>
      <Row gutter={16}>
        <Col span={5}>
          <Card>
            <Menu mode="vertical" selectedKeys={[tab]} items={navItems} onClick={({ key }): void => setTab(key)} />
          </Card>
        </Col>
        <Col span={19}>
          {tab === "locations" ? (
            <Card
              title="Locations"
              extra={
                <Button size="small" type="primary" onClick={openAdd}>
                  + Add Location
                </Button>
              }
            >
              <Table<Location> dataSource={locations} columns={locationColumns} rowKey="key" pagination={false} size="small" />
            </Card>
          ) : (
            <Card title={activeTab.label} extra={<Button size="small" type="primary" onClick={saveTab}>Save Changes</Button>}>
              {(DEFS[tab] ?? []).map((def: SettingDef): React.ReactNode => (
                <Row key={def.key} justify="space-between" align="middle" style={{ padding: "12px 0", borderBottom: "1px solid var(--b1)" }}>
                  <Col span={14}>
                    <Typography.Text strong>{def.name}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {def.desc}
                      </Typography.Text>
                    </div>
                  </Col>
                  <Col>{renderControl(tab, def)}</Col>
                </Row>
              ))}
            </Card>
          )}
        </Col>
      </Row>

      <Modal title={editing === "new" ? "Add Location" : "Edit Location"} open={editing !== null} onOk={(): void => { void form.submit(); }} onCancel={(): void => setEditing(null)} okText="Save">
        <Form form={form} layout="vertical" onFinish={saveLocation} preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Location name" />
          </Form.Item>
          <Form.Item name="city" label="City" rules={[{ required: true, message: "City is required" }]}>
            <Input placeholder="City" />
          </Form.Item>
          <Form.Item name="tables" label="Tables" rules={[{ required: true, message: "Tables is required" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
