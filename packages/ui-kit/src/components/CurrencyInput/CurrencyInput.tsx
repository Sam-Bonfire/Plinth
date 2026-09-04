import { InputNumber } from 'antd';
import React, { useCallback, useMemo } from 'react';
import { PlinthButton } from '../Button/PlinthButton.js';
import './CurrencyInput.css';

export interface CurrencyInputProps {
  value?: number | string;
  onChange?: (value: number | undefined) => void;
  currency?: string;
  decimals?: number;
  allowNegative?: boolean;
  quickIncrements?: number[];
  size?: 'sm' | 'md' | 'lg' | 'pos-large';
  disabled?: boolean;
  placeholder?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  currency = '₹',
  decimals = 2,
  allowNegative = false,
  quickIncrements,
  size = 'md',
  disabled = false,
  placeholder,
}) => {
  const numericValue = useMemo(() => {
    if (value === undefined || value === null || value === '') return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? undefined : num;
  }, [value]);

  const handleIncrement = useCallback(
    (amount: number) => {
      if (disabled || onChange === undefined) return;
      const currentValue = numericValue || 0;
      const newValue = currentValue + amount;
      onChange(newValue);
    },
    [disabled, numericValue, onChange]
  );

  const parser = useCallback(
    (displayValue: string | undefined): number | string => {
      if (!displayValue) return '';
      // Remove any non-numeric characters except minus sign and decimal point
      let cleanValue = displayValue.replace(/[^\d.-]/g, '');

      // Handle allowNegative
      if (!allowNegative) {
        cleanValue = cleanValue.replace(/-/g, '');
      } else {
        // Ensure only one minus sign at the beginning
        const isNegative = cleanValue.startsWith('-');
        cleanValue = cleanValue.replace(/-/g, '');
        if (isNegative) {
          cleanValue = '-' + cleanValue;
        }
      }

      // Handle decimals
      if (decimals === 0) {
        cleanValue = cleanValue.replace(/\./g, '');
      } else {
        const parts = cleanValue.split('.');
        if (parts.length > 2) {
          cleanValue = parts[0] + '.' + parts.slice(1).join('');
        }
        // Limit decimal places
        if (parts[1] && parts[1].length > decimals) {
          cleanValue = parts[0] + '.' + parts[1].substring(0, decimals);
        }
      }

      // Allow intermediate typing states
      if (cleanValue === '-' || cleanValue === '.' || cleanValue === '-.') {
        return cleanValue;
      }

      const parsed = parseFloat(cleanValue);
      return isNaN(parsed) ? '' : cleanValue;
    },
    [allowNegative, decimals]
  );

  const formatter = useCallback(
    (val: string | number | undefined): string => {
      if (val === undefined || val === null || val === '') return '';
      const strVal = String(val);
      return strVal;
    },
    []
  );

  const antdSize = useMemo(() => {
    if (size === 'sm') return 'small';
    if (size === 'lg' || size === 'pos-large') return 'large';
    return 'middle';
  }, [size]);

  const sizeClass = useMemo(() => {
    switch (size) {
      case 'pos-large': return 'plinth-currency-input-pos-large';
      case 'sm': return 'plinth-currency-input-sm';
      case 'lg': return 'plinth-currency-input-lg';
      case 'md':
      default:
        return 'plinth-currency-input-md';
    }
  }, [size]);

  return (
    <div className={`plinth-currency-input-wrapper ${sizeClass}`}>
      <InputNumber
        value={numericValue}
        onChange={(val) => onChange?.(val === null ? undefined : Number(val))}
        disabled={disabled}
        placeholder={placeholder}
        prefix={<span className="plinth-currency-prefix">{currency}</span>}
        className="plinth-currency-input-field"
        min={allowNegative ? undefined : 0}
        step={decimals === 0 ? 1 : Math.pow(10, -decimals)}
        precision={decimals}
        size={antdSize}
        parser={parser as unknown as (displayValue: string | undefined) => number}
        formatter={formatter as unknown as (
          value: number | string | undefined,
          info: { userTyping: boolean; input: string }
        ) => string}
        inputMode="decimal"
        controls={false}
        role="spinbutton"
        aria-label="Currency Input"
      />

      {quickIncrements && quickIncrements.length > 0 && (
        <div className="plinth-currency-quick-increments">
          {quickIncrements.map((amount) => (
            <PlinthButton
              key={amount}
              variant="secondary"
              onClick={() => handleIncrement(amount)}
              disabled={disabled}
              className="plinth-currency-increment-btn"
              htmlType="button"
            >
              +{currency}{amount}
            </PlinthButton>
          ))}
        </div>
      )}
    </div>
  );
};
