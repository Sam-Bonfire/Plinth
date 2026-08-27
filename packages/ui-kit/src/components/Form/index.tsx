import { Typography, Divider, Row, Col } from "antd";
import React, { ReactNode } from "react";

const { Title, Text } = Typography;

export interface FormSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  divider?: boolean;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  divider = true,
}) => {
  return (
    <div style={{ marginBottom: "24px" }}>
      <Title level={5} style={{ marginBottom: description ? "4px" : "16px" }}>
        {title}
      </Title>
      {description && (
        <Text type="secondary" style={{ display: "block", marginBottom: "16px" }}>
          {description}
        </Text>
      )}
      <div>{children}</div>
      {divider && <Divider style={{ margin: "24px 0 0 0" }} />}
    </div>
  );
};

export interface FormRowProps {
  label: ReactNode;
  children: ReactNode;
  layout?: "2-col" | "3-col";
}

export const FormRow: React.FC<FormRowProps> = ({
  label,
  children,
  layout = "2-col",
}) => {
  const is3Col = layout === "3-col";

  return (
    <Row gutter={[24, 16]} style={{ marginBottom: "16px" }} align="middle">
      <Col xs={24} sm={is3Col ? 8 : 12}>
        <Text strong>{label}</Text>
      </Col>
      <Col xs={24} sm={is3Col ? 16 : 12}>
        {children}
      </Col>
    </Row>
  );
};
