import { InputNumber, Space, Button } from "antd";
import React from "react";

export interface CurrencyInputProps {
  value?: number | string;
  onChange?: (value: number | undefined) => void;
  currency?: string;
  decimals?: number;
  allowNegative?: boolean;
  quickIncrements?: number[];
  size?: "sm" | "md" | "lg" | "pos-large";
  disabled?: boolean;
  placeholder?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  currency = "INR",
  decimals = 2,
  allowNegative = false,
  quickIncrements,
  size = "md",
  disabled = false,
  placeholder,
}) => {
  // Convert custom sizes to antd sizes when appropriate, or use custom styles
  const antdSize = size === "sm" ? "small" : size === "lg" || size === "pos-large" ? "large" : "middle";

  // Custom height for pos-large
  const inputStyle = size === "pos-large" ? { height: "64px", fontSize: "1.5rem" } : undefined;

  // Convert string values to numbers if needed, InputNumber normally takes number or string.
  // We'll manage numeric value conversion in onChange wrapper to ensure it calls onChange with number | undefined
  const handleChange = (val: number | string | null) => {
    if (val === null || val === undefined || val === "") {
      onChange?.(undefined);
      return;
    }
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (!isNaN(num)) {
      onChange?.(num);
    } else {
      onChange?.(undefined);
    }
  };

  const currentNumericValue = typeof value === "string" ? parseFloat(value) : value;

  const handleIncrement = (amount: number) => {
    const currentValue = typeof currentNumericValue === "number" && !isNaN(currentNumericValue) ? currentNumericValue : 0;
    const newValue = currentValue + amount;
    onChange?.(Number(newValue.toFixed(decimals)));
  };

  return (
    <div className="currency-input-wrapper" style={{ width: "100%" }}>
      <InputNumber
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        size={antdSize}
        style={{ width: "100%", ...inputStyle }}
        addonBefore={currency}
        min={allowNegative ? undefined : 0}
        precision={decimals}
        inputMode="decimal"
        role="spinbutton"
        aria-label="Currency Input"
        stringMode={false} // Use numbers for value type to avoid parse issues unless needed for high precision
      />

      {quickIncrements && quickIncrements.length > 0 && (
        <Space wrap style={{ marginTop: "8px", display: "flex" }}>
          {quickIncrements.map((inc) => (
            <Button
              key={inc}
              size={antdSize === "large" ? "middle" : "small"}
              disabled={disabled}
              onClick={() => handleIncrement(inc)}
            >
              +{inc}
            </Button>
          ))}
        </Space>
      )}
    </div>
  );
};
