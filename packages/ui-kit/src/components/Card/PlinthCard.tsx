import React, { ReactNode } from "react";

export type PlinthCardVariant = "bordered" | "elevated" | "flat";

export interface PlinthCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  variant?: PlinthCardVariant;
  actionSlots?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}

export const PlinthCard: React.FC<PlinthCardProps> = ({
  title,
  subtitle,
  variant = "bordered",
  actionSlots,
  children,
  className = "",
  style,
  bodyStyle,
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case "elevated":
        return {
          backgroundColor: "var(--bg)",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          border: "none",
        };
      case "flat":
        return {
          backgroundColor: "transparent",
          border: "none",
        };
      case "bordered":
      default:
        return {
          backgroundColor: "var(--bg)",
          border: "1px solid var(--b1)",
        };
    }
  };

  return (
    <div
      className={`plinth-card ${className}`.trim()}
      style={{
        borderRadius: "var(--border-radius-lg, 12px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...getVariantStyles(),
        ...style,
      }}
      data-testid="plinth-card"
    >
      {(title || subtitle || actionSlots) && (
        <div
          className="plinth-card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px",
            borderBottom: variant !== "flat" ? "1px solid var(--b1)" : "none",
          }}
          data-testid="plinth-card-header"
        >
          <div className="plinth-card-header-titles">
            {title && (
              <div
                className="plinth-card-title"
                style={{
                  fontWeight: 600,
                  fontSize: "1.125rem",
                  color: "var(--acc)",
                  margin: 0,
                }}
                data-testid="plinth-card-title"
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div
                className="plinth-card-subtitle"
                style={{
                  fontSize: "0.875rem",
                  color: "var(--acc)",
                  opacity: 0.6,
                  marginTop: "4px",
                }}
                data-testid="plinth-card-subtitle"
              >
                {subtitle}
              </div>
            )}
          </div>
          {actionSlots && (
            <div className="plinth-card-actions" data-testid="plinth-card-actions">
              {actionSlots}
            </div>
          )}
        </div>
      )}
      <div
        className="plinth-card-body"
        style={{
          padding: "16px",
          flexGrow: 1,
          ...bodyStyle,
        }}
        data-testid="plinth-card-body"
      >
        {children}
      </div>
    </div>
  );
};
