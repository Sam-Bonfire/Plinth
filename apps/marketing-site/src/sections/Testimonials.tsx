import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Card, Typography, Flex, Button, Space, Rate } from 'antd';
import React, { useState, useEffect, useCallback } from 'react';

const { Title, Text, Paragraph } = Typography;

export interface Testimonial {
  name: string;
  outlet: string;
  quote: string;
  rating: number;
}

export interface TestimonialsProps {
  testimonials?: Testimonial[];
  autoAdvanceInterval?: number;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    name: 'Alice Smith',
    outlet: 'Tech Weekly',
    quote: 'An absolutely fantastic experience from start to finish. Highly recommended!',
    rating: 5,
  },
  {
    name: 'Bob Johnson',
    outlet: 'Daily Times',
    quote: 'Great product, but it took a bit of time to get used to the interface.',
    rating: 4,
  },
  {
    name: 'Charlie Davis',
    outlet: 'Innovation Mag',
    quote: 'Revolutionized our workflow overnight. Five stars are not enough.',
    rating: 5,
  },
];

export const Testimonials = ({
  testimonials = DEFAULT_TESTIMONIALS,
  autoAdvanceInterval = 5000,
}: TestimonialsProps): React.ReactElement | null => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const handleNext = useCallback((): void => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
  }, [testimonials.length]);

  const handlePrev = useCallback((): void => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  const handleDotClick = (index: number): void => {
    setCurrentIndex(index);
  };

  useEffect((): (() => void) | void => {
    if (isPaused || testimonials.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      handleNext();
    }, autoAdvanceInterval);

    return () => {
      clearInterval(timer);
    };
  }, [autoAdvanceInterval, handleNext, isPaused, testimonials.length]);

  if (testimonials.length === 0) {
    return null;
  }

  const currentTestimonial = testimonials[currentIndex];

  if (!currentTestimonial) {
    return null;
  }

  return (
    <div
      onMouseEnter={() => { setIsPaused(true); }}
      onMouseLeave={() => { setIsPaused(false); }}
      style={{ padding: '40px 20px', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}
    >
      <Title level={2}>What Our Customers Say</Title>

      <Card style={{ margin: '20px 0', minHeight: 200 }}>
        <Flex vertical align="center" gap="middle">
          <Rate disabled value={currentTestimonial.rating} />
          <Paragraph italic style={{ fontSize: '1.2em' }}>
            "{currentTestimonial.quote}"
          </Paragraph>
          <Flex vertical align="center">
            <Text strong>{currentTestimonial.name}</Text>
            <Text type="secondary">{currentTestimonial.outlet}</Text>
          </Flex>
        </Flex>
      </Card>

      <Flex justify="center" align="center" gap="large" style={{ marginTop: 20 }}>
        <Button icon={<LeftOutlined />} onClick={handlePrev} aria-label="Previous Testimonial" />
        <Space size="small">
          {testimonials.map((_, index) => (
            <div
              key={index}
              onClick={() => { handleDotClick(index); }}
              data-testid={`dot-${index}`}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: index === currentIndex ? '#1677ff' : '#d9d9d9',
                cursor: 'pointer',
              }}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </Space>
        <Button icon={<RightOutlined />} onClick={handleNext} aria-label="Next Testimonial" />
      </Flex>
    </div>
  );
};
