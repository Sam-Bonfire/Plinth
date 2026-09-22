import { AlertBanner } from "@plinth/ui-kit";
import { Card, Typography } from "antd";
import React from "react";

export type FraudAlertKind = "warning" | "error";

export interface FraudAlert {
  id: string;
  kind: FraudAlertKind;
  message: string;
  description: string;
}

interface FraudAlertsProps {
  alerts: FraudAlert[];
}

export const FraudAlerts: React.FC<FraudAlertsProps> = ({ alerts }: FraudAlertsProps) => {
  const errors = alerts.filter((a) => a.kind === "error").length;
  return (
    <Card
      title="Fraud Alerts"
      extra={
        errors > 0 ? (
          <Typography.Text type="danger">
            {errors} critical
          </Typography.Text>
        ) : null
      }
    >
      {alerts.length === 0 ? (
        <Typography.Text type="secondary">No open alerts.</Typography.Text>
      ) : (
        alerts.map((a) => (
          <AlertBanner key={a.id} type={a.kind} message={a.message} description={a.description} />
        ))
      )}
    </Card>
  );
};
