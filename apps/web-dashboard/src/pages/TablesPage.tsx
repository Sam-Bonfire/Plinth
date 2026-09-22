import { Card, Col, Row, Space, Statistic, Tag, Typography } from "antd";
import React, { useMemo, useState } from "react";

export type TableStatus = "Available" | "Occupied" | "Billing" | "Reserved";

export interface FloorTable {
  id: string;
  label: string;
  capacity: number;
  status: TableStatus;
  partySize: number;
}

interface TablesPageProps {
  initialTables?: FloorTable[];
}

const DEFAULT_TABLES: FloorTable[] = [
  { id: "T-1", label: "T-1", capacity: 2, status: "Available", partySize: 0 },
  { id: "T-2", label: "T-2", capacity: 2, status: "Occupied", partySize: 2 },
  { id: "T-3", label: "T-3", capacity: 4, status: "Occupied", partySize: 3 },
  { id: "T-4", label: "T-4", capacity: 4, status: "Billing", partySize: 4 },
  { id: "T-5", label: "T-5", capacity: 6, status: "Available", partySize: 0 },
  { id: "T-6", label: "T-6", capacity: 6, status: "Reserved", partySize: 0 },
];

const NEXT_STATUS: Record<TableStatus, TableStatus> = {
  Available: "Occupied",
  Occupied: "Billing",
  Billing: "Available",
  Reserved: "Available",
};

const STATUS_COLOR: Record<TableStatus, string> = {
  Available: "success",
  Occupied: "processing",
  Billing: "warning",
  Reserved: "default",
};

export function advanceTableStatus(status: TableStatus): TableStatus {
  return NEXT_STATUS[status];
}

export const TablesPage: React.FC<TablesPageProps> = ({ initialTables }: TablesPageProps) => {
  const [tables, setTables] = useState<FloorTable[]>(initialTables ?? DEFAULT_TABLES);

  const occupied = useMemo((): number => tables.filter((t) => t.status === "Occupied" || t.status === "Billing").length, [tables]);
  const covers = useMemo(
    (): number => tables.reduce((sum: number, t: FloorTable): number => sum + (t.status === "Occupied" ? t.partySize : 0), 0),
    [tables],
  );

  const advance = (id: string): void => {
    setTables((prev: FloorTable[]): FloorTable[] =>
      prev.map((t: FloorTable): FloorTable => (t.id === id ? { ...t, status: advanceTableStatus(t.status) } : t)),
    );
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <Statistic title="Tables" value={tables.length} />
          <Statistic title="Occupied" value={occupied} />
          <Statistic title="Covers" value={covers} />
        </Space>
      </Card>
      <Row gutter={16}>
        {tables.map((t: FloorTable): React.ReactNode => (
          <Col span={6} key={t.id}>
            <Card
              hoverable
              onClick={(): void => advance(t.id)}
              style={{ marginBottom: 16, textAlign: "center" }}
              styles={{ body: { padding: 16 } }}
            >
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t.label}
                </Typography.Title>
                <Typography.Text type="secondary">
                  Seats {t.capacity}
                  {t.status === "Occupied" ? ` · Party of ${t.partySize}` : ""}
                </Typography.Text>
                <Tag color={STATUS_COLOR[t.status]}>{t.status}</Tag>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
