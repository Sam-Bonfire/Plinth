import React from "react";

export interface VegNonVegDotProps {
  isVeg: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const VegNonVegDot: React.FC<VegNonVegDotProps> = ({
  isVeg,
  size = 16,
  className = "",
  style,
}) => {
  const color = isVeg ? "var(--g)" : "var(--r)";
  return (
    <span
      role="img"
      aria-label={isVeg ? "Vegetarian mark" : "Non-vegetarian mark"}
      data-testid={isVeg ? "veg-dot" : "nonveg-dot"}
      className={`plinth-diet-dot ${className}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderRadius: 3,
        backgroundColor: "var(--s1)",
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "60%",
          height: "60%",
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
    </span>
  );
};
