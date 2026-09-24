import { Collapse, Typography } from 'antd';
import React from 'react';

const { Title, Paragraph } = Typography;

export interface FaqItem {
  key: string;
  question: string;
  answer: React.ReactNode;
}

export interface FaqAccordionProps {
  items?: FaqItem[];
}

const defaultItems: FaqItem[] = [
  {
    key: 'offline-mode',
    question: 'Does PlinthOS work offline?',
    answer: <Paragraph>Yes, PlinthOS provides offline capabilities so your business can continue running smoothly even during internet outages.</Paragraph>,
  },
  {
    key: 'pricing',
    question: 'What is the pricing model?',
    answer: <Paragraph>We offer transparent and flexible pricing to fit businesses of all sizes. Contact us for a tailored quote.</Paragraph>,
  },
  {
    key: 'hardware',
    question: 'What hardware is required?',
    answer: <Paragraph>PlinthOS is compatible with most standard point-of-sale hardware. You can use your existing equipment or purchase from our recommended hardware list.</Paragraph>,
  },
  {
    key: 'data-ownership',
    question: 'Who owns my data?',
    answer: <Paragraph>You retain full ownership of your data. We ensure your information is securely stored and never shared without your permission.</Paragraph>,
  },
  {
    key: 'support',
    question: 'What kind of support is available?',
    answer: <Paragraph>We provide 24/7 dedicated support to assist you with any technical issues or questions you might have.</Paragraph>,
  },
  {
    key: 'onboarding',
    question: 'How does the onboarding process work?',
    answer: <Paragraph>Our team will guide you through every step of the setup process, ensuring a seamless transition and comprehensive training for your staff.</Paragraph>,
  },
];

export const FaqAccordion: React.FC<FaqAccordionProps> = ({ items = defaultItems }) => {
  const collapseItems = items.map((item) => ({
    key: item.key,
    label: item.question,
    children: item.answer,
  }));

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '2rem' }}>
        Frequently Asked Questions
      </Title>
      <Collapse
        items={collapseItems}
        bordered={false}
        defaultActiveKey={[]}
        accordion
      />
    </div>
  );
};
