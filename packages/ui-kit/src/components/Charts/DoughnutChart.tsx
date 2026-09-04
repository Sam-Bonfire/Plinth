import { Pie, PieConfig } from "@ant-design/charts";
import React from "react";
import { ChartContainer, ChartContainerProps } from "./ChartContainer.js";

export interface DoughnutChartProps<T extends Record<string, unknown>>
  extends Omit<ChartContainerProps, "children" | "isEmpty"> {
  data: T[];
  angleField: keyof T;
  colorField: keyof T;
  centerTotal?: {
    title?: string;
    value?: string | number;
  };
  colors?: string[];
  config?: Partial<PieConfig>;
}

export const DoughnutChart = <T extends Record<string, unknown>>({
  data,
  angleField,
  colorField,
  centerTotal,
  colors,
  config,
  ...containerProps
}: DoughnutChartProps<T>): React.ReactElement => {
  const isEmpty = !data || data.length === 0;

  const defaultColors = [
    "var(--acc)", // Primary Accent
    "var(--g)",   // Success / Emerald
    "var(--y)",   // Warning / Amber
    "var(--r)",   // Danger / Rose
    "var(--s2)",  // Secondary
    "var(--b1)",  // Border
  ];

  const chartConfig: PieConfig = {
    data,
    angleField: angleField as string,
    colorField: colorField as string,
    radius: 1,
    innerRadius: 0.64,
    color: colors || defaultColors,
    legend: {
      color: {
        title: false,
        position: 'right',
        rowPadding: 5,
      },
    },
    label: {
      text: (d: Record<string, unknown>) => `${d[angleField as string]}`,
      style: {
        fontWeight: 'bold',
      },
    },
    annotations: centerTotal
      ? [
          {
            type: "text",
            style: {
              text: centerTotal.title || "Total",
              x: "50%",
              y: "45%",
              textAlign: "center",
              fontSize: 14,
              fill: "var(--fg)",
            },
          },
          {
            type: "text",
            style: {
              text: `${centerTotal.value || ""}`,
              x: "50%",
              y: "55%",
              textAlign: "center",
              fontSize: 24,
              fontWeight: "bold",
              fill: "var(--fg)",
            },
          },
        ]
      : [],
    ...config,
  };

  return (
    <ChartContainer {...containerProps} isEmpty={isEmpty}>
      {!isEmpty && <Pie {...chartConfig} />}
    </ChartContainer>
  );
};
