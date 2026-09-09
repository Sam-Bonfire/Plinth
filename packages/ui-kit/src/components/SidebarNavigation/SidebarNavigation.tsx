import { Layout, Menu, type MenuProps } from "antd";
import React from "react";

const { Sider } = Layout;

export interface SidebarNavigationProps {
  brand?: React.ReactNode;
  items: MenuProps["items"];
  selectedKey?: string;
  onNavigate?: (key: string) => void;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  footer?: React.ReactNode;
  width?: number;
  className?: string;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  brand = "PlinthOS",
  items,
  selectedKey,
  onNavigate,
  collapsed = false,
  onCollapse,
  footer,
  width = 210,
  className = "",
}) => (
  <Sider
    width={width}
    theme="light"
    collapsible
    collapsed={collapsed}
    onCollapse={onCollapse}
    breakpoint="lg"
    className={`plinth-sidebar ${className}`.trim()}
    style={{ borderRight: "1px solid var(--b1)" }}
  >
    <div style={{ height: 32, margin: 16, fontWeight: 600 }} data-testid="sidebar-brand">
      {brand}
    </div>
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={selectedKey === undefined ? undefined : [selectedKey]}
      items={items}
      onClick={({ key }: { key: string }): void => onNavigate?.(key)}
    />
    {footer === undefined ? null : <div style={{ padding: 12, borderTop: "1px solid var(--b1)" }}>{footer}</div>}
  </Sider>
);
