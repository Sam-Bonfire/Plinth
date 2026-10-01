import { LockOutlined, SoundOutlined, AudioMutedOutlined } from "@ant-design/icons";
import { App, Button, Space } from "antd";
import React from "react";
import { useState } from "react";
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTauriIpc } from "./hooks/useTauriIpc.js";
import { useSoundEnabled } from "./lib/sounds.js";
import { CheckoutPage } from "./pages/CheckoutPage.js";
import { LockScreen } from "./pages/LockScreen.js";
import { LoginPage } from "./pages/LoginPage.js";
import { PosProviders, usePosSession } from "./providers/PosProviders.js";
import { ShowcaseView } from "./showcase/ShowcaseView.js";

function RequireSession({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const { session } = usePosSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

const TerminalNav: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <Space>
      <Link to="/checkout">
        <Button type={pathname === "/checkout" ? "primary" : "default"} size="small">
          Checkout
        </Button>
      </Link>
      <Link to="/showcase">
        <Button type={pathname === "/showcase" ? "primary" : "default"} size="small">
          Demo
        </Button>
      </Link>
    </Space>
  );
};

export const PosRouter: React.FC = () => {
  const { session } = usePosSession();
  const { authenticatePin } = useTauriIpc();
  const [locked, setLocked] = useState<boolean>(false);
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled();

  const handleUnlock = async (pin: string): Promise<void> => {
    if (!session) return;
    const res = await authenticatePin({ pin });
    if (res.staff_id !== session.staffId) {
      throw new Error("Invalid staff ID");
    }
    setLocked(false);
  };

  return (
    <App>
    <HashRouter>
      <a
        href="#pos-main"
        style={{ position: "absolute", left: -9999, top: 0, zIndex: 1001, background: "var(--s1)", padding: 8 }}
        onFocus={(e): void => {
          e.currentTarget.style.left = "8px";
        }}
        onBlur={(e): void => {
          e.currentTarget.style.left = "-9999px";
        }}
      >
        Skip to content
      </a>
      {session && (
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "8px 16px",
            borderBottom: "1px solid var(--b1)",
          }}
        >
          <Link to="/checkout" aria-label="PlinthOS POS home" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
            PlinthOS POS
          </Link>
          <nav aria-label="Terminal">
            <TerminalNav />
          </nav>
          <Space>
            <span aria-live="polite" style={{ fontSize: 12 }}>
              {session.name}
            </span>
            <Button
              type="default"
              icon={soundEnabled ? <SoundOutlined /> : <AudioMutedOutlined />}
              onClick={toggleSound}
              aria-label={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            />
            <Button
              type="default"
              icon={<LockOutlined />}
              onClick={(): void => setLocked(true)}
              aria-label="Lock terminal"
            >
              Lock
            </Button>
          </Space>
        </header>
      )}
      <LockScreen
        open={locked}
        onUnlock={handleUnlock}
        staffName={session?.name ?? ""}
      />
      <main id="pos-main">
      <Routes>
        <Route path="/" element={<Navigate to="/checkout" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/checkout"
          element={
            <RequireSession>
              <CheckoutPage />
            </RequireSession>
          }
        />
        <Route
          path="/showcase"
          element={
            <RequireSession>
              <ShowcaseView scene="active-order" />
            </RequireSession>
          }
        />
        <Route path="*" element={<Navigate to="/checkout" replace />} />
      </Routes>
      </main>
    </HashRouter>
    </App>
  );
};

export const PosApp: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  return (
    <PosProviders isDark={isDark}>
      <PosRouter />
    </PosProviders>
  );
};
