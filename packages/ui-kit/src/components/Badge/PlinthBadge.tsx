import React from "react";

export interface PlinthBadgeProps {
  color: string;
  label: React.ReactNode;
  testId?: string;
  className?: string;
}

export const PlinthBadge: React.FC<PlinthBadgeProps> = ({
  color,
  label,
  testId,
  className = "",
}) => (
  <span
    className={`plinth-badge ${className}`.trim()}
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 8px",
      borderRadius: "4px",
      backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      color: color,
      fontWeight: 600,
      fontSize: "0.85em",
      border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
    }}
    data-testid={testId}
  >
    {label}
  </span>
);
