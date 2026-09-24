import { Card, Col, Row, Space, Statistic, Tag, Typography } from "antd";
import React, { useMemo, useState } from "react";
import { TableSeatModal } from "../components/TableSeatModal";
import { TableSession, TurnoverReport } from "../components/TurnoverReport";

export type TableStatus = "Available" | "Occupied" | "Billing" | "Reserved";

export interface FloorTable {
  id: string;
  label: string;
  capacity: number;
  status: TableStatus;
  partySize: number;
  waiter: string;
  orderId: string | null;
}

interface TablesPageProps {
  initialTables?: FloorTable[];
}

const DEFAULT_TABLES: FloorTable[] = [
  { id: "T-1", label: "T-1", capacity: 2, status: "Available", partySize: 0, waiter: "", orderId: null },
  { id: "T-2", label: "T-2", capacity: 2, status: "Occupied", partySize: 2, waiter: "Ravi", orderId: "ORD-1098" },
  { id: "T-3", label: "T-3", capacity: 4, status: "Occupied", partySize: 3, waiter: "Sana", orderId: "ORD-1099" },
  { id: "T-4", label: "T-4", capacity: 4, status: "Billing", partySize: 4, waiter: "Ravi", orderId: "ORD-1095" },
  { id: "T-5", label: "T-5", capacity: 6, status: "Available", partySize: 0, waiter: "", orderId: null },
  { id: "T-6", label: "T-6", capacity: 6, status: "Reserved", partySize: 0, waiter: "", orderId: null },
];

const WAITERS: string[] = ["Ravi", "Sana", "Vikram"];

const SEED_SESSIONS: TableSession[] = [
  { table: "T-1", seatedAt_min: 0, clearedAt_min: 45, covers: 2 },
  { table: "T-1", seatedAt_min: 60, clearedAt_min: 90, covers: 2 },
  { table: "T-2", seatedAt_min: 15, clearedAt_min: null, covers: 2 },
  { table: "T-3", seatedAt_min: 30, clearedAt_min: null, covers: 3 },
  { table: "T-4", seatedAt_min: 10, clearedAt_min: null, covers: 4 },
  { table: "T-5", seatedAt_min: 0, clearedAt_min: 60, covers: 5 },
  { table: "T-6", seatedAt_min: 20, clearedAt_min: 80, covers: 6 },
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

/// Opens a table for a new order: seats the party and attaches an order id.
export function openTableOrder(table: FloorTable, partySize: number, waiter: string, orderSeq: number): FloorTable {
  return { ...table, partySize, waiter, status: "Occupied", orderId: `ORD-${orderSeq}` };
}

/// Closes a table's order: clears party, waiter, and order link.
export function closeTableOrder(table: FloorTable): FloorTable {
  return { ...table, partySize: 0, waiter: "", status: "Available", orderId: null };
}

export const TablesPage: React.FC<TablesPageProps> = ({ initialTables }: TablesPageProps) => {
  const [tables, setTables] = useState<FloorTable[]>(initialTables ?? DEFAULT_TABLES);
  const [seating, setSeating] = useState<FloorTable | null>(null);
  const [orderSeq, setOrderSeq] = useState<number>(1100);

  const occupied = useMemo((): number => tables.filter((t) => t.status === "Occupied" || t.status === "Billing").length, [tables]);
  const covers = useMemo(
    (): number => tables.reduce((sum: number, t: FloorTable): number => sum + (t.status === "Occupied" ? t.partySize : 0), 0),
    [tables],
  );

  const advance = (id: string): void => {
    setTables((prev: FloorTable[]): FloorTable[] =>
      prev.map((t: FloorTable): FloorTable => {
        if (t.id !== id) return t;
        const next = advanceTableStatus(t.status);
        const moved: FloorTable = { ...t, status: next };
        return next === "Available" ? closeTableOrder(moved) : moved;
      }),
    );
  };

  const handleCardClick = (t: FloorTable): void => {
    if (t.status === "Available" || t.status === "Reserved") {
      setSeating(t);
    } else {
      advance(t.id);
    }
  };

  const saveSeating = (partySize: number, waiter: string): void => {
    if (seating === null) return;
    const id = seating.id;
    const seq = orderSeq;
    setOrderSeq((n: number): number => n + 1);
    setTables((prev: FloorTable[]): FloorTable[] =>
      prev.map((t: FloorTable): FloorTable => (t.id === id ? openTableOrder(t, partySize, waiter, seq) : t)),
    );
    setSeating(null);
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
              onClick={(): void => handleCardClick(t)}
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
                  {t.status === "Occupied" && t.waiter !== "" ? ` · ${t.waiter}` : ""}
                  {t.orderId !== null ? ` · ${t.orderId}` : ""}
                </Typography.Text>
                <Tag color={STATUS_COLOR[t.status]}>{t.status}</Tag>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      <TurnoverReport sessions={SEED_SESSIONS} totalTablesCount={tables.length} />
      {seating !== null && (
        <TableSeatModal
          tableLabel={seating.label}
          capacity={seating.capacity}
          waiters={WAITERS}
          open={true}
          onClose={(): void => setSeating(null)}
          onSave={saveSeating}
        />
      )}
    </div>
  );
};
