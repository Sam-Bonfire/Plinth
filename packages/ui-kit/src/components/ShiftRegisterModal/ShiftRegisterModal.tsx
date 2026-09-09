import { Button, Space, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { CurrencyInput } from "../CurrencyInput/CurrencyInput.js";
import { ModalWrapper } from "../Modal/ModalWrapper.js";

export interface ShiftRegisterModalProps {
  open: boolean;
  terminalLabel?: string;
  onClose: () => void;
  onOpenRegister: (openingFloat: number) => void;
  className?: string;
}

export const ShiftRegisterModal: React.FC<ShiftRegisterModalProps> = ({
  open,
  terminalLabel,
  onClose,
  onOpenRegister,
  className = "",
}) => {
  const [float, setFloat] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (open) setFloat(undefined);
  }, [open]);
  const valid = float !== undefined && float >= 0;

  return (
    <ModalWrapper
      open={open}
      title="Open register"
      onClose={onClose}
      footerActions={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            disabled={!valid}
            data-testid="register-open-confirm"
            onClick={(): void => {
              if (valid) {
                onOpenRegister(float);
                onClose();
              }
            }}
          >
            Open shift
          </Button>
        </Space>
      }
    >
      <div className={`plinth-shift-register ${className}`.trim()} data-testid="shift-register-modal">
        {terminalLabel !== undefined && (
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
            {terminalLabel}
          </Typography.Text>
        )}
        <Typography.Text style={{ display: "block", marginBottom: 4 }}>Opening float</Typography.Text>
        <CurrencyInput value={float} onChange={setFloat} placeholder="0.00" />
      </div>
    </ModalWrapper>
  );
};
