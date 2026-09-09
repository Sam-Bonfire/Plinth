import { Alert, Button, Input, Space, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { ModalWrapper } from "../Modal/ModalWrapper.js";

export interface StaffDeactivateModalProps {
  open: boolean;
  staffName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  className?: string;
}

export const StaffDeactivateModal: React.FC<StaffDeactivateModalProps> = ({
  open,
  staffName,
  onClose,
  onConfirm,
  className = "",
}) => {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open, staffName]);
  const trimmed = reason.trim();
  const valid = trimmed.length > 0;

  return (
    <ModalWrapper
      open={open}
      title={`Deactivate ${staffName}`}
      onClose={onClose}
      footerActions={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            danger
            type="primary"
            disabled={!valid}
            data-testid="deactivate-confirm"
            onClick={(): void => {
              if (valid) {
                onConfirm(trimmed);
                onClose();
              }
            }}
          >
            Deactivate
          </Button>
        </Space>
      }
    >
      <div className={`plinth-staff-deactivate ${className}`.trim()} data-testid="staff-deactivate-modal">
        <Alert
          type="warning"
          showIcon
          message="They lose POS and dashboard access immediately. Past orders and audit entries keep their name."
          style={{ marginBottom: 12 }}
        />
        <Typography.Text style={{ display: "block", marginBottom: 4 }}>Reason (goes to the audit log)</Typography.Text>
        <Input.TextArea
          rows={3}
          value={reason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>): void => setReason(e.target.value)}
          placeholder="e.g. Resigned 12 Sep"
          aria-label="Deactivation reason"
          data-testid="deactivate-reason"
        />
      </div>
    </ModalWrapper>
  );
};
