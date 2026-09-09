import { Button } from "antd";
import React, { useEffect, useRef, useState } from "react";

export interface KDSBumpButtonProps {
  onBump: () => void;
  disabled?: boolean;
  label?: string;
  doneLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

const DONE_WINDOW_MS = 1200;

export const KDSBumpButton: React.FC<KDSBumpButtonProps> = ({
  onBump,
  disabled = false,
  label = "BUMP",
  doneLabel = "BUMPED ✓",
  className = "",
  style,
}) => {
  const [bumped, setBumped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => (): void => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const handleClick = (): void => {
    if (disabled || bumped) return;
    onBump();
    setBumped(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setBumped(false);
    }, DONE_WINDOW_MS);
  };

  return (
    <Button
      type="primary"
      block
      size="large"
      disabled={disabled}
      onClick={handleClick}
      className={`plinth-kds-bump ${className}`.trim()}
      data-testid="kds-bump-button"
      style={{
        height: 48,
        fontSize: "1.2rem",
        fontWeight: "bold",
        transition: "background-color 0.2s ease",
        ...(bumped ? { backgroundColor: "var(--g)", borderColor: "var(--g)" } : null),
        ...style,
      }}
    >
      {bumped ? doneLabel : label}
    </Button>
  );
};
