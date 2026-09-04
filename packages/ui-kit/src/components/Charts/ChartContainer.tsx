import { Card, Skeleton, Empty, Typography, Space } from "antd";
import React, { ReactNode } from "react";

const { Title, Text } = Typography;

export interface ChartContainerProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  height?: number | string;
  children?: ReactNode;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  loading = false,
  isEmpty = false,
  height = 300,
  children,
}) => {
  return (
    <Card styles={{ body: { padding: 24, height: typeof height === 'number' ? height + 60 : height } }}>
      <Space direction="vertical" size={24} style={{ width: "100%", height: "100%" }}>
        {(title || subtitle) && (
          <Space direction="vertical" size={4}>
            {title && (
              <Title level={5} style={{ margin: 0 }}>
                {title}
              </Title>
            )}
            {subtitle && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {subtitle}
              </Text>
            )}
          </Space>
        )}

        <div style={{ height: typeof height === 'number' ? height : '100%', width: "100%", position: "relative" }}>
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} title={false} />
          ) : isEmpty ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              data-testid="chart-empty-state"
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No data available"
              />
            </div>
          ) : (
            children
          )}
        </div>
      </Space>
    </Card>
  );
};
