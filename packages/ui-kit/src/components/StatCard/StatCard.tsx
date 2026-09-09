import { Card, Statistic, Typography } from "antd";
import React from "react";

export type StatCardTone = "success" | "danger" | "secondary";

export interface StatCardProps extends Omit<React.ComponentProps<typeof Statistic>, "title" | "value" | "suffix"> {
  title: React.ReactNode;
  value: string | number;
  delta?: React.ReactNode;
  tone?: StatCardTone;
  className?: string;
  cardStyle?: React.CSSProperties;
}

const toneColor: Record<StatCardTone, string> = {
  success: "var(--g)",
  danger: "var(--r)",
  secondary: "var(--acc)",
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  delta,
  tone = "secondary",
  className = "",
  cardStyle,
  valueStyle,
  ...rest
}) => (
  <Card className={`plinth-stat-card ${className}`.trim()} style={cardStyle} data-testid="stat-card">
    <Statistic
      title={title}
      value={value}
      valueStyle={{ fontFamily: "var(--mono)", color: toneColor[tone], ...valueStyle }}
      suffix={
        delta === undefined ? undefined : (
          <Typography.Text
            type={tone === "secondary" ? "secondary" : tone}
            style={{ fontSize: 12 }}
          >
            {delta}
          </Typography.Text>
        )
      }
      {...rest}
    />
  </Card>
);
