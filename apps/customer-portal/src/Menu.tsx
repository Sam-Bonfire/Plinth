import { Card, Typography, Spin, Alert, Segmented, Tag, Flex, Empty } from 'antd';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

export interface PublicMenuItemDto {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  is_veg: boolean;
}

export interface PublicMenuCategoryDto {
  id: string;
  name: string;
  items: PublicMenuItemDto[];
}

export interface PublicMenuCatalogResponseDto {
  categories: PublicMenuCategoryDto[];
}

export const Menu = (): React.JSX.Element => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PublicMenuCatalogResponseDto | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      if (!tenantId) {
        setError('Missing tenant_id in URL');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const res = await fetch(`${baseUrl}/api/v1/public/menu?tenant_id=${tenantId}`);

        if (!res.ok) {
          throw new Error('Failed to fetch menu');
        }

        const data: PublicMenuCatalogResponseDto = await res.json();
        setCatalog(data);

        if (data.categories.length > 0) {
          setSelectedCategoryId(data.categories[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [tenantId]);

  if (loading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh', padding: '16px' }}>
        <Alert message="Error" description={error} type="error" showIcon />
      </Flex>
    );
  }

  if (!catalog || catalog.categories.length === 0) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Empty description="No menu available" />
      </Flex>
    );
  }

  const selectedCategory = catalog.categories.find((c) => c.id === selectedCategoryId);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>
        Digital Menu
      </Title>

      <div style={{ overflowX: 'auto', marginBottom: '24px', paddingBottom: '8px' }}>
        <Segmented
          options={catalog.categories.map((c) => ({ label: c.name, value: c.id }))}
          value={selectedCategoryId || undefined}
          onChange={(val) => setSelectedCategoryId(val.toString())}
        />
      </div>

      <Flex vertical gap="middle">
        {selectedCategory?.items.map((item) => (
          <Card key={item.id} size="small" hoverable>
            <Flex justify="space-between" align="flex-start">
              <div style={{ flex: 1, marginRight: '16px' }}>
                <Flex align="center" gap="small" style={{ marginBottom: '4px' }}>
                  <Text strong style={{ fontSize: '16px' }}>
                    {item.name}
                  </Text>
                  {item.is_veg && <Tag color="green">Veg</Tag>}
                </Flex>
                {item.description && (
                  <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                    {item.description}
                  </Paragraph>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                <Text strong style={{ fontSize: '16px', color: 'var(--font)' }}>
                  ${(item.price_minor / 100).toFixed(2)}
                </Text>
              </div>
            </Flex>
          </Card>
        ))}
        {(!selectedCategory?.items || selectedCategory.items.length === 0) && (
          <Empty description="No items in this category" />
        )}
      </Flex>
    </div>
  );
};
