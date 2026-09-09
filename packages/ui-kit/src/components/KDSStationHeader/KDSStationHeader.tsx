import { Tag, Typography } from "antd";
import React from "react";

export interface KDSStationHeaderProps {
  station: string;
  openCount: number;
  lateCount?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const KDSStationHeader: React.FC<KDSStationHeaderProps> = ({
  station,
  openCount,
  lateCount = 0,
  className = "",
  style,
}) => (
  <div
    className={`plinth-kds-station-header ${className}`.trim()}
    data-testid="kds-station-header"
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      ...style,
    }}
  >
    <Typography.Title level={5} style={{ margin: 0 }}>
      {station}{" "}
      <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
        · {openCount} open
      </Typography.Text>
    </Typography.Title>
    {lateCount > 0 ? (
      <Tag color="error" data-testid="kds-station-late">
        {lateCount} late
      </Tag>
    ) : null}
  </div>
);
