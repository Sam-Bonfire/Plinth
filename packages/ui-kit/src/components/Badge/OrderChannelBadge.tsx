import React from "react";

export type OrderChannel = "DineIn" | "Takeaway" | "Delivery" | "Swiggy" | "Zomato";

export interface OrderChannelBadgeProps {
  channel: OrderChannel;
  className?: string;
}

const getChannelConfig = (channel: OrderChannel) => {
  switch (channel) {
    case "DineIn":
      return { color: "var(--bl)", label: "Dine-in" }; // Dine-in blue
    case "Takeaway":
      return { color: "var(--p)", label: "Takeaway" }; // Purple
    case "Delivery":
      return { color: "var(--acc)", label: "Delivery" }; // Accent
    case "Swiggy":
      return { color: "var(--o)", label: "Swiggy" }; // Swiggy orange
    case "Zomato":
      return { color: "var(--r)", label: "Zomato" }; // Zomato red
    default:
      return { color: "var(--b1)", label: channel };
  }
};

export const OrderChannelBadge: React.FC<OrderChannelBadgeProps> = ({
  channel,
  className = "",
}) => {
  const { color, label } = getChannelConfig(channel);

  return (
    <span
      className={`plinth-channel-badge ${className}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: "4px",
        backgroundColor: `${color}1A`, // 10% opacity
        color: color,
        fontWeight: 600,
        fontSize: "0.85em",
        border: `1px solid ${color}33`, // 20% opacity
      }}
      data-testid={`channel-badge-${channel.toLowerCase()}`}
    >
      {label}
    </span>
  );
};
