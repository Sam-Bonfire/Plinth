import { Typography } from "antd";
import React from "react";

export const PlaceholderPage: React.FC<{ title: string; description?: string }> = ({ title, description }) => {
  return (
    <div>
      <Typography.Title level={3}>{title}</Typography.Title>
      <Typography.Paragraph type="secondary">{description ?? `${title} management coming soon.`}</Typography.Paragraph>
    </div>
  );
};
