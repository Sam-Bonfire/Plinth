import type { SalesReportDto } from "@plinth/ui-kit";
import { Alert, Card, Col, Row, Statistic, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type DashboardSummary, summarizeDashboard } from "../helpers/dashboard.js";
import { useAuth } from "../providers/AuthProvider.js";

export const DashboardPage: React.FC = () => {
  const { client } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(summarizeDashboard(null));
  const [live, setLive] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    client
      .getSalesReport({ period: "today" })
      .then((report: SalesReportDto): void => {
        if (!cancelled) {
          setSummary(summarizeDashboard(report));
          setLive(true);
        }
      })
      .catch((): void => {
        if (!cancelled) {
          setSummary(summarizeDashboard(null));
          setLive(false);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [client]);

  return (
    <div>
      {!live && <Alert message="Showing cached sample entries - live analytics service unreachable." type="warning" showIcon style={{ marginBottom: 16 }} />}
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Row gutter={16}>
        <Col span={6}>
          <Link to="/reports">
            <Card hoverable>
              <Statistic title="Today Sales" value={summary.grossSales} prefix="₹" />
            </Card>
          </Link>
        </Col>
        <Col span={6}>
          <Link to="/orders">
            <Card hoverable>
              <Statistic title="Orders" value={summary.orders} />
            </Card>
          </Link>
        </Col>
        <Col span={6}>
          <Link to="/floor">
            <Card hoverable>
              <Statistic title="Active Tables" value={summary.activeTables} />
            </Card>
          </Link>
        </Col>
        <Col span={6}>
          <Link to="/inventory">
            <Card hoverable>
              <Statistic title="Low Stock" value={summary.lowStock} />
            </Card>
          </Link>
        </Col>
      </Row>
    </div>
  );
};
