import { Alert, Button, InputNumber, Modal, Space, Typography, message } from "antd";
import { QRCodeSVG } from "qrcode.react";
import React, { useMemo, useState } from "react";

export function buildUpiUri(pa: string, pn: string, am: number, tn?: string): string {
  if (am <= 0) {
    return "";
  }

  const params = new URLSearchParams();
  params.set("pa", pa);
  params.set("pn", pn);
  params.set("am", am.toFixed(2));
  params.set("cu", "INR");
  if (tn !== undefined && tn.trim() !== "") {
    params.set("tn", tn.trim());
  }

  return `upi://pay?${params.toString()}`;
}

export interface UpiQrModalProps {
  open: boolean;
  onClose: () => void;
  pa: string;
  pn: string;
}

export const UpiQrModal: React.FC<UpiQrModalProps> = ({ open, onClose, pa, pn }: UpiQrModalProps) => {
  const [amount, setAmount] = useState<number>(0);

  const uri = useMemo((): string => buildUpiUri(pa, pn, amount), [pa, pn, amount]);
  const isValid = amount > 0;

  const copyUri = async (): Promise<void> => {
    if (!isValid) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(uri);
        void message.success("UPI URI copied to clipboard");
      }
    } catch {
      void message.error("Failed to copy URI");
    }
  };

  const close = (): void => {
    setAmount(0);
    onClose();
  };

  return (
    <Modal
      title="Generate UPI QR"
      open={open}
      onCancel={close}
      footer={[
        <Button key="close" onClick={close}>
          Close
        </Button>,
        <Button key="copy" type="primary" onClick={copyUri} disabled={!isValid}>
          Copy URI
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: "100%", alignItems: "center" }} size="large">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Text type="secondary">Payee: {pn}</Typography.Text>
          <Space>
            <InputNumber
              min={0}
              value={amount}
              onChange={(v: number | null): void => setAmount(v ?? 0)}
              prefix="₹"
              style={{ width: "100%" }}
            />
            <Typography.Text>Amount</Typography.Text>
          </Space>
        </Space>

        {isValid ? (
          <div style={{ padding: 16, background: "white", borderRadius: 8, border: "1px solid #f0f0f0" }}>
            <QRCodeSVG value={uri} size={200} level="M" />
          </div>
        ) : (
          <Alert message="Please enter a valid amount greater than 0 to generate the QR code." type="warning" showIcon style={{ width: "100%" }} />
        )}

        {isValid && (
          <Typography.Text strong style={{ fontSize: 18, fontFamily: "var(--mono)" }}>
            ₹{amount.toFixed(2)}
          </Typography.Text>
        )}
      </Space>
    </Modal>
  );
};
