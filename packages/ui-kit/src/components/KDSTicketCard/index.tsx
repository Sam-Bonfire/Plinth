import { Card, Typography, Button, Badge, Space, List, theme } from "antd";
import React, { useState, useEffect } from "react";

const { Text, Title } = Typography;
const { useToken } = theme;

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
  const { token } = useToken();
  const [timer, setTimer] = useState(elapsedSeconds);

  // Live timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getSLAColor = () => {
    switch (slaStatus) {
      case "OnTime":
        return token.colorSuccess;
      case "Warning":
        return token.colorWarning;
      case "Late":
        return token.colorError;
      default:
        return token.colorBorder;
    }
  };

  const slaColor = getSLAColor();

  return (
    <Card
      styles={{
        body: { padding: 0 },
      }}
      style={{
        border: `2px solid ${slaColor}`,
        overflow: "hidden",
        width: 300,
        backgroundColor: token.colorBgContainer,
        animation: slaStatus === "Late" ? "pulse 2s infinite" : "none",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: token.colorFillAlter,
        }}
      >
        <Space direction="vertical" size={0}>
          <Title level={4} style={{ margin: 0 }}>
            #{kotNumber}
          </Title>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {tableName ? `${channel} - ${tableName}` : channel}
          </Text>
        </Space>
        <div
          style={{
            backgroundColor: slaColor,
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            fontFamily: token.fontFamilyCode,
            fontWeight: "bold",
            fontSize: "16px",
          }}
        >
          {formatTime(timer)}
        </div>
      </div>

      <List
        dataSource={items}
        style={{ padding: "8px 0" }}
        renderItem={(item) => (
          <List.Item
            key={item.id}
            style={{
              padding: "12px 16px",
              cursor: onToggleItem ? "pointer" : "default",
              borderBottom: "none",
            }}
            onClick={() => onToggleItem && onToggleItem(item.id)}
          >
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ marginRight: "12px" }}>
                  <Badge
                    count={item.quantity}
                    style={{
                      backgroundColor: item.completed
                        ? token.colorTextQuaternary
                        : token.colorPrimary,
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      textDecoration: item.completed ? "line-through" : "none",
                      color: item.completed ? token.colorTextSecondary : token.colorText,
                    }}
                  >
                    {item.name}
                  </Text>

                  {item.modifiers && item.modifiers.length > 0 && (
                    <div style={{ marginTop: "4px" }}>
                      {item.modifiers.map((mod, idx) => (
                        <Text
                          key={idx}
                          type="secondary"
                          style={{
                            display: "block",
                            fontSize: "13px",
                            textDecoration: item.completed ? "line-through" : "none",
                          }}
                        >
                          + {mod}
                        </Text>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "4px 8px",
                        backgroundColor: token.colorWarningBg,
                        borderRadius: "4px",
                        border: `1px dashed ${token.colorWarningBorder}`,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: "13px",
                          color: token.colorWarning,
                          textDecoration: item.completed ? "line-through" : "none",
                        }}
                      >
                        Note: {item.notes}
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </List.Item>
        )}
      />

      <div style={{ padding: "16px", borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <Button
          type="primary"
          block
          size="large"
          onClick={onBump}
          style={{
            height: "56px",
            fontSize: "18px",
            fontWeight: "bold",
            letterSpacing: "2px",
          }}
        >
          BUMP
        </Button>
      </div>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
        }
      `}</style>
    </Card>
  );
};
