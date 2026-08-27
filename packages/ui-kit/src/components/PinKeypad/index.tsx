import { Typography, Row, Col, Button, theme } from "antd";
import React, { useState, useEffect } from "react";
import { ModalWrapper } from "../Modal/index.js";

const { Text } = Typography;
const { useToken } = theme;

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
  const { token } = useToken();

  useEffect(() => {
    if (!open) {
      setPin("");
    }
  }, [open]);

  useEffect(() => {
    if (pin.length === 4) {
      onSubmit(pin);
      // Optional: reset PIN after submission? We leave that to parent or open change
    }
  }, [pin, onSubmit]);

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + key);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < 4; i++) {
      dots.push(
        <span
          key={i}
          style={{
            display: "inline-block",
            margin: "0 8px",
            fontSize: "24px",
            fontFamily: token.fontFamilyCode,
            color: pin.length > i ? token.colorText : token.colorTextQuaternary,
          }}
        >
          •
        </span>
      );
    }
    return dots;
  };

  const KeyButton = ({
    value,
    onClick,
    span = 8,
  }: {
    value: string;
    onClick: () => void;
    span?: number;
  }) => (
    <Col span={span} style={{ textAlign: "center", padding: "8px" }}>
      <Button
        type="text"
        onClick={onClick}
        style={{
          width: "100%",
          height: "64px", // large touch target >= 56px
          fontSize: "24px",
          fontFamily: token.fontFamilyCode,
          borderRadius: "8px",
          backgroundColor: token.colorFillAlter,
        }}
      >
        {value}
      </Button>
    </Col>
  );

  return (
    <ModalWrapper open={open} title={title} onClose={onCancel} fullscreenMobile>
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        {subtitle && (
          <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
            {subtitle}
          </Text>
        )}
        <div
          style={{
            margin: "24px 0",
            height: "40px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {renderDots()}
        </div>
        {error && (
          <Text type="danger" style={{ display: "block", marginBottom: 16 }}>
            {error}
          </Text>
        )}
        <div style={{ maxWidth: "320px", margin: "0 auto" }}>
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <KeyButton
                key={num}
                value={num.toString()}
                onClick={() => handleKeyPress(num.toString())}
              />
            ))}
            <KeyButton value="Clear" onClick={handleClear} />
            <KeyButton value="0" onClick={() => handleKeyPress("0")} />
            <KeyButton value="⌫" onClick={handleBackspace} />
          </Row>
        </div>
      </div>
    </ModalWrapper>
  );
};
