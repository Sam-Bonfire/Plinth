import { Button, Card, Form, Input, Typography, message } from "antd";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTauriIpc } from "../hooks/useTauriIpc.js";
import { usePosSession } from "../providers/PosProviders.js";

export const LoginPage: React.FC = () => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { authenticatePin } = useTauriIpc();
  const { signIn } = usePosSession();
  const navigate = useNavigate();

  const onFinish = async (values: { staffId: string; pin: string }): Promise<void> => {
    setSubmitting(true);
    try {
      const res = await authenticatePin({ pin: values.pin });
      signIn({ staffId: res.staff_id, name: res.name, role: res.role });
      navigate("/showcase", { replace: true });
    } catch {
      void message.error("Invalid staff ID or PIN");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 64 }}>
      <Card title="POS Sign In" style={{ width: 360 }}>
        <Form layout="vertical" onFinish={(v): Promise<void> => onFinish(v as { staffId: string; pin: string })}>
          <Form.Item label="Staff ID" name="staffId" rules={[{ required: true, message: "Enter your staff ID" }]}>
            <Input placeholder="e.g. ST-014" autoComplete="off" />
          </Form.Item>
          <Form.Item label="PIN" name="pin" rules={[{ required: true, message: "Enter your PIN" }]}>
            <Input.Password placeholder="••••" autoComplete="off" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Sign In
            </Button>
          </Form.Item>
          <Typography.Text type="secondary">Contact a manager to reset a forgotten PIN.</Typography.Text>
        </Form>
      </Card>
    </div>
  );
};
