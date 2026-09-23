import { Input, Modal, Typography } from "antd";
import React, { useState, useEffect } from "react";

export interface RiderPickupModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (otp: string) => void;
  orderId: string;
  platform: "Swiggy" | "Zomato";
}

export const RiderPickupModal: React.FC<RiderPickupModalProps> = ({ open, onClose, onConfirm, orderId, platform }) => {
  const [otp, setOtp] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setOtp("");
      setError("");
    }
  }, [open]);

  const handleConfirm = (): void => {
    const trimmed = otp.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
      setError("OTP must be a 4 to 6 digit number.");
      return;
    }
    setError("");
    onConfirm(trimmed);
  };

  const handleCancel = (): void => {
    setOtp("");
    setError("");
    onClose();
  };

  return (
    <Modal title={`${platform} Pickup Verification`} open={open} onCancel={handleCancel} onOk={handleConfirm} okText="Confirm" cancelText="Cancel">
      <Typography.Paragraph>
        Please enter the OTP for order <Typography.Text strong>{orderId}</Typography.Text>.
      </Typography.Paragraph>
      <Input
        placeholder="Enter 4-6 digit OTP"
        value={otp}
        onChange={(e): void => {
          setOtp(e.target.value);
          if (error !== "") {
            setError("");
          }
        }}
        maxLength={6}
      />
      {error !== "" && (
        <Typography.Text type="danger" style={{ display: "block", marginTop: 8 }}>
          {error}
        </Typography.Text>
      )}
    </Modal>
  );
};
