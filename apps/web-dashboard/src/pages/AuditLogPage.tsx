import type { AuditEventDto } from "@plinth/ui-kit";
import { Alert, Card, Segmented, Space, Table, Tag, Typography, type TableColumnsType } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider.js";

export const AuditLogPage: React.FC = () => {
  const { client } = useAuth();
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");

  useEffect(() => {
    let cancelled = false;
    client
      .listAuditEvents(100)
      .then((rows: AuditEventDto[]): void => {
        if (!cancelled) {
          setEvents(rows);
          setError(null);
        }
      })
      .catch((err: unknown): void => {
        if (!cancelled) {
          setEvents([]);
          setError(err instanceof Error ? err.message : String(err));
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
    { title: "Target", key: "target", width: 200, render: (_: unknown, row: AuditEventDto): React.ReactNode => `${row.target_type} · ${row.target_id}` },
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
      {error !== null && (
        <Alert
          message="Audit service unavailable"
          description={`Live audit events could not be loaded (${error}). No placeholder entries are shown.`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Card
        title="Audit Log"
        extra={
          <Space>
            <Typography.Text type="secondary">{error !== null ? "Offline" : "Live"} · {rows.length} events</Typography.Text>
            <Segmented options={["All", "Anomalies"]} value={filter} onChange={(v: string | number): void => setFilter(v.toString())} size="small" />
          </Space>
        }
      >
        <Table<AuditEventDto>
          dataSource={rows}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="small"
          locale={{ emptyText: error !== null ? "Audit service unavailable - no events loaded." : "No audit events." }}
        />
      </Card>
    </div>
  );
};
