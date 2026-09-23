import { Typography, Flex } from 'antd';
import React from 'react';

const { Title, Paragraph } = Typography;

export const Orders = (): React.JSX.Element => {
  return (
    <Flex vertical align="center" justify="center" style={{ minHeight: '100vh', padding: '16px' }}>
      <Title level={2}>My Orders</Title>
      <Paragraph type="secondary" style={{ textAlign: 'center' }}>
        Live order tracking lands in P-889. Check back later!
      </Paragraph>
    </Flex>
  );
};
