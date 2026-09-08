import React from "react";

export type StaffRole = "Owner" | "Manager" | "Cashier" | "Kitchen";

export interface RoleBadgeProps {
  role: StaffRole;
  className?: string;
}

const getRoleConfig = (role: StaffRole) => {
  switch (role) {
    case "Owner":
      return { color: "var(--p)", label: "Owner" };
    case "Manager":
      return { color: "var(--bl)", label: "Manager" };
    case "Cashier":
      return { color: "var(--g)", label: "Cashier" };
    case "Kitchen":
      return { color: "var(--o)", label: "Kitchen" };
  }
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = "" }) => {
  const { color, label } = getRoleConfig(role);

  return (
    <span
      className={`plinth-role-badge ${className}`.trim()}
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
      data-testid={`role-badge-${role.toLowerCase()}`}
    >
      {label}
    </span>
  );
};
