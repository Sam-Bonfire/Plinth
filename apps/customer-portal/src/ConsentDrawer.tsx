import { Drawer, Switch, Button, Space, Typography, Flex } from 'antd';
import React, { useState } from 'react';

const { Text, Paragraph } = Typography;

export interface ConsentChoices {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
}

export interface ConsentDrawerProps {
  open: boolean;
  onConsent: (choices: ConsentChoices) => void;
}

export const ConsentDrawer: React.FC<ConsentDrawerProps> = ({
  open,
  onConsent,
}) => {
  const [choices, setChoices] = useState<ConsentChoices>({
    sms: false,
    email: false,
    whatsapp: false,
  });

  const handleToggle = (key: keyof ConsentChoices, checked: boolean) => {
    setChoices((prev) => ({ ...prev, [key]: checked }));
  };

  const handleAccept = () => {
    onConsent(choices);
  };

  const handleDecline = () => {
    onConsent({ sms: false, email: false, whatsapp: false });
  };

  return (
    <Drawer
      title="Marketing Consent"
      placement="bottom"
      closable={false}
      open={open}
      height="auto"
      maskClosable={false}
      footer={
        <Flex justify="flex-end" gap="small" style={{ padding: '8px 16px' }}>
          <Button onClick={handleDecline}>Decline All</Button>
          <Button type="primary" onClick={handleAccept}>
            Accept
          </Button>
        </Flex>
      }
    >
      <Paragraph>
        We would like to send you exclusive offers, news, and updates. Please
        select your preferred communication channels:
      </Paragraph>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Flex justify="space-between" align="center">
          <Text>SMS</Text>
          <Switch
            checked={choices.sms}
            onChange={(checked) => handleToggle('sms', checked)}
          />
        </Flex>
        <Flex justify="space-between" align="center">
          <Text>Email</Text>
          <Switch
            checked={choices.email}
            onChange={(checked) => handleToggle('email', checked)}
          />
        </Flex>
        <Flex justify="space-between" align="center">
          <Text>WhatsApp</Text>
          <Switch
            checked={choices.whatsapp}
            onChange={(checked) => handleToggle('whatsapp', checked)}
          />
        </Flex>
      </Space>
    </Drawer>
  );
};
