import { Modal, Input, Button, Form, Alert } from 'antd';
import React, { useState } from 'react';

export interface LoginSubmitData {
  phone: string;
  pin: string;
}

export interface LoginModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (data: LoginSubmitData) => void;
  error?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  open,
  onCancel,
  onSubmit,
  error,
}) => {
  const [form] = Form.useForm<LoginSubmitData>();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      onSubmit(values);
    } catch (e) {
      // validation failed, handled by form
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Login"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={handleOk}
        >
          Login
        </Button>,
      ]}
    >
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          label="Phone Number"
          name="phone"
          rules={[{ required: true, message: 'Please input your phone number!' }]}
        >
          <Input placeholder="Enter your phone number" />
        </Form.Item>
        <Form.Item
          label="PIN"
          name="pin"
          rules={[{ required: true, message: 'Please input your PIN!' }]}
        >
          <Input.Password placeholder="Enter your PIN" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
