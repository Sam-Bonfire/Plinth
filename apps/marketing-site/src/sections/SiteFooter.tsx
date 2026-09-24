import {
  FacebookOutlined,
  InstagramOutlined,
  TwitterOutlined,
} from '@ant-design/icons';
import { Row, Col, Typography, Space, Divider } from 'antd';
import React from 'react';

const { Title, Text, Link } = Typography;

export interface FooterLink {
  label: string;
  url: string;
}

export interface FooterLinkGroup {
  title: string;
  links: FooterLink[];
}

export interface SiteFooterProps {
  companyName?: string;
  fssaiNumber?: string;
  gstNumber?: string;
  linkGroups?: FooterLinkGroup[];
}

const defaultLinkGroups: FooterLinkGroup[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', url: '/features' },
      { label: 'Pricing', url: '/pricing' },
      { label: 'Integrations', url: '/integrations' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', url: '/about' },
      { label: 'Careers', url: '/careers' },
      { label: 'Contact', url: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', url: '/privacy' },
      { label: 'Terms of Service', url: '/terms' },
    ],
  },
];

export const SiteFooter: React.FC<SiteFooterProps> = ({
  companyName = 'PlinthOS',
  fssaiNumber = '10000000000000',
  gstNumber = '22AAAAA0000A1Z5',
  linkGroups = defaultLinkGroups,
}) => {
  return (
    <footer style={{ padding: '48px 24px', backgroundColor: '#f5f5f5' }}>
      <Row gutter={[32, 32]} justify="space-between">
        <Col xs={24} md={8}>
          <Title level={4}>{companyName}</Title>
          <Space direction="vertical" size="small">
            <Text type="secondary">
              FSSAI: {fssaiNumber}
            </Text>
            <Text type="secondary">
              GST: {gstNumber}
            </Text>
          </Space>
          <div style={{ marginTop: 24 }}>
            <Space size="middle">
              <Link href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                <FacebookOutlined style={{ fontSize: '24px' }} />
              </Link>
              <Link href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                <TwitterOutlined style={{ fontSize: '24px' }} />
              </Link>
              <Link href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                <InstagramOutlined style={{ fontSize: '24px' }} />
              </Link>
            </Space>
          </div>
        </Col>

        <Col xs={24} md={16}>
          <Row gutter={[32, 32]}>
            {linkGroups.map((group, index) => (
              <Col xs={12} sm={8} key={index}>
                <Title level={5}>{group.title}</Title>
                <Space direction="vertical" size="small">
                  {group.links.map((link, linkIndex) => (
                    <Link key={linkIndex} href={link.url}>
                      {link.label}
                    </Link>
                  ))}
                </Space>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>

      <Divider />

      <Row justify="center">
        <Col>
          <Text type="secondary">
            © {new Date().getFullYear()} {companyName}. All rights reserved.
          </Text>
        </Col>
      </Row>
    </footer>
  );
};
