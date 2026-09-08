import { Switch } from "antd";
import React from "react";

export interface ToggleSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  size?: "small" | "default";
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  defaultChecked,
  onChange,
  checkedChildren,
  unCheckedChildren,
  disabled = false,
  loading = false,
  size = "default",
  ariaLabel,
  className = "",
  style,
}) => (
  <Switch
    checked={checked}
    defaultChecked={defaultChecked}
    onChange={onChange}
    checkedChildren={checkedChildren}
    unCheckedChildren={unCheckedChildren}
    disabled={disabled}
    loading={loading}
    size={size}
    aria-label={ariaLabel}
    className={`plinth-toggle ${className}`.trim()}
    style={style}
    data-testid="toggle-switch"
  />
);
