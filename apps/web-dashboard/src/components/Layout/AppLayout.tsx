import {
  BarChartOutlined,
  BookOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  FireOutlined,
  OrderedListOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { PlinthEmptyState, usePlinthTheme, useUiStore } from "@plinth/ui-kit";
import { Badge, Button, Layout, Menu, Modal, Space, Tag, Typography, type MenuProps } from "antd";
import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider.js";

const { Header, Sider, Content } = Layout;

interface RouteMeta {
  title: string;
  sub: string;
}

// Mirrors TITLES/SUBS in restaurant-ms-light.html (prototype spec).
const ROUTE_META: Record<string, RouteMeta> = {
  "/pos": { title: "POS — Order Entry", sub: "Category · Item · Modifier · Pay" },
  "/orders": { title: "Orders", sub: "Live and historical order tracking" },
  "/kitchen": { title: "Kitchen Display", sub: "Real-time ticket routing to stations" },
  "/payments": { title: "Payments", sub: "Transactions · Reconciliation · Fraud" },
  "/menu": { title: "Menu Manager", sub: "Items · Pricing · Availability · Sync" },
  "/inventory": { title: "Inventory", sub: "Stock · Recipes · Variance" },
  "/customers": { title: "Customers", sub: "Profiles · History · Segments" },
  "/staff": { title: "Staff & Permissions", sub: "Team · Roles · Audit log" },
  "/reports": { title: "Reports & Analytics", sub: "Sales · Inventory · Payments · Staff" },
  "/settings": { title: "Settings", sub: "System configuration" },
};

const DEFAULT_META: RouteMeta = { title: "PlinthOS", sub: "" };

const OUTLETS: string[] = ["Koramangala", "Indiranagar", "HSR Layout"];

// ponytail: static badge counts mirroring the prototype; wire to live stores when those exist.
const navLabel = (name: string, count?: number): React.ReactNode =>
  count === undefined ? name : (
    <Space size={6}>
      {name}
      <Badge count={count} size="small" />
    </Space>
  );

const navItems: MenuProps["items"] = [
  {
    key: "operations",
    label: "Operations",
    type: "group",
    children: [
      { key: "/pos", label: navLabel("POS"), icon: <ShopOutlined /> },
      { key: "/orders", label: navLabel("Orders", 12), icon: <OrderedListOutlined /> },
      { key: "/kitchen", label: navLabel("Kitchen", 5), icon: <FireOutlined /> },
      { key: "/payments", label: navLabel("Payments"), icon: <CreditCardOutlined /> },
    ],
  },
  {
    key: "management",
    label: "Management",
    type: "group",
    children: [
      { key: "/menu", label: navLabel("Menu"), icon: <BookOutlined /> },
      { key: "/inventory", label: navLabel("Inventory", 3), icon: <DatabaseOutlined /> },
      { key: "/customers", label: navLabel("Customers"), icon: <TeamOutlined /> },
      { key: "/staff", label: navLabel("Staff"), icon: <UserOutlined /> },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    type: "group",
    children: [
      { key: "/reports", label: navLabel("Reports"), icon: <BarChartOutlined /> },
      { key: "/settings", label: navLabel("Settings"), icon: <SettingOutlined /> },
    ],
  },
];

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed } = useUiStore();
  const { isDark, toggleTheme } = usePlinthTheme();
  const [outletIndex, setOutletIndex] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [eodOpen, setEodOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("plinth-theme", isDark ? "dark" : "light");
  }, [isDark]);

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
      <a
        href="#plinth-main"
        style={{ position: "absolute", left: -9999, top: 0, zIndex: 1001, background: "var(--s1)", padding: 8 }}
        onFocus={(e): void => {
          e.currentTarget.style.left = "8px";
        }}
        onBlur={(e): void => {
          e.currentTarget.style.left = "-9999px";
        }}
      >
        Skip to content
      </a>
      {isDark && (
        <style>
          {`
            :root {
              --bg: #0d110e;
              --acc: #ffffff;
              --s1: #1f2923;
              --s2: #2a362e;
              --s3: #37473b;
              --s4: #435849;
              --s5: #506857;
              --b1: rgba(255, 255, 255, 0.12);
            }
          `}
        </style>
      )}
      <Sider
        width={210}
        theme={isDark ? "dark" : "light"}
        collapsible
        collapsed={sidebarCollapsed}
        onCollapse={handleCollapse}
        breakpoint="lg"
        style={{ borderRight: "1px solid var(--b1)" }}
      >
        <div style={{ height: 32, margin: 16, fontWeight: 600 }}>
          <Button type="link" onClick={goToPos} aria-label="PlinthOS home" style={{ fontWeight: 600, padding: 0 }}>
            PlinthOS
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 10, display: "block" }}>
            v2.0 · prod
          </Typography.Text>
        </div>
        <nav aria-label="Primary">
          <Menu theme={isDark ? "dark" : "light"} mode="inline" selectedKeys={[location.pathname]} items={navItems} onClick={handleNavigate} />
        </nav>
        <div style={{ padding: 12, borderTop: "1px solid var(--b1)", marginTop: "auto" }}>
          <Button block onClick={cycleOutlet} aria-live="polite">
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: isOnline ? "var(--g)" : "var(--y)",
                marginRight: 7,
              }}
            />
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
            <Typography.Title level={1} style={{ margin: 0, fontSize: 15 }}>
              {meta.title}
            </Typography.Title>
            <Typography.Text type="secondary">{meta.sub}</Typography.Text>
          </div>
          <Space wrap>
            {isOnline ? <Tag color="success">All systems live</Tag> : <Tag color="warning">Offline mode</Tag>}
            <Button size="small" onClick={toggleTheme}>
              {isDark ? "Light Mode" : "Dark Mode"}
            </Button>
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
        <Content id="plinth-main" tabIndex={-1} style={{ margin: 24, padding: 24, background: "var(--s1)", borderRadius: 8, border: "1px solid var(--b1)", scrollPaddingTop: 16 }}>
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
