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
      {session && (
        <Space style={{ position: "fixed", top: 16, right: 16, zIndex: 1000 }}>
          <TerminalNav />
          <Button
            type="default"
            icon={soundEnabled ? <SoundOutlined /> : <AudioMutedOutlined />}
            onClick={toggleSound}
          />
          <Button
            type="default"
            icon={<LockOutlined />}
            onClick={(): void => setLocked(true)}
          >
            Lock
          </Button>
        </Space>
      )}
      <LockScreen
        open={locked}
        onUnlock={handleUnlock}
        staffName={session?.name ?? ""}
      />
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
