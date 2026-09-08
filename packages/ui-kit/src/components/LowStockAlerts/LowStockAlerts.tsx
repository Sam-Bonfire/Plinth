import { Card, Typography } from "antd";
import React from "react";
import { AlertBanner } from "../AlertBanner/AlertBanner.js";

export type LowStockSeverity = "Low" | "Critical";

export interface LowStockItem {
  key: string;
  name: string;
  current: number;
  unit: string;
  par: number;
  severity: LowStockSeverity;
}

export interface LowStockAlertsProps {
  items: LowStockItem[];
  className?: string;
}

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({ items, className = "" }) => (
  <Card title="Low Stock Alerts" data-testid="low-stock-alerts" className={`plinth-low-stock ${className}`.trim()}>
    {items.length === 0 ? (
      <Typography.Text type="secondary">All ingredients above PAR.</Typography.Text>
    ) : (
      items.map((item) => (
        <AlertBanner
          key={item.key}
          type={item.severity === "Critical" ? "error" : "warning"}
          message={`${item.name} is ${item.severity.toLowerCase()}`}
          description={`${item.current} ${item.unit} on hand vs PAR ${item.par} ${item.unit}.`}
        />
      ))
    )}
  </Card>
);
