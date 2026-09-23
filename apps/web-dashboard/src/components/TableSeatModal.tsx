import { InputNumber, Modal, Select, Typography } from "antd";
import React, { useEffect, useState } from "react";

export const validateSeating = (partySize: number | null, waiter: string): string[] => {
  const errors: string[] = [];
  if (partySize === null || !(partySize >= 1)) errors.push("Party size must be at least 1.");
  if (waiter.trim() === "") errors.push("Assign a waiter.");
  return errors;
};

interface Props {
  tableLabel: string;
  capacity: number;
  waiters: string[];
  open: boolean;
  onClose: () => void;
  onSave: (partySize: number, waiter: string) => void;
}

export const TableSeatModal: React.FC<Props> = ({ tableLabel, capacity, waiters, open, onClose, onSave }: Props) => {
  const [partySize, setPartySize] = useState<number | null>(null);
  const [waiter, setWaiter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPartySize(null);
      setWaiter("");
      setError(null);
    }
  }, [open ]);

  const save = (): void => {
    const errors = validateSeating(partySize, waiter);
    if (errors.length > 0 || partySize === null) {
      setError(errors[0] ?? "Invalid seating.");
      return;
    }
    onSave(partySize, waiter.trim());
  };

  return (
    <Modal title={`Seat ${tableLabel}`} open={open} onCancel={onClose} onOk={save} okText="Seat Party">
      <Typography.Paragraph type="secondary">
        Capacity {capacity} guests.
      </Typography.Paragraph>
      <InputNumber placeholder="Guest count" value={partySize} min={1} max={capacity} onChange={(v: number | null): void => setPartySize(v)} style={{ width: "100%", marginBottom: 12 }} />
      <Select
        placeholder="Assign waiter"
        value={waiter === "" ? undefined : waiter}
        onChange={(v: string): void => setWaiter(v)}
        options={waiters.map((w: string): { label: string; value: string } => ({ label: w, value: w }))}
        style={{ width: "100%" }}
      />
      {error !== null && (
        <Typography.Text type="danger">{error}</Typography.Text>
      )}
    </Modal>
  );
};
