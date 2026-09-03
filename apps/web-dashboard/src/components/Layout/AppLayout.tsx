import { useUiStore } from "@plinth/ui-kit";
import { Layout, Menu, Button, Tag } from "antd";
import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider.js";

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/", label: "Dashboard" },
  { key: "/menu", label: "Menu" },
  { key: "/inventory", label: "Inventory" },
  { key: "/reports", label: "Reports" },
  { key: "/staff", label: "Staff" },
  { key: "/floor", label: "Floor Plan" },
  { key: "/settings", label: "Settings" },
  { key: "/audit", label: "Audit Log" },
];

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={sidebarCollapsed} onCollapse={(): void => { void toggleSidebar(); }} breakpoint="lg">
        <div style={{ height: 32, margin: 16, color: "#fff", fontWeight: 600 }}>PlinthOS</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }): void => { void navigate(key); }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: "var(--bg)", padding: "0 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--b1)" }}>
          <span>
            <Tag>{isAuthenticated ? "Authenticated" : "Guest"}</Tag>
          </span>
          <span>
            {isAuthenticated ? (
              <Button size="small" onClick={(): void => { void logout(); }}>
                Logout
              </Button>
            ) : (
              <Button size="small" type="primary" onClick={(): void => { void navigate("/login"); }}>
                Login
              </Button>
            )}
          </span>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: "var(--bg)", borderRadius: 8, border: "1px solid var(--b1)" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
