import React from "react";

export interface InventoryStockBarProps {
  current: number;
  max: number;
  lowThreshold?: number;
  unit?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export const InventoryStockBar: React.FC<InventoryStockBarProps> = ({
  current,
  max,
  lowThreshold,
  unit,
  showLabel = false,
  size = "md",
}) => {
  const percentage = Math.max(0, Math.min(100, (max > 0 ? (current / max) * 100 : 0)));

  // Determine color palette based on thresholds
  // Default logic if no lowThreshold is provided:
  // <= 0: critical (rose)
  // <= lowThreshold (or <= max * 0.2): warning (amber)
  // else: healthy (emerald)
  const actualLowThreshold = lowThreshold !== undefined ? lowThreshold : max * 0.2;

  let color = "var(--g)"; // healthy emerald
  if (current <= 0) {
    color = "var(--r)"; // critical rose
  } else if (current <= actualLowThreshold) {
    color = "var(--y)"; // warning amber
  }

  const heightMap = {
    sm: "4px",
    md: "8px",
    lg: "12px",
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        style={{
          width: "100%",
          height: heightMap[size],
          backgroundColor: "var(--b1)", // background dim
          borderRadius: "9999px",
          overflow: "hidden",
        }}
      >
        <div
          data-testid="stock-bar-fill"
          style={{
            height: "100%",
            width: `${percentage}%`,
            backgroundColor: color,
            transition: "width 0.3s ease-in-out, background-color 0.3s ease-in-out",
            borderRadius: "9999px",
          }}
        />
      </div>

      {showLabel && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "var(--acc)", // text color
            fontFamily: "var(--font)",
          }}
        >
          <span style={{ fontFamily: "var(--mono)", fontWeight: 500 }}>
            {current} / {max} {unit && <span style={{ fontFamily: "var(--font)", fontWeight: "normal" }}>{unit}</span>}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 500 }}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
};
