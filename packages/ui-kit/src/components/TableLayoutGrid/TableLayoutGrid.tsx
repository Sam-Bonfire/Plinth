import { Card, Empty, Tag, Typography } from "antd";
import React from "react";
import { FloorTableRow, floorStatusColor, floorStatusLabel } from "../FloorPlanTable/FloorPlanTable.js";

export interface TableLayoutGridProps {
  tables: FloorTableRow[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

export const TableLayoutGrid: React.FC<TableLayoutGridProps> = ({
  tables,
  selectedId,
  onSelect,
  className = "",
}) => {
  if (tables.length === 0) {
    return <Empty description="No tables on this floor yet." data-testid="table-grid-empty" />;
  }
  return (
    <div
      className={`plinth-table-grid ${className}`.trim()}
      data-testid="table-layout-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      {tables.map((table) => {
        const selected = table.id === selectedId;
        const selectable = onSelect !== undefined;
        return (
          <Card
            key={table.id}
            hoverable={selectable}
            onClick={(): void => onSelect?.(table.id)}
            onKeyDown={(e: React.KeyboardEvent): void => {
              if (selectable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelect?.(table.id);
              }
            }}
            role={selectable ? "button" : undefined}
            tabIndex={selectable ? 0 : undefined}
            data-testid={`floor-table-${table.id}`}
            aria-pressed={selected}
            style={selected ? { boxShadow: "0 0 0 2px var(--acc)" } : undefined}
            styles={{ body: { padding: 12, textAlign: "center" } }}
          >
            <Typography.Title level={4} style={{ margin: 0 }}>
              {table.tableNumber}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
              {table.capacity} seats · {table.zone}
            </Typography.Text>
            <Tag color={floorStatusColor(table.status)} style={{ marginTop: 8 }}>
              {floorStatusLabel(table.status)}
            </Tag>
          </Card>
        );
      })}
    </div>
  );
};
