import { Alert } from "antd";
import React, { ReactNode } from "react";

export interface AlertBannerProps {
  type: "info" | "warning" | "error" | "success";
  message: string;
  description?: string;
  action?: ReactNode;
  closable?: boolean;
  onClose?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  message,
  description,
  action,
  closable,
  onClose,
}) => {
  return (
    <Alert
      type={type}
      message={message}
      description={description}
      action={action}
      closable={closable}
      onClose={onClose}
      showIcon
      style={{
        marginBottom: "16px",
        borderRadius: "8px",
      }}
    />
  );
};
