import { Typography } from "antd";
import React from "react";

export type PlinthTitleProps = React.ComponentProps<typeof Typography.Title> & {
  level?: 1 | 2 | 3 | 4 | 5;
};

export const PlinthTitle: React.FC<PlinthTitleProps> = ({ level = 4, style, children, ...rest }) => (
  <Typography.Title level={level} style={{ margin: 0, fontFamily: "var(--font)", ...style }} {...rest}>
    {children}
  </Typography.Title>
);

export type PlinthTextProps = React.ComponentProps<typeof Typography.Text>;

export const PlinthText: React.FC<PlinthTextProps> = ({ style, children, ...rest }) => (
  <Typography.Text style={{ fontFamily: "var(--font)", ...style }} {...rest}>
    {children}
  </Typography.Text>
);

export type MonoTextProps = React.ComponentProps<typeof Typography.Text>;

export const MonoText: React.FC<MonoTextProps> = ({ style, children, ...rest }) => (
  <Typography.Text style={{ fontFamily: "var(--mono)", ...style }} {...rest}>
    {children}
  </Typography.Text>
);

export const formatINR = (value: number, maximumFractionDigits = 2): string => {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits,
  }).format(value);
};

export interface CurrencyTextProps extends Omit<MonoTextProps, "children"> {
  value: number;
  maximumFractionDigits?: number;
}

export const CurrencyText: React.FC<CurrencyTextProps> = ({
  value,
  maximumFractionDigits = 2,
  style,
  ...rest
}) => (
  <MonoText style={{ fontVariantNumeric: "tabular-nums", ...style }} {...rest}>
    {formatINR(value, maximumFractionDigits)}
  </MonoText>
);
