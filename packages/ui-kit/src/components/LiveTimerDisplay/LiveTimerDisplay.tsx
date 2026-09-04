import { theme } from "antd";
import React, { useEffect, useState, useMemo } from "react";
import type { CSSProperties } from "react";

export interface LiveTimerDisplayProps {
  startTime: Date | string | number;
  warningThresholdMinutes?: number;
  criticalThresholdMinutes?: number;
  format?: "mm:ss" | "hh:mm:ss" | "auto";
  isPaused?: boolean;
  showIcon?: boolean;
  className?: string;
}

const StopwatchIcon = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="plinth-live-timer-icon"
    aria-hidden="true"
  >
    <circle cx="12" cy="13" r="8"></circle>
    <path d="M12 9v4l2 2"></path>
    <path d="M10 2h4"></path>
  </svg>
);

export const LiveTimerDisplay: React.FC<LiveTimerDisplayProps> = ({
  startTime,
  warningThresholdMinutes = 10,
  criticalThresholdMinutes = 15,
  format = "auto",
  isPaused = false,
  showIcon = false,
  className = "",
}) => {
  const { token } = theme.useToken();
  const [now, setNow] = useState(Date.now());

  const startMs = useMemo(() => {
    const d = new Date(startTime);
    return isNaN(d.getTime()) ? null : d.getTime();
  }, [startTime]);

  useEffect(() => {
    if (isPaused || startMs === null) {
      return;
    }

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPaused, startMs]);

  const elapsedMs = useMemo(() => {
    if (startMs === null) return 0;
    return Math.max(0, now - startMs);
  }, [startMs, now]);

  const { hours, minutes, seconds, totalMinutes } = useMemo(() => {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      seconds: totalSeconds % 60,
      totalMinutes,
    };
  }, [elapsedMs]);

  const formattedTime = useMemo(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const h = pad(hours);
    const m = pad(format === "mm:ss" ? totalMinutes : minutes);
    const s = pad(seconds);

    if (format === "hh:mm:ss") {
      return `${h}:${m}:${s}`;
    }
    if (format === "mm:ss") {
      return `${m}:${s}`;
    }
    // auto
    if (hours > 0) {
      return `${h}:${m}:${s}`;
    }
    return `${m}:${s}`;
  }, [hours, minutes, seconds, totalMinutes, format]);

  const severityClass = useMemo(() => {
    if (startMs === null) return "plinth-live-timer-normal";
    if (totalMinutes >= criticalThresholdMinutes) {
      return "plinth-live-timer-critical";
    }
    if (totalMinutes >= warningThresholdMinutes) {
      return "plinth-live-timer-warning";
    }
    return "plinth-live-timer-normal";
  }, [totalMinutes, warningThresholdMinutes, criticalThresholdMinutes, startMs]);

  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontFamily: token.fontFamilyCode,
    fontWeight: 500,
    padding: "4px 8px",
    borderRadius: token.borderRadius,
    transition: "all 0.3s ease",
    lineHeight: 1,
  };

  const severityStyles: Record<string, CSSProperties> = {
    "plinth-live-timer-normal": {
      backgroundColor: "var(--s2)",
      color: token.colorPrimary,
      border: `1px solid ${token.colorBorder}`,
    },
    "plinth-live-timer-warning": {
      backgroundColor: "var(--y)",
      color: "var(--s1)",
      border: "1px solid var(--y)",
    },
    "plinth-live-timer-critical": {
      backgroundColor: "var(--r)",
      color: "var(--s1)",
      border: "1px solid var(--r)",
      animation: "plinth-timer-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    },
  };

  return (
    <time
      className={`plinth-live-timer ${severityClass} ${className}`.trim()}
      dateTime={`PT${hours}H${minutes}M${seconds}S`}
      aria-live="polite"
      style={{ ...baseStyle, ...severityStyles[severityClass] }}
    >
      {showIcon && <StopwatchIcon />}
      <span className="plinth-live-timer-text">{formattedTime}</span>
    </time>
  );
};
