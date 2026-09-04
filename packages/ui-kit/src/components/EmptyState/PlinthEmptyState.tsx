import {
  InboxOutlined,
  ShoppingCartOutlined,
  SearchOutlined,
  FileTextOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import { Empty } from "antd";
import React, { ReactNode } from "react";
import { PlinthButton } from "../Button/PlinthButton.js";

export interface PlinthEmptyStateProps {
  preset?: "no-orders" | "empty-cart" | "no-search-results" | "no-kds-tickets" | "offline" | "default";
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export const PlinthEmptyState: React.FC<PlinthEmptyStateProps> = ({
  preset = "default",
  title,
  description,
  actionText,
  onAction,
  icon,
  size = "md",
}) => {
  const getPresetConfig = () => {
    switch (preset) {
      case "no-orders":
        return {
          defaultIcon: <InboxOutlined style={{ fontSize: 48, color: "var(--s3)" }} />,
          defaultTitle: "No Orders",
          defaultDescription: "There are currently no orders to display.",
        };
      case "empty-cart":
        return {
          defaultIcon: <ShoppingCartOutlined style={{ fontSize: 48, color: "var(--s3)" }} />,
          defaultTitle: "Empty Cart",
          defaultDescription: "Add items to the cart to begin.",
        };
      case "no-search-results":
        return {
          defaultIcon: <SearchOutlined style={{ fontSize: 48, color: "var(--s3)" }} />,
          defaultTitle: "No Results Found",
          defaultDescription: "Try adjusting your search or filters.",
        };
      case "no-kds-tickets":
        return {
          defaultIcon: <FileTextOutlined style={{ fontSize: 48, color: "var(--s3)" }} />,
          defaultTitle: "No Active Tickets",
          defaultDescription: "The kitchen is currently caught up.",
        };
      case "offline":
        return {
          defaultIcon: <WifiOutlined style={{ fontSize: 48, color: "var(--s3)" }} />,
          defaultTitle: "You're Offline",
          defaultDescription: "Please check your internet connection.",
        };
      case "default":
      default:
        return {
          defaultIcon: <InboxOutlined style={{ fontSize: 48, color: "var(--s3)" }} />,
          defaultTitle: "No Data",
          defaultDescription: "There is no data to display here.",
        };
    }
  };

  const { defaultIcon, defaultTitle, defaultDescription } = getPresetConfig();

  const finalIcon = icon || defaultIcon;
  const finalTitle = title || defaultTitle;
  const finalDescription = description || defaultDescription;

  const imageStyle =
    size === "sm"
      ? { height: 40 }
      : size === "lg"
      ? { height: 100 }
      : { height: 60 };

  return (
    <div className="plinth-empty-state" style={{ padding: "24px 0", textAlign: "center" }}>
      <Empty
        image={finalIcon}
        styles={{ image: imageStyle }}
        description={
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--s5)" }}>
              {finalTitle}
            </div>
            <div style={{ marginTop: 8, color: "var(--s4)" }}>
              {finalDescription}
            </div>
          </div>
        }
      >
        {actionText && onAction && (
          <PlinthButton onClick={onAction} style={{ marginTop: 16 }} variant="primary">
            {actionText}
          </PlinthButton>
        )}
      </Empty>
    </div>
  );
};
