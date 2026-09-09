import { Layout, Space, Typography } from "antd";
import React from "react";

const { Header } = Layout;

export interface TopbarNavigationProps {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const TopbarNavigation: React.FC<TopbarNavigationProps> = ({
  title,
  sub,
  actions,
  className = "",
  style,
}) => (
  <Header
    className={`plinth-topbar ${className}`.trim()}
    style={{
      background: "var(--s1)",
      padding: "0 16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid var(--b1)",
      ...style,
    }}
    data-testid="topbar"
  >
    <div>
      <Typography.Title level={4} style={{ margin: 0 }} data-testid="topbar-title">
        {title}
      </Typography.Title>
      {sub === undefined ? null : <Typography.Text type="secondary">{sub}</Typography.Text>}
    </div>
    {actions === undefined ? null : <Space data-testid="topbar-actions">{actions}</Space>}
  </Header>
);
