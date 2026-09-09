import React, { useEffect, useState } from "react";
import { ToastItem, ToastManager } from "../../state/toast.js";
import { AlertBanner } from "../AlertBanner/AlertBanner.js";

export const toastManager = new ToastManager();

export const useToasts = (): ToastItem[] => {
  const [toasts, setToasts] = useState<ToastItem[]>(() => toastManager.getToasts());
  useEffect(() => toastManager.subscribe(setToasts), []);
  return toasts;
};

export interface ToastNotificationsProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ToastNotifications: React.FC<ToastNotificationsProps> = ({ className = "", style }) => {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div
      className={`plinth-toast-stack ${className}`.trim()}
      data-testid="toast-stack"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1050,
        width: 360,
        maxWidth: "calc(100vw - 32px)",
        ...style,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onMouseEnter={(): void => toastManager.pause(toast.id)}
          onMouseLeave={(): void => toastManager.resume(toast.id)}
          onFocus={(): void => toastManager.pause(toast.id)}
          onBlur={(): void => toastManager.resume(toast.id)}
        >
          <AlertBanner
            type={toast.type}
            message={toast.title}
            description={toast.message}
            closable
            onClose={(): void => toastManager.dismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
