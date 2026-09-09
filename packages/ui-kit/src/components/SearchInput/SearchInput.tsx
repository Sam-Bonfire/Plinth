import { Input } from "antd";
import React from "react";

export interface SearchInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: "small" | "middle" | "large";
  className?: string;
  style?: React.CSSProperties;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  defaultValue,
  onChange,
  onSearch,
  placeholder = "Search...",
  allowClear = true,
  disabled = false,
  loading = false,
  size = "middle",
  className = "",
  style,
}) => (
  <Input.Search
    value={value}
    defaultValue={defaultValue}
    onChange={(e: React.ChangeEvent<HTMLInputElement>): void => onChange?.(e.target.value)}
    onSearch={onSearch}
    placeholder={placeholder}
    allowClear={allowClear}
    disabled={disabled}
    loading={loading}
    size={size}
    className={`plinth-search-input ${className}`.trim()}
    style={style}
    data-testid="search-input"
    aria-label={placeholder}
  />
);
