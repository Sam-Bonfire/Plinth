import { Button, Card, Form, Input, Typography, message } from "antd";
import React, { useEffect, useState } from "react";

export interface LockScreenProps {
  open: boolean;
  onUnlock: (pin: string) => Promise<void>;
  staffName: string;
  storeName?: string;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  open,
  onUnlock,
  staffName,
  storeName = "Plinth POS",
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [time, setTime] = useState<Date>(new Date());
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) {
    return null;
  }

  const onFinish = async (values: { pin: string }): Promise<void> => {
    setSubmitting(true);
    try {
      await onUnlock(values.pin);
      form.resetFields();
    } catch {
      void message.error("Invalid PIN");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <Typography.Title level={2} style={{ color: "white", marginBottom: 8 }}>
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Typography.Title>
      <Typography.Text style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 18, marginBottom: 32 }}>
        {storeName}
      </Typography.Text>

      <Card title={`Locked: ${staffName}`} style={{ width: 360 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={(v): Promise<void> => onFinish(v as { pin: string })}
        >
          <Form.Item
            label="PIN"
            name="pin"
            rules={[{ required: true, message: "Enter your PIN" }]}
          >
            <Input.Password placeholder="••••" autoComplete="off" autoFocus />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Unlock
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
