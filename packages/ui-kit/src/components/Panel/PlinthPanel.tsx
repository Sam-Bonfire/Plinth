import React, { ReactNode, useState } from "react";
import { PlinthCard, PlinthCardVariant } from "../Card/PlinthCard.js";

export interface PlinthPanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  variant?: PlinthCardVariant;
  actionSlots?: ReactNode;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}

export const PlinthPanel: React.FC<PlinthPanelProps> = ({
  title,
  subtitle,
  variant = "bordered",
  actionSlots,
  defaultCollapsed = false,
  collapsible = true,
  children,
  className = "",
  style,
  bodyStyle,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  const collapseIcon = collapsible ? (
    <span
      style={{
        display: "inline-block",
        transition: "transform 0.2s",
        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
        marginRight: "8px",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={toggleCollapse}
      data-testid="collapse-icon"
    >
      ▼
    </span>
  ) : null;

  const panelTitle = (
    <div style={{ display: "flex", alignItems: "center" }}>
      {collapseIcon}
      <span
        style={{ cursor: collapsible ? "pointer" : "default" }}
        onClick={toggleCollapse}
        data-testid="panel-title-text"
      >
        {title}
      </span>
    </div>
  );

  return (
    <PlinthCard
      title={panelTitle}
      subtitle={subtitle}
      variant={variant}
      actionSlots={actionSlots}
      className={`plinth-panel ${className}`.trim()}
      style={style}
      bodyStyle={{
        ...bodyStyle,
        display: isCollapsed ? "none" : "block",
      }}
    >
      {children}
    </PlinthCard>
  );
};
