import { Alert, Button, Form, Input, InputNumber, Result } from 'antd';
import { useState } from 'react';

export interface LeadFormValues {
  name?: string;
  phone?: string;
  outletCount?: number;
  city?: string;
}

export const validateLead = (values: LeadFormValues): string[] => {
  const errors: string[] = [];

  if (!values.name || values.name.trim() === '') {
    errors.push('Name is required');
  }

  if (!values.phone || values.phone.trim() === '') {
    errors.push('Phone is required');
  } else {
    const digits = values.phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      errors.push('Phone must contain 7-15 digits');
    }
  }

  if (values.outletCount === undefined || values.outletCount === null) {
    errors.push('Outlet count is required');
  }

  if (!values.city || values.city.trim() === '') {
    errors.push('City is required');
  }

  return errors;
};

export interface LeadFormProps {
  onSubmit: (values: LeadFormValues) => void | Promise<void>;
}

export const LeadForm = ({ onSubmit }: LeadFormProps): JSX.Element => {
  const [errors, setErrors] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleFinish = async (values: LeadFormValues): Promise<void> => {
    const validationErrors = validateLead(values);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    await onSubmit(values);
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <Result
        status="success"
        title="Request Submitted"
        subTitle="Thank you for your interest! We will contact you soon."
      />
    );
  }

  return (
    <Form layout="vertical" onFinish={handleFinish}>
      {errors.length > 0 && (
        <Alert
          type="error"
          message="Please fix the following errors:"
          description={
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              {errors.map((err, index) => (
                <li key={index}>{err}</li>
              ))}
            </ul>
          }
          style={{ marginBottom: '16px' }}
        />
      )}
      <Form.Item label="Name" name="name">
        <Input />
      </Form.Item>
      <Form.Item label="Phone" name="phone">
        <Input />
      </Form.Item>
      <Form.Item label="Outlet Count" name="outletCount">
        <InputNumber style={{ width: '100%' }} min={1} />
      </Form.Item>
      <Form.Item label="City" name="city">
        <Input />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Request Free Trial
        </Button>
      </Form.Item>
    </Form>
  );
};
