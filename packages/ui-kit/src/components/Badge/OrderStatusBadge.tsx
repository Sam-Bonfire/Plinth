import React from "react";
import "./badge.css";

export type OrderStatus =
  | "Draft"
  | "Confirmed"
  | "Preparing"
  | "Ready"
  | "Served"
  | "Settled"
  | "Voided"
  | "Refunded";

export interface OrderStatusBadgeProps {
  status: OrderStatus;
  pulse?: boolean;
  className?: string;
}

const getStatusConfig = (status: OrderStatus) => {
  switch (status) {
    case "Draft":
      return { color: "var(--acc)" };
    case "Confirmed":
      return { color: "var(--bl)" };
    case "Preparing":
      return { color: "var(--y)" };
    case "Ready":
      return { color: "var(--g)" };
    case "Served":
      return { color: "var(--g)" };
    case "Settled":
      return { color: "var(--g)" };
    case "Voided":
      return { color: "var(--r)" };
    case "Refunded":
      return { color: "var(--r)" };
    default:
      return { color: "var(--b1)" };
  }
};

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  pulse = false,
  className = "",
}) => {
  const { color } = getStatusConfig(status);

  // Default to pulse for Preparing state if not explicitly disabled
  const shouldPulse = pulse || status === "Preparing";

  return (
    <span
      className={`plinth-status-badge ${shouldPulse ? "plinth-pulse" : ""} ${className}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: "4px",
        backgroundColor: `${color}1A`,
        color: color,
        fontWeight: 600,
        fontSize: "0.85em",
        border: `1px solid ${color}33`,
      }}
      data-testid={`status-badge-${status.toLowerCase()}`}
    >
      {shouldPulse && (
        <span
          className="plinth-pulse-dot"
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: color,
            marginRight: "6px",
          }}
          data-testid="pulse-dot"
        />
      )}
      {status}
    </span>
  );
};
