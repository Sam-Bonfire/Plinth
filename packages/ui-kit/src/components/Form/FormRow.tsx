import { Row, Col } from "antd";
import React, { ReactNode } from "react";

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
  const labelColSpan = is3Col ? 8 : 12;
  const childColSpan = is3Col ? 16 : 12;

  return (
    <Row gutter={24} style={{ marginBottom: "16px" }} align="middle">
      <Col xs={24} sm={labelColSpan}>
        <div style={{ fontWeight: 500 }}>{label}</div>
      </Col>
      <Col xs={24} sm={childColSpan}>
        {children}
      </Col>
    </Row>
  );
};
