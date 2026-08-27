import { Card, Button, Typography, Tag, Space, Divider } from "antd";
import React from "react";

const { Text } = Typography;

export interface KDSTicketItem {
  id: string;
  name: string;
  quantity: number;
  modifiers?: string[];
  notes?: string;
  completed?: boolean;
}

export interface KDSTicketCardProps {
  ticketId: string;
  kotNumber: number;
  channel: string;
  tableName?: string;
  elapsedSeconds: number;
  slaStatus: "OnTime" | "Warning" | "Late";
  items: KDSTicketItem[];
  onToggleItem?: (itemId: string) => void;
  onBump: () => void;
}

export const KDSTicketCard: React.FC<KDSTicketCardProps> = ({
  kotNumber,
  channel,
  tableName,
  elapsedSeconds,
  slaStatus,
  items,
  onToggleItem,
  onBump,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getBorderColor = () => {
    switch (slaStatus) {
      case "OnTime":
        return "var(--success, #52c41a)";
      case "Warning":
        return "var(--warning, #faad14)";
      case "Late":
        return "var(--error, #f5222d)";
      default:
        return "var(--b1)";
    }
  };

  const cardStyle = {
    borderColor: "var(--b1)",
    borderTop: `4px solid ${getBorderColor()}`,
    borderRadius: 8,
    marginBottom: 16,
    width: 320,
    backgroundColor: "var(--bg)",
  };

  const timeStyle = {
    fontFamily: "var(--mono)",
    color: getBorderColor(),
    fontWeight: "bold",
    fontSize: "1.2rem",
    animation: slaStatus === "Late" ? "pulse 1s infinite" : undefined,
  };

  const renderHeader = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Space>
        <Text strong style={{ fontSize: "1.2rem" }}>
          #{kotNumber}
        </Text>
        <Tag color="blue">{channel}</Tag>
        {tableName && <Tag>{tableName}</Tag>}
      </Space>
      <Text style={timeStyle}>{formatTime(elapsedSeconds)}</Text>
    </div>
  );

  return (
    <Card size="small" style={cardStyle}>
      {renderHeader()}
      <Divider style={{ margin: "12px 0" }} />
      <div style={{ minHeight: "150px" }}>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onToggleItem?.(item.id)}
            style={{
              cursor: "pointer",
              padding: "8px 0",
              textDecoration: item.completed ? "line-through" : "none",
              opacity: item.completed ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text strong>
                {item.quantity}x {item.name}
              </Text>
            </div>
            {item.modifiers && item.modifiers.length > 0 && (
              <div style={{ paddingLeft: "16px", color: "var(--secondary-text, #8c8c8c)" }}>
                {item.modifiers.map((mod, idx) => (
                  <div key={idx}>+ {mod}</div>
                ))}
              </div>
            )}
            {item.notes && (
              <div style={{ paddingLeft: "16px", color: "var(--warning, #faad14)", fontStyle: "italic" }}>
                Note: {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>
      <Divider style={{ margin: "12px 0" }} />
      <Button
        type="primary"
        block
        size="large"
        style={{ height: "48px", fontSize: "1.2rem", fontWeight: "bold" }}
        onClick={onBump}
      >
        BUMP
      </Button>
    </Card>
  );
};
