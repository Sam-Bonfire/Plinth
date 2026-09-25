import type { AuditEventDto } from "@plinth/ui-kit";
import { Alert, Card, Segmented, Space, Table, Tag, Typography, type TableColumnsType } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider.js";

const seedEvents = (): AuditEventDto[] => [
  { id: "E-01", actor_id: "ST-01", action: "Discount 10%", target_type: "Order", target_id: "ORD-1098", is_anomaly: false, timestamp: "Today 12:14" },
  { id: "E-02", actor_id: "ST-02", action: "Void item", target_type: "OrderLine", target_id: "ORD-1101", is_anomaly: true, timestamp: "Today 12:02" },
  { id: "E-03", actor_id: "ST-02", action: "Refund", target_type: "Payment", target_id: "TXN-9002", is_anomaly: false, timestamp: "Today 11:55" },
];

export const AuditLogPage: React.FC = () => {
  const { client } = useAuth();
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [live, setLive] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>("All");

  useEffect(() => {
    let cancelled = false;
    client
      .listAuditEvents(100)
      .then((rows: AuditEventDto[]): void => {
        if (!cancelled) {
          setEvents(rows);
          setLive(true);
        }
      })
      .catch((): void => {
        if (!cancelled) {
          setEvents(seedEvents());
          setLive(false);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [client]);

  const rows = useMemo((): AuditEventDto[] => (filter === "Anomalies" ? events.filter((e: AuditEventDto): boolean => e.is_anomaly) : events), [events, filter]);

  const columns: TableColumnsType<AuditEventDto> = [
    { title: "Time", dataIndex: "timestamp", key: "timestamp", width: 140 },
    { title: "Actor", dataIndex: "actor_id", key: "actor", width: 100 },
    { title: "Action", dataIndex: "action", key: "action" },
    { title: "Target", dataIndex: "target_id", key: "target", width: 140 },
    {
      title: "Flag",
      dataIndex: "is_anomaly",
      key: "flag",
      width: 110,
      render: (anomaly: boolean): React.ReactNode => <Tag color={anomaly ? "warning" : "success"}>{anomaly ? "Review" : "OK"}</Tag>,
    },
  ];

  return (
    <div>
      {!live && (
        <Alert message="Showing cached sample entries - live audit service unreachable." type="warning" showIcon style={{ marginBottom: 16 }} />
      )}
      <Card
        title="Audit Log"
        extra={
          <Space>
            <Typography.Text type="secondary">{live ? "Live" : "Sample"} · {rows.length} events</Typography.Text>
            <Segmented options={["All", "Anomalies"]} value={filter} onChange={(v: string | number): void => setFilter(v.toString())} size="small" />
          </Space>
        }
      >
        <Table<AuditEventDto> dataSource={rows} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} size="small" locale={{ emptyText: "No audit events." }} />
      </Card>
    </div>
  );
};
