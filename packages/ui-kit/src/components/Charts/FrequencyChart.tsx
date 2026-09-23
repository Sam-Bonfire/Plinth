import React from "react";
import { BarChart } from "./BarChart.js";

export interface FrequencyEntry {
  visits: number;
}

export type FrequencyRow = {
  bucket: string;
  count: number;
};

export interface FrequencyChartProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  entries: FrequencyEntry[];
  height?: number | string;
}

export function toFrequencyRows(entries: FrequencyEntry[]): FrequencyRow[] {
  if (entries.length === 0) return [];

  let bucket1 = 0;
  let bucket2_5 = 0;
  let bucket6_12 = 0;
  let bucket13_plus = 0;

  for (const entry of entries) {
    if (entry.visits === 1) bucket1++;
    else if (entry.visits >= 2 && entry.visits <= 5) bucket2_5++;
    else if (entry.visits >= 6 && entry.visits <= 12) bucket6_12++;
    else if (entry.visits >= 13) bucket13_plus++;
  }

  return [
    { bucket: "1", count: bucket1 },
    { bucket: "2-5", count: bucket2_5 },
    { bucket: "6-12", count: bucket6_12 },
    { bucket: "13+", count: bucket13_plus },
  ];
}

export const FrequencyChart: React.FC<FrequencyChartProps> = ({
  title,
  subtitle,
  entries,
  height,
}: FrequencyChartProps): React.ReactElement => {
  return (
    <BarChart
      data={toFrequencyRows(entries)}
      xField="bucket"
      yField="count"
      title={title}
      subtitle={subtitle}
      height={height}
    />
  );
};
