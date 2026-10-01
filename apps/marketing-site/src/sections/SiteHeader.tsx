import { MenuOutlined } from '@ant-design/icons';
import { Layout, Menu, Button, Drawer } from 'antd';
import React, { useState } from 'react';

const { Header } = Layout;

export interface SiteHeaderProps {
  links: Array<{ label: string; href: string }>;
  ctaLabel: string;
  onCtaClick: () => void;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({ links, ctaLabel, onCtaClick }) => {
  const [drawerVisible, setDrawerVisible] = useState(false);

  const menuItems = links.map(link => ({
    key: link.href,
    label: <a href={link.href}>{link.label}</a>,
  }));

  return (
    <>
      <style>{`
        .site-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          padding: 0 24px;
        }
        .site-header-logo {
          font-size: 20px;
          font-weight: bold;
          white-space: nowrap;
        }
        .site-header-desktop-menu {
          flex: 1;
          justify-content: center;
          border-bottom: none;
        }
        .site-header-mobile-toggle {
          display: none;
        }
        .site-header-cta {
          display: block;
        }
        @media (max-width: 768px) {
          .site-header-desktop-menu {
            display: none;
          }
          .site-header-cta {
            display: none;
          }
          .site-header-mobile-toggle {
            display: block;
          }
        }
      `}</style>

      <Header id="top" className="site-header">
        <a href="#top" className="site-header-logo" aria-label="PlinthOS home" style={{ color: "inherit", textDecoration: "none" }}>
          PlinthOS
        </a>

        <Menu
          className="site-header-desktop-menu"
          mode="horizontal"
          items={menuItems}
          aria-label="Site"
        />

        <div className="site-header-cta">
          <Button type="primary" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        </div>

        <Button
          className="site-header-mobile-toggle"
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setDrawerVisible(true)}
          aria-label="Open mobile menu"
        />
      </Header>

      <Drawer
        title="Menu"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        <Menu
          mode="inline"
          items={menuItems}
          aria-label="Site mobile"
          style={{ borderRight: 'none', marginBottom: 24 }}
        />
        <Button type="primary" block onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      </Drawer>
    </>
  );
};
