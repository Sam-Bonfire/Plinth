import { Button, ConfigProvider, Space, theme } from "antd";
import React from "react";
import type { CSSProperties } from "react";

export interface FilterOption<T> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  count?: number;
}

export type FilterButtonGroupProps<T> = {
  options: FilterOption<T>[];
  className?: string;
} & (
  | {
      multiple?: false;
      value: T;
      onChange: (value: T) => void;
    }
  | {
      multiple: true;
      value: T[];
      onChange: (value: T[]) => void;
    }
);

export function FilterButtonGroup<T extends string | number>(
  props: FilterButtonGroupProps<T>
): React.ReactElement {
  const { options, className = "" } = props;
  const { token } = theme.useToken();
  const isMultiple = props.multiple === true;

  const isSelected = (optionValue: T) => {
    if (props.multiple) {
      return Array.isArray(props.value) && props.value.includes(optionValue);
    }
    return props.value === optionValue;
  };

  const handleToggle = (option: FilterOption<T>) => {
    if (option.disabled) return;

    if (props.multiple) {
      const currentValue = (Array.isArray(props.value) ? props.value : []) as T[];
      const isCurrentlySelected = currentValue.includes(option.value);

      if (isCurrentlySelected) {
        props.onChange(currentValue.filter((v) => v !== option.value));
      } else {
        props.onChange([...currentValue, option.value]);
      }
    } else {
      if (props.value !== option.value) {
        props.onChange(option.value);
      }
    }
  };

  const countStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 10,
    backgroundColor: token.colorBorder,
    color: token.colorPrimary,
    fontFamily: token.fontFamilyCode,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
  };

  const buttonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    height: "auto",
    borderRadius: token.borderRadius,
    fontWeight: 500,
  };

  return (
    <ConfigProvider
      theme={{
        components: {
          Button: {
            colorPrimary: "var(--acc)",
            defaultBg: "var(--bg)",
            defaultColor: "var(--acc)",
            defaultBorderColor: "var(--b1)",
            defaultHoverBg: "var(--b1)",
            defaultHoverColor: "var(--acc)",
            defaultHoverBorderColor: "var(--b1)",
            defaultActiveBg: "var(--b1)",
            defaultActiveColor: "var(--acc)",
            defaultActiveBorderColor: "var(--b1)",
          },
        },
      }}
    >
      <Space
        wrap
        size={8}
        role={isMultiple ? "group" : "radiogroup"}
        className={className}
      >
        {options.map((option) => {
          const selected = isSelected(option.value);
          return (
            <Button
              key={String(option.value)}
              type={selected ? "primary" : undefined}
              disabled={option.disabled}
              role={isMultiple ? "checkbox" : "radio"}
              aria-checked={selected}
              onClick={() => handleToggle(option)}
              tabIndex={option.disabled ? -1 : 0}
              style={buttonStyle}
            >
              <span style={{ lineHeight: 1.2 }}>{option.label}</span>
              {option.count !== undefined && (
                <span
                  style={{
                    ...countStyle,
                    ...(selected ? { backgroundColor: "var(--bg)" } : {}),
                  }}
                >
                  {option.count}
                </span>
              )}
            </Button>
          );
        })}
      </Space>
    </ConfigProvider>
  );
}