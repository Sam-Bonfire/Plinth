import { Form, Input, Button, Card, Alert, Typography } from "antd";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.js";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const onFinish = async (values: { staffId: string; pin: string }): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      await login(values.staffId, values.pin);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <Card title="PlinthOS Login" style={{ width: 360 }}>
        <Typography.Paragraph type="secondary">Use staff ID + PIN to access dashboard</Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="staffId" label="Staff ID" rules={[{ required: true, message: "Staff ID required" }]}>
            <Input placeholder="staff-001" />
          </Form.Item>
          <Form.Item name="pin" label="PIN" rules={[{ required: true, message: "PIN required" }]}>
            <Input.Password placeholder="••••" maxLength={6} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Login
          </Button>
        </Form>
      </Card>
    </div>
  );
};
