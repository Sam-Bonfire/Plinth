import { Button, InputNumber, Space, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { ModalWrapper } from "../Modal/ModalWrapper.js";
import { formatINR } from "../Typography/index.js";

export interface SplitBillModalProps {
  open: boolean;
  totalMinor: number;
  onClose: () => void;
  onConfirm: (splitsMinor: number[]) => void;
  className?: string;
}

/// Splits an integer-minor total into `parts` shares that sum exactly:
/// every share is floored and the leftover paise go to the first shares.
export const splitEvenly = (totalMinor: number, parts: number): number[] => {
  if (!Number.isFinite(totalMinor) || !Number.isFinite(parts)) return [];
  const safeParts = Math.max(1, Math.floor(parts));
  const base = Math.floor(totalMinor / safeParts);
  const remainder = ((totalMinor % safeParts) + safeParts) % safeParts;
  return Array.from({ length: safeParts }, (_, i) => base + (i < remainder ? 1 : 0));
};

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  open,
  totalMinor,
  onClose,
  onConfirm,
  className = "",
}) => {
  const [parts, setParts] = useState<number>(2);
  useEffect(() => {
    if (open) setParts(2);
  }, [open ]);
  const splits = splitEvenly(totalMinor, parts);
  const bumpedCount =
    splits.length === 0 ? 0 : ((totalMinor % splits.length) + splits.length) % splits.length;
  const format = (minor: number): string => formatINR(minor / 100);

  return (
    <ModalWrapper
      open={open}
      title="Split bill"
      onClose={onClose}
      footerActions={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            data-testid="split-confirm"
            onClick={(): void => {
              onConfirm(splits);
              onClose();
            }}
          >
            Confirm split
          </Button>
        </Space>
      }
    >
      <div className={`plinth-split-bill ${className}`.trim()} data-testid="split-bill-modal">
        <Space style={{ marginBottom: 16 }}>
          <Typography.Text>Split between</Typography.Text>
          <InputNumber
            min={2}
            max={12}
            value={parts}
            onChange={(value: number | string | null): void => {
              const n = Number(value ?? 2);
              setParts(Number.isFinite(n) ? Math.min(12, Math.max(2, Math.floor(n))) : 2);
            }}
            aria-label="Number of parts"
            data-testid="split-parts"
          />
          <Typography.Text>people</Typography.Text>
        </Space>
        {splits.map((share, i) => (
          <div
            key={i}
            style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}
            data-testid={`split-share-${i}`}
          >
            <Typography.Text>
              Part {i + 1}
              {i < bumpedCount ? " (rounds up)" : ""}
            </Typography.Text>
            <Typography.Text strong style={{ fontFamily: "var(--mono)" }}>
              {format(share)}
            </Typography.Text>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid var(--b1)",
            marginTop: 8,
            paddingTop: 8,
          }}
        >
          <Typography.Text strong>Total</Typography.Text>
          <Typography.Text strong style={{ fontFamily: "var(--mono)" }}>
            {format(totalMinor)}
          </Typography.Text>
        </div>
      </div>
    </ModalWrapper>
  );
};
