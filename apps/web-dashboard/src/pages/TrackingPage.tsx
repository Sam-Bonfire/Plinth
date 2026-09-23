import { mockActiveDineInOrder, mockAggregatorOrders, mockTakeawayOrder, type OrderStatus } from "@plinth/ui-kit";
import { Button, Card, Empty, Input, Space, Steps, Typography } from "antd";
import React, { useEffect, useState } from "react";

export function statusToStep(status: OrderStatus): number {
  switch (status) {
    case "Preparing":
      return 1;
    case "Ready":
      return 2;
    case "Served":
    case "Settled":
      return 3;
    case "Voided":
      return -1;
    default:
      // Includes "Received" or unhandled statuses treated as Confirmed
      return 0;
  }
}

interface TrackedOrder {
  id: string;
  status: OrderStatus;
}

const seedOrders = (): TrackedOrder[] => [
  { id: mockActiveDineInOrder.id, status: "Preparing" },
  { id: mockTakeawayOrder.id, status: "Settled" },
  ...mockAggregatorOrders.map((o) => ({
    id: o.aggregatorId ?? o.id,
    status: (o.status === "InProgress" ? "Preparing" : "Settled") as OrderStatus,
  })),
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Preparing: "Ready",
  Ready: "Served",
  Served: "Settled",
};

import { useTrackingTick } from "../hooks/useTrackingTick.js";

export const TrackingPage: React.FC = () => {
  const [orders, setOrders] = useState<TrackedOrder[]>(seedOrders);
  const [searchId, setSearchId] = useState<string>("");
  const [searchedId, setSearchedId] = useState<string>("");
  const [searched, setSearched] = useState<boolean>(false);

  // Derived state to avoid useEffect synchronization anti-pattern
  const trackedOrder = orders.find((o) => o.id === searchedId) ?? null;

  useTrackingTick((updater) => {
    setOrders((prevOrders) => updater(prevOrders, NEXT_STATUS));
  });

  const handleSearch = (): void => {
    const q = searchId.trim();
    if (!q) return;
    setSearched(true);
    setSearchedId(q);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        <Card title="Track Your Order">
          <Space style={{ width: "100%" }}>
            <Input
              placeholder="Enter Order ID"
              value={searchId}
              onChange={(e): void => setSearchId(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 300 }}
            />
            <Button type="primary" onClick={handleSearch}>
              Track
            </Button>
          </Space>
        </Card>

        {searched && (
          <Card>
            {trackedOrder ? (
              <div style={{ padding: "16px 0" }}>
                <Typography.Title level={4} style={{ marginBottom: 24, textAlign: "center" }}>
                  Order {trackedOrder.id}
                </Typography.Title>
                <Steps
                  direction="vertical"
                  current={statusToStep(trackedOrder.status)}
                  items={[
                    { title: "Confirmed", description: "Your order has been received." },
                    { title: "Preparing", description: "Kitchen is preparing your order." },
                    { title: "Ready", description: "Your order is ready." },
                    { title: "Served", description: "Enjoy your meal!" },
                  ]}
                  style={{ paddingLeft: 40 }}
                />
              </div>
            ) : (
              <Empty
                description={<Typography.Text type="secondary">Invalid Order ID. Please check and try again.</Typography.Text>}
                styles={{ image: { height: 100 } }}
              />
            )}
          </Card>
        )}
      </Space>
    </div>
  );
};
