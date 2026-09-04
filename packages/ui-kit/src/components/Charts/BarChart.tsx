import { Column, ColumnConfig } from "@ant-design/charts";
import React from "react";
import { ChartContainer, ChartContainerProps } from "./ChartContainer.js";

export interface BarChartProps<T extends Record<string, unknown>>
  extends Omit<ChartContainerProps, "children" | "isEmpty"> {
  data: T[];
  xField: keyof T;
  yField: keyof T;
  seriesField?: keyof T;
  isGroup?: boolean;
  isCurrency?: boolean;
  currencySymbol?: string;
  colors?: string[];
  config?: Partial<ColumnConfig>;
}

export const BarChart = <T extends Record<string, unknown>>({
  data,
  xField,
  yField,
  seriesField,
  isGroup = false,
  isCurrency = false,
  currencySymbol = "$",
  colors,
  config,
  ...containerProps
}: BarChartProps<T>): React.ReactElement => {
  const isEmpty = !data || data.length === 0;

  const defaultColors = [
    "var(--acc)", // Primary Accent
    "var(--g)",   // Success / Emerald
    "var(--y)",   // Warning / Amber
    "var(--r)",   // Danger / Rose
    "var(--s2)",  // Secondary
    "var(--b1)",  // Border
  ];

  const currencyFormatter = (value: number) => {
    return `${currencySymbol}${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const chartConfig: ColumnConfig = {
    data,
    xField: xField as string,
    yField: yField as string,
    colorField: seriesField as string,
    group: isGroup,
    color: colors || defaultColors,
    axis: {
      y: {
        labelFormatter: isCurrency ? currencyFormatter : undefined,
      },
    },
    tooltip: {
      title: (d: Record<string, unknown>) => d[xField as string],
      items: [
        {
          field: yField as string,
          name: (d: Record<string, unknown>) => seriesField ? d[seriesField as string] : yField,
          valueFormatter: isCurrency ? currencyFormatter : undefined,
        },
      ],
    },
    ...config,
  };

  return (
    <ChartContainer {...containerProps} isEmpty={isEmpty}>
      {!isEmpty && <Column {...chartConfig} />}
    </ChartContainer>
  );
};
