import { Avatar, Badge } from "antd";
import type { AvatarProps } from "antd";
import React, { useState } from "react";

export interface PlinthAvatarProps extends Omit<AvatarProps, "children" | "size"> {
  /**
   * The name of the user/staff.
   * Used to generate initials if src is not provided, and to generate a deterministic background color.
   */
  name: string;
  /**
   * Status indicator. If provided, the avatar is wrapped in a Badge with the corresponding status dot color.
   */
  status?: "online" | "offline" | "busy" | "away";
  /**
   * Size of the avatar. Can be a predefined string or a number.
   */
  size?: "xs" | "sm" | "md" | "lg" | number;
}

// Map custom string sizes to numbers for antd's Avatar
const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
};

// Deterministic color palette using token variables
const COLORS = [
  "var(--acc)", // Dark / Default
  "var(--bl)",  // Blue
  "var(--p)",   // Purple
  "var(--o)",   // Orange
  "var(--y)",   // Yellow
  "var(--g)",   // Green
  "var(--r)",   // Red
];

const getDeterministicColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

const getInitials = (name: string): string => {
  if (!name || name.trim().length === 0) return "";

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const getStatusColor = (status: "online" | "offline" | "busy" | "away"): string => {
  switch (status) {
    case "online":
      return "var(--g)"; // Green
    case "offline":
      return "var(--b1)"; // Gray
    case "busy":
      return "var(--r)"; // Red
    case "away":
      return "var(--y)"; // Yellow
    default:
      return "var(--b1)";
  }
};

export const PlinthAvatar: React.FC<PlinthAvatarProps> = ({
  name,
  status,
  size = "md",
  src,
  style,
  onError,
  ...rest
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  const numericSize = typeof size === "string" ? sizeMap[size] : size;
  const initials = getInitials(name);
  const bgColor = getDeterministicColor(name);

  const showInitials = !src || imageFailed;

  const handleOnError = () => {
    setImageFailed(true);
    if (onError) {
      return onError();
    }
    return false; // return false to prevent default antd fallback
  };

  const avatar = (
    <Avatar
      size={numericSize}
      src={imageFailed ? undefined : src}
      onError={handleOnError}
      style={{
        backgroundColor: showInitials ? bgColor : undefined,
        color: showInitials ? "var(--s1)" : undefined,
        fontWeight: 600,
        fontFamily: "var(--font)",
        ...style,
      }}
      {...rest}
    >
      {showInitials ? initials : undefined}
    </Avatar>
  );

  if (status) {
    return (
      <Badge
        dot
        offset={[-4, 4]} // Adjust dot position slightly
        style={{
          backgroundColor: getStatusColor(status),
          width: 10,
          height: 10,
          boxShadow: "0 0 0 2px var(--bg)", // Ring to make it pop against background
        }}
        data-testid={`status-badge-${status}`}
      >
        {avatar}
      </Badge>
    );
  }

  return avatar;
};
