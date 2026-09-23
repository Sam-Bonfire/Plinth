import { Card, Col, Row, Statistic, Table } from "antd";
import React, { useMemo } from "react";

export interface TableSession {
  table: string;
  seatedAt_min: number;
  clearedAt_min: number | null;
  covers: number;
}

export interface TurnoverStats {
  perTableAvgTurnover: Record<string, number>;
  overallOccupancyPercent: number;
}

export function computeTurnoverStats(sessions: TableSession[], totalTablesCount: number): TurnoverStats {
  const tableTimes: Record<string, number[]> = {};
  const activeTables = new Set<string>();

  for (const session of sessions) {
    if (session.clearedAt_min === null) {
      activeTables.add(session.table);
    } else {
      if (!tableTimes[session.table]) {
        tableTimes[session.table] = [];
      }
      tableTimes[session.table].push(session.clearedAt_min - session.seatedAt_min);
    }
  }

  const perTableAvgTurnover: Record<string, number> = {};
  for (const [table, times] of Object.entries(tableTimes)) {
    if (times.length > 0) {
      const sum = times.reduce((acc, t) => acc + t, 0);
      perTableAvgTurnover[table] = sum / times.length;
    }
  }

  const overallOccupancyPercent =
    totalTablesCount > 0 ? (activeTables.size / totalTablesCount) * 100 : 0;

  return {
    perTableAvgTurnover,
    overallOccupancyPercent,
  };
}

export const TurnoverReport: React.FC<{ sessions: TableSession[]; totalTablesCount: number }> = ({
  sessions,
  totalTablesCount,
}) => {
  const stats = useMemo(() => computeTurnoverStats(sessions, totalTablesCount), [sessions, totalTablesCount]);

  const dataSource = useMemo(() => {
    return Object.entries(stats.perTableAvgTurnover).map(([table, avgTurnover]) => ({
      key: table,
      table,
      avgTurnover: Math.round(avgTurnover),
    }));
  }, [stats.perTableAvgTurnover]);

  const columns = [
    {
      title: "Table",
      dataIndex: "table",
      key: "table",
    },
    {
      title: "Avg Turnover (min)",
      dataIndex: "avgTurnover",
      key: "avgTurnover",
    },
  ];

  return (
    <Card title="Turnover Report" style={{ marginTop: 16 }}>
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title="Occupancy Rate"
            value={stats.overallOccupancyPercent}
            precision={2}
            suffix="%"
          />
        </Col>
      </Row>
      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        style={{ marginTop: 16 }}
      />
    </Card>
  );
};
