import { Card, Row, Col, Statistic, Typography } from "antd";
import React from "react";

export const DashboardPage: React.FC = () => {
  return (
    <div>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Row gutter={16}>
        <Col span={6}>
          <Card><Statistic title="Today Sales" value={0} prefix="₹" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Orders" value={0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Active Tables" value={0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Low Stock" value={0} /></Card>
        </Col>
      </Row>
    </div>
  );
};
