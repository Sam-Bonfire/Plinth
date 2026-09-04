import React from "react";
import "./FilterButtonGroup.css";

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

  const handleKeyDown = (e: React.KeyboardEvent, option: FilterOption<T>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle(option);
    }
  };

  return (
    <div className={`plinth-filter-group ${className}`.trim()} role={isMultiple ? "group" : "radiogroup"}>
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <button
            key={String(option.value)}
            type="button"
            role={isMultiple ? "checkbox" : "radio"}
            aria-checked={selected}
            disabled={option.disabled}
            className={`plinth-filter-btn ${selected ? "active" : ""} ${
              option.disabled ? "disabled" : ""
            }`.trim()}
            onClick={() => handleToggle(option)}
            onKeyDown={(e) => handleKeyDown(e, option)}
            tabIndex={option.disabled ? -1 : 0}
          >
            <span className="plinth-filter-btn-label">{option.label}</span>
            {option.count !== undefined && (
              <span className="plinth-filter-btn-count">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
