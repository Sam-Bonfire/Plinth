import { Button, Space, Spin, Typography } from "antd";
import React from "react";
import { ModalWrapper } from "../Modal/ModalWrapper.js";
import { formatINR } from "../Typography/index.js";

export interface CardPaymentOverlayProps {
  open: boolean;
  amountMinor: number;
  onCancel: () => void;
  className?: string;
}

export const CardPaymentOverlay: React.FC<CardPaymentOverlayProps> = ({
  open,
  amountMinor,
  onCancel,
  className = "",
}) => (
  <ModalWrapper
    open={open}
    title="Card payment"
    onClose={onCancel}
    footerActions={
      <Button danger data-testid="card-payment-cancel" onClick={onCancel}>
        Cancel payment
      </Button>
    }
  >
    <div
      className={`plinth-card-payment ${className}`.trim()}
      data-testid="card-payment-overlay"
      style={{ textAlign: "center", padding: "16px 0" }}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Spin size="large" aria-label="Waiting for card machine" />
        <Typography.Title level={3} style={{ margin: 0, fontFamily: "var(--mono)" }}>
          {formatINR(amountMinor / 100)}
        </Typography.Title>
        <Typography.Text type="secondary">Ask the customer to tap, insert, or swipe on the machine…</Typography.Text>
      </Space>
    </div>
  </ModalWrapper>
);
