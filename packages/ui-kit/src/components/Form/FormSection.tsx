import { Typography, Divider } from "antd";
import React, { ReactNode } from "react";

const { Title, Text } = Typography;

export interface FormSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  hideDivider?: boolean;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  hideDivider = false,
}) => {
  return (
    <div style={{ marginBottom: "24px" }}>
      <Title level={4} style={{ marginBottom: description ? 4 : 16 }}>
        {title}
      </Title>
      {description && (
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          {description}
        </Text>
      )}
      <div>{children}</div>
      {!hideDivider && <Divider style={{ marginTop: 24, marginBottom: 0 }} />}
    </div>
  );
};
