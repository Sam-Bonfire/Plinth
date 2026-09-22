import { Input, InputNumber, Modal, Select, Space, Typography } from "antd";
import React, { useState } from "react";

export type CashDropReason = "Safe Drop" | "Petty Cash" | "Bank Deposit" | "Other";

export interface CashDrop {
  amount: number;
  reason: CashDropReason;
  note: string;
}

interface CashDropModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (drop: CashDrop) => void;
}

const REASONS: CashDropReason[] = ["Safe Drop", "Petty Cash", "Bank Deposit", "Other"];

export const CashDropModal: React.FC<CashDropModalProps> = ({ open, onClose, onSubmit }: CashDropModalProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState<CashDropReason | null>(null);
  const [note, setNote] = useState<string>("");

  const valid = amount > 0 && reason !== null;

  const submit = (): void => {
    if (!valid || reason === null) {
      return;
    }
    onSubmit({ amount, reason, note: note.trim() });
    setAmount(0);
    setReason(null);
    setNote("");
  };

  const close = (): void => {
    setAmount(0);
    setReason(null);
    setNote("");
    onClose();
  };

  return (
    <Modal title="Cash Drop" open={open} onOk={submit} onCancel={close} okText="Record Drop" okButtonProps={{ disabled: !valid }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <InputNumber min={1} value={amount} onChange={(v: number | null): void => setAmount(v ?? 0)} prefix="₹" />
          <Typography.Text>drop amount</Typography.Text>
        </Space>
        <Select
          value={reason}
          onChange={(v): void => setReason(v as CashDropReason)}
          options={REASONS.map((r) => ({ label: r, value: r }))}
          style={{ width: "100%" }}
          placeholder="Select a reason"
        />
        <Input.TextArea
          aria-label="Drop note"
          rows={2}
          value={note}
          onChange={(e): void => setNote(e.target.value)}
          placeholder="e.g. Excess over float limit…"
        />
      </Space>
    </Modal>
  );
};
