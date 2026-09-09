import { Card, List } from "antd";
import React from "react";
import { PlinthAvatar } from "../Avatar/PlinthAvatar.js";
import { CurrencyText } from "../Typography/index.js";

export interface TopCustomer {
  name: string;
  orders: number;
  spend: number;
}

export interface TopCustomersCardProps {
  customers: TopCustomer[];
  className?: string;
}

export const TopCustomersCard: React.FC<TopCustomersCardProps> = ({ customers, className = "" }) => (
  <Card
    title="Top Customers"
    data-testid="top-customers-card"
    className={`plinth-top-customers ${className}`.trim()}
  >
    <List
      dataSource={customers}
      locale={{ emptyText: "No customers yet." }}
      renderItem={(c: TopCustomer): React.ReactNode => (
        <List.Item>
          <List.Item.Meta
            avatar={<PlinthAvatar name={c.name} size="sm" />}
            title={c.name}
            description={`${c.orders} orders`}
          />
          <CurrencyText value={c.spend} strong />
        </List.Item>
      )}
    />
  </Card>
);
