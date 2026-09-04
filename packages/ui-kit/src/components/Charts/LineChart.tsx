import { Line, LineConfig } from "@ant-design/charts";
import React from "react";
import { ChartContainer, ChartContainerProps } from "./ChartContainer.js";

export interface LineChartProps<T extends Record<string, unknown>>
  extends Omit<ChartContainerProps, "children" | "isEmpty"> {
  data: T[];
  xField: keyof T;
  yField: keyof T;
  seriesField?: keyof T;
  isTimeSeries?: boolean;
  isArea?: boolean;
  colors?: string[];
  config?: Partial<LineConfig>;
}

export const LineChart = <T extends Record<string, unknown>>({
  data,
  xField,
  yField,
  seriesField,
  isTimeSeries = false,
  isArea = false,
  colors,
  config,
  ...containerProps
}: LineChartProps<T>): React.ReactElement => {
  const isEmpty = !data || data.length === 0;

  const defaultColors = [
    "var(--acc)", // Primary Accent
    "var(--g)",   // Success / Emerald
    "var(--y)",   // Warning / Amber
    "var(--r)",   // Danger / Rose
    "var(--s2)",  // Secondary
    "var(--b1)",  // Border
  ];

  const chartConfig: LineConfig = {
    data,
    xField: xField as string,
    yField: yField as string,
    colorField: seriesField as string,
    color: colors || defaultColors,
    shapeField: 'smooth',
    axis: {
      x: isTimeSeries ? { type: 'time' } : undefined,
    },
    style: isArea
      ? {
          fill: "linear-gradient(-90deg, white 0%, var(--acc) 100%)",
          fillOpacity: 0.3,
        }
      : undefined,
    ...config,
  };

  return (
    <ChartContainer {...containerProps} isEmpty={isEmpty}>
      {!isEmpty && <Line {...chartConfig} />}
    </ChartContainer>
  );
};
