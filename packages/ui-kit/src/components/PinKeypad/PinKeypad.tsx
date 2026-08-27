import { Button, Typography, Space } from "antd";
import React, { useState, useEffect } from "react";
import { ModalWrapper } from "../Modal/ModalWrapper.js";

const { Text } = Typography;

export interface PinKeypadProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  error?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}

export const PinKeypad: React.FC<PinKeypadProps> = ({
  open,
  title = "Enter PIN",
  subtitle,
  error,
  onSubmit,
  onCancel,
}) => {
  const [pin, setPin] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setPin("");
    }
  }, [open]);

  useEffect(() => {
    if (pin.length === 4) {
      onSubmit(pin);
      setPin("");
    }
  }, [pin, onSubmit]);

  const handleDigitClick = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  const renderPinIndicator = () => {
    const dots = [];
    for (let i = 0; i < 4; i++) {
      dots.push(
        <span
          key={i}
          style={{
            fontSize: "2rem",
            color: i < pin.length ? "var(--acc, #1890ff)" : "var(--b1, #d9d9d9)",
            fontFamily: "var(--mono)",
          }}
        >
          {i < pin.length ? "•" : "•"}
        </span>
      );
    }
    return (
      <Space size="large" style={{ marginBottom: "1rem", marginTop: "1rem" }}>
        {dots}
      </Space>
    );
  };

  const padStyles: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "1rem",
    marginTop: "2rem",
  };

  const btnStyles: React.CSSProperties = {
    height: "64px",
    fontSize: "1.5rem",
    borderRadius: "12px",
  };

  const numpadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <ModalWrapper open={open} title={title} onClose={onCancel} fullscreenMobile>
      <div style={{ textAlign: "center", padding: "1rem" }}>
        {subtitle && <Text type="secondary">{subtitle}</Text>}
        <div>{renderPinIndicator()}</div>
        {error && <Text type="danger" style={{ color: "red" }}>{error}</Text>}

        <div style={padStyles}>
          {numpadButtons.map((digit) => (
            <Button
              key={digit}
              style={btnStyles}
              onClick={() => handleDigitClick(digit)}
            >
              {digit}
            </Button>
          ))}
          <Button style={btnStyles} onClick={handleClear}>
            Clear
          </Button>
          <Button style={btnStyles} onClick={() => handleDigitClick("0")}>
            0
          </Button>
          <Button style={btnStyles} onClick={handleBackspace}>
            ⌫
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
};
