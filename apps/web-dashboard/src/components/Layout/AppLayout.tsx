import { PlinthEmptyState, useUiStore } from "@plinth/ui-kit";
import { Badge, Button, Layout, Menu, Modal, Space, Tag, Typography, type MenuProps } from "antd";
import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider.js";

const { Header, Sider, Content } = Layout;

interface RouteMeta {
  title: string;
  sub: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  "/pos": { title: "POS — Order Entry", sub: "Dine-in and takeaway order entry" },
  "/orders": { title: "Orders", sub: "Live order pipeline" },
  "/kitchen": { title: "Kitchen", sub: "KDS tickets by station" },
  "/payments": { title: "Payments", sub: "Tenders, recon and payouts" },
  "/menu": { title: "Menu Management", sub: "Catalog, categories and 86 status" },
  "/inventory": { title: "Inventory", sub: "Stock, recipes and PAR levels" },
  "/customers": { title: "Customers", sub: "Directory and loyalty" },
  "/staff": { title: "Staff Management", sub: "Roles, permissions and PIN" },
  "/reports": { title: "Reports & Analytics", sub: "Sales, labor and tax" },
  "/settings": { title: "Settings", sub: "Tenant configuration" },
  "/audit": { title: "Audit Log", sub: "Immutable audit viewer" },
  "/floor": { title: "Floor Plan", sub: "Tabular table editor" },
  "/onboarding": { title: "Onboarding Wizard", sub: "7-step setup flow" },
  "/dashboard": { title: "Dashboard", sub: "At-a-glance operations" },
};

const DEFAULT_META: RouteMeta = { title: "PlinthOS", sub: "" };

const OUTLETS: string[] = ["Koramangala", "Indiranagar", "HSR Layout"];

const navItems: MenuProps["items"] = [
  {
    key: "operations",
    label: "Operations",
    type: "group",
    children: [
      { key: "/pos", label: "POS" },
      { key: "/orders", label: "Orders" },
      { key: "/kitchen", label: "Kitchen" },
      { key: "/payments", label: "Payments" },
    ],
  },
  {
    key: "management",
    label: "Management",
    type: "group",
    children: [
      { key: "/menu", label: "Menu" },
      { key: "/inventory", label: "Inventory" },
      { key: "/customers", label: "Customers" },
      { key: "/staff", label: "Staff" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    type: "group",
    children: [
      { key: "/reports", label: "Reports" },
      { key: "/settings", label: "Settings" },
      { key: "/audit", label: "Audit Log" },
    ],
  },
];

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed } = useUiStore();
  const [outletIndex, setOutletIndex] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [eodOpen, setEodOpen] = useState<boolean>(false);

  const meta: RouteMeta = ROUTE_META[location.pathname] ?? DEFAULT_META;

  const cycleOutlet = (): void => {
    setOutletIndex((prev: number): number => (prev + 1) % OUTLETS.length);
  };

  const toggleOnline = (): void => {
    setIsOnline((prev: boolean): boolean => !prev);
  };

  const openEod = (): void => {
    setEodOpen(true);
  };

  const closeEod = (): void => {
    setEodOpen(false);
  };

  const goToPos = (): void => {
    void navigate("/pos");
  };

  const goToLogin = (): void => {
    void navigate("/login");
  };

  const handleLogout = (): void => {
    logout();
  };

  const handleCollapse = (collapsed: boolean): void => {
    setSidebarCollapsed(collapsed);
  };

  const handleNavigate = ({ key }: { key: string }): void => {
    void navigate(key);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={210}
        theme="light"
        collapsible
        collapsed={sidebarCollapsed}
        onCollapse={handleCollapse}
        breakpoint="lg"
        style={{ borderRight: "1px solid var(--b1)" }}
      >
        <div style={{ height: 32, margin: 16, fontWeight: 600 }}>PlinthOS</div>
        <Menu theme="light" mode="inline" selectedKeys={[location.pathname]} items={navItems} onClick={handleNavigate} />
        <div style={{ padding: 12, borderTop: "1px solid var(--b1)", marginTop: "auto" }}>
          <Button block onClick={cycleOutlet} icon={<Badge status={isOnline ? "success" : "warning"} />}>
            {OUTLETS[outletIndex]}
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Tap to switch outlet
          </Typography.Text>
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            background: "var(--s1)",
            padding: "0 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--b1)",
          }}
        >
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {meta.title}
            </Typography.Title>
            <Typography.Text type="secondary">{meta.sub}</Typography.Text>
          </div>
          <Space>
            {isOnline ? <Tag color="success">All systems live</Tag> : <Tag color="warning">Offline mode</Tag>}
            <Button size="small" onClick={toggleOnline}>
              {isOnline ? "Simulate Offline" : "Go Online"}
            </Button>
            <Button size="small" onClick={openEod}>
              End of Day
            </Button>
            <Button size="small" type="primary" onClick={goToPos}>
              + New Order
            </Button>
            {isAuthenticated ? (
              <Button size="small" onClick={handleLogout}>
                Logout
              </Button>
            ) : (
              <Button size="small" type="default" onClick={goToLogin}>
                Login
              </Button>
            )}
          </Space>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: "var(--s1)", borderRadius: 8, border: "1px solid var(--b1)" }}>
          <Outlet />
        </Content>
      </Layout>
      <Modal title="End of Day" open={eodOpen} onCancel={closeEod} footer={[<Button key="close" onClick={closeEod}>Close</Button>]}>
        <PlinthEmptyState
          title="Shift reconciliation"
          description="Till counts, cash variance and the Z-report land here with the Settings update."
        />
      </Modal>
    </Layout>
  );
};
