import { Segmented } from "antd";
import React from "react";

export const ALL_CATEGORIES = "all";

export interface InventoryCategoryTabsProps {
  categories: string[];
  value?: string;
  onChange: (category: string) => void;
  className?: string;
}

export const InventoryCategoryTabs: React.FC<InventoryCategoryTabsProps> = ({
  categories,
  value = ALL_CATEGORIES,
  onChange,
  className = "",
}) => (
  <Segmented
    value={value}
    onChange={(next: string | number): void => onChange(String(next))}
    options={[
      { label: "All", value: ALL_CATEGORIES },
      ...categories.map((category) => ({ label: category, value: category })),
    ]}
    className={`plinth-inventory-category-tabs ${className}`.trim()}
    data-testid="inventory-category-tabs"
  />
);
