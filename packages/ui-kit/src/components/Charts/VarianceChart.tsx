import React from "react";
import { BarChart } from "./BarChart.js";

export interface VarianceEntry {
  label: string;
  theoretical: number;
  actual: number;
}

export type VarianceRow = {
  label: string;
  series: "Theoretical" | "Actual";
  value: number;
};

export interface VarianceChartProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  entries: VarianceEntry[];
  height?: number | string;
}

export function toVarianceRows(entries: VarianceEntry[]): VarianceRow[] {
  return entries.flatMap((e) => [
    { label: e.label, series: "Theoretical" as const, value: e.theoretical },
    { label: e.label, series: "Actual" as const, value: e.actual },
  ]);
}

export function varianceTotal(entries: VarianceEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.actual - e.theoretical), 0);
}

export const VarianceChart: React.FC<VarianceChartProps> = ({
  title,
  subtitle,
  entries,
  height,
}: VarianceChartProps): React.ReactElement => {
  return (
    <BarChart
      data={toVarianceRows(entries)}
      xField="label"
      yField="value"
      seriesField="series"
      isGroup
      title={title}
      subtitle={subtitle}
      height={height}
    />
  );
};
