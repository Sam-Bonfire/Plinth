import React from 'react';
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { Menu } from './Menu';
import { Orders } from './Orders';

const PortalNav: React.FC = () => {
  const { pathname } = useLocation();
  const linkStyle = (active: boolean): React.CSSProperties => ({
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--font)' : 'inherit',
  });
  return (
    <nav aria-label="Portal">
      <Link to="/" style={linkStyle(pathname === '/')}>
        Menu
      </Link>
      {' · '}
      <Link to="/orders" style={linkStyle(pathname === '/orders')}>
        My Orders
      </Link>
    </nav>
  );
};

export const App = (): React.JSX.Element => {
  return (
    <HashRouter>
      <a
        href="#portal-main"
        style={{ position: 'absolute', left: -9999, top: 0, zIndex: 1001, background: '#fff', padding: 8 }}
        onFocus={(e): void => {
          e.currentTarget.style.left = '8px';
        }}
        onBlur={(e): void => {
          e.currentTarget.style.left = '-9999px';
        }}
      >
        Skip to content
      </a>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--b1)',
        }}
      >
        <Link to="/" aria-label="Portal home" style={{ fontWeight: 700 }}>
          PlinthOS
        </Link>
        <PortalNav />
      </header>
      <main id="portal-main">
        <Routes>
          <Route path="/" element={<Menu />} />
          <Route path="/orders" element={<Orders />} />
        </Routes>
      </main>
    </HashRouter>
  );
};
