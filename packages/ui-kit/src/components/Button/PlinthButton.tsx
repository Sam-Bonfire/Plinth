import { Button, ButtonProps } from "antd";
import React, { ReactNode } from "react";

export type PlinthButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "pos-action";

export interface PlinthButtonProps extends Omit<ButtonProps, "type" | "icon"> {
  variant?: PlinthButtonVariant;
  shortcutKey?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const PlinthButton: React.FC<PlinthButtonProps> = ({
  variant = "primary",
  shortcutKey,
  icon,
  fullWidth = false,
  className = "",
  style,
  children,
  ...props
}) => {
  let antdType: ButtonProps["type"] = "default";
  let antdDanger = false;

  switch (variant) {
    case "primary":
      antdType = "primary";
      break;
    case "danger":
      antdType = "primary";
      antdDanger = true;
      break;
    case "ghost":
      antdType = "text";
      break;
    case "secondary":
      antdType = "default";
      break;
    case "pos-action":
      antdType = "primary";
      break;
  }

  const baseStyle: React.CSSProperties = {
    ...(fullWidth ? { width: "100%" } : {}),
    ...(variant === "pos-action"
      ? {
          minHeight: "48px",
          fontWeight: "bold",
          transition: "transform 0.1s ease-in-out",
        }
      : {}),
    ...style,
  };

  const getPosActionClass = () => {
    return variant === "pos-action" ? "plinth-btn-pos-action" : "";
  };

  return (
    <Button
      type={antdType}
      danger={antdDanger}
      icon={icon}
      style={baseStyle}
      className={`plinth-button ${getPosActionClass()} ${className}`.trim()}
      {...props}
    >
      {children}
      {shortcutKey && (
        <kbd
          style={{
            marginLeft: "8px",
            padding: "2px 4px",
            fontSize: "0.8em",
            backgroundColor: "rgba(0,0,0,0.1)",
            borderRadius: "4px",
            border: "1px solid rgba(0,0,0,0.2)",
            fontFamily: "var(--mono)",
          }}
          data-testid="shortcut-key"
        >
          {shortcutKey}
        </kbd>
      )}
    </Button>
  );
};
