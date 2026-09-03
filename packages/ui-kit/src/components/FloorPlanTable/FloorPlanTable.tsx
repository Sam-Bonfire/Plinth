import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Table, Tag, Button, Space } from "antd";
import React, { useState, useCallback } from "react";

export interface FloorTableRow {
  id: string;
  tableNumber: string;
  area: string;
  capacity: number;
  zone: string;
  status: "Available" | "Occupied" | "Reserved" | "OutOfService";
  printerZone?: string | null;
}

export interface FloorPlanTableProps {
  data: FloorTableRow[];
  onReorder?: (reordered: FloorTableRow[]) => void;
  onEdit?: (row: FloorTableRow) => void;
  onDelete?: (id: string) => void;
}

export const FloorPlanTable: React.FC<FloorPlanTableProps> = ({ data, onReorder, onEdit, onDelete }) => {
  const [rows, setRows] = useState<FloorTableRow[]>(data);

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = rows.findIndex((r) => r.id === active.id);
        const newIndex = rows.findIndex((r) => r.id === over.id);
        const reordered = arrayMove(rows, oldIndex, newIndex);
        setRows(reordered);
        onReorder?.(reordered);
      }
    },
    [rows, onReorder],
  );

  const columns = [
    { title: "Table", dataIndex: "tableNumber", key: "tableNumber" },
    { title: "Area", dataIndex: "area", key: "area" },
    { title: "Capacity", dataIndex: "capacity", key: "capacity" },
    { title: "Zone", dataIndex: "zone", key: "zone" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: FloorTableRow["status"]): React.ReactNode => {
        const color =
          status === "Available"
            ? "success"
            : status === "Occupied"
              ? "warning"
              : status === "Reserved"
                ? "processing"
                : "default";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: FloorTableRow): React.ReactNode => (
        <Space>
          {onEdit && (
            <Button size="small" onClick={(): void => onEdit(record)}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button size="small" danger onClick={(): void => onDelete(record.id)}>
              Delete
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
        />
      </SortableContext>
    </DndContext>
  );
};
