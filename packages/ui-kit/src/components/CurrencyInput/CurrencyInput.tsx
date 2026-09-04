import { InputNumber, theme } from 'antd';
import React, { useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { PlinthButton } from '../Button/PlinthButton.js';

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

  const { token } = theme.useToken();

  const wrapperStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  };

  const fieldStyle: CSSProperties = {
    width: '100%',
    fontFamily: token.fontFamilyCode,
  };

  return (
    <div style={wrapperStyle}>
      <InputNumber
        value={numericValue}
        onChange={(val) => onChange?.(val === null ? undefined : Number(val))}
        disabled={disabled}
        placeholder={placeholder}
        prefix={
          <span
            style={{
              color: token.colorTextSecondary,
              fontFamily: token.fontFamily,
              marginRight: 4,
            }}
          >
            {currency}
          </span>
        }
        style={fieldStyle}
        className={size === 'pos-large' ? 'plinth-currency-input-pos-large' : undefined}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {quickIncrements.map((amount) => (
            <PlinthButton
              key={amount}
              variant="secondary"
              onClick={() => handleIncrement(amount)}
              disabled={disabled}
              style={{ flex: '1 1 auto', fontFamily: token.fontFamilyCode }}
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
