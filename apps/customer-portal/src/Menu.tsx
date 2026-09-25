import { Alert, Button, Card, Empty, Flex, Segmented, Space, Spin, Tag, Typography, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addToCart, cartCount, cartTotal, type Cart } from './cart.js';
import { ConsentDrawer, type ConsentChoices } from './ConsentDrawer.js';
import { LoginModal, type LoginSubmitData } from './LoginModal.js';
import { loadConsent, loadCustomer, saveConsent, saveCustomer, saveOrder, type PortalCustomer } from './session.js';

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

const apiBase = (): string => import.meta.env.VITE_API_BASE_URL || '';

export const Menu = (): React.JSX.Element => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PublicMenuCatalogResponseDto | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart>([]);
  const [customer, setCustomer] = useState<PortalCustomer | null>(() => loadCustomer());
  const [loginOpen, setLoginOpen] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | undefined>(undefined);
  const [placing, setPlacing] = useState<boolean>(false);
  const [placedId, setPlacedId] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState<boolean>(false);

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
        const res = await fetch(`${apiBase()}/api/v1/public/menu?tenant_id=${tenantId}`);

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

  const placeOrder = async (cust: PortalCustomer): Promise<void> => {
    if (!tenantId || cart.length === 0) return;
    setPlacing(true);
    try {
      // location_id is unknown to the portal; tenant scope is the routing key.
      const locationId = searchParams.get('location_id') ?? tenantId;
      const res = await fetch(`${apiBase()}/api/v1/public/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          location_id: locationId,
          channel: 'Takeaway',
          customer_name: cust.name,
          items: cart.map((l) => ({
            menu_item_id: l.id,
            name: l.name,
            unit_price_minor: l.price_minor,
            quantity: l.qty,
          })),
        }),
      });
      if (!res.ok) throw new Error('Order was rejected');
      const data = (await res.json()) as { order_id: string; ticket_id: string; total_minor: number };
      saveOrder({
        order_id: data.order_id,
        ticket_id: data.ticket_id,
        total_minor: data.total_minor,
        itemCount: cartCount(cart),
        placedAt: new Date().toISOString(),
      });
      setPlacedId(data.order_id);
      setCart([]);
      setLoginOpen(false);
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setPlacing(false);
    }
  };

  const handleLogin = async (data: LoginSubmitData): Promise<void> => {
    if (!tenantId) return;
    setLoginError(undefined);
    try {
      // Backend identifies customers by phone; PIN is a terminal-side secret and is never sent.
      const res = await fetch(`${apiBase()}/api/v1/customer-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, phone: data.phone }),
      });
      if (!res.ok) throw new Error('Login failed - is this phone registered?');
      const profile = (await res.json()) as { name: string; phone: string };
      const cust: PortalCustomer = { name: profile.name, phone: profile.phone };
      setCustomer(cust);
      saveCustomer(cust);
      if (loadConsent() === null) {
        setLoginOpen(false);
        setConsentOpen(true);
        return;
      }
      await placeOrder(cust);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleConsent = async (choices: ConsentChoices): Promise<void> => {
    saveConsent(choices);
    setConsentOpen(false);
    if (customer) {
      await placeOrder(customer);
    }
  };

  const checkout = (): void => {
    if (cart.length === 0) return;
    if (customer) {
      void placeOrder(customer);
    } else {
      setLoginOpen(true);
    }
  };

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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px', paddingBottom: '96px' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>
        Digital Menu
      </Title>

      {placedId !== null && (
        <Alert
          message={`Order placed: ${placedId}`}
          description={<Link to="/orders">View it in My Orders</Link>}
          type="success"
          showIcon
          closable
          onClose={() => setPlacedId(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

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
              <Space direction="vertical" align="end" style={{ flexShrink: 0 }}>
                <Text strong style={{ fontSize: '16px', color: 'var(--font)' }}>
                  ${(item.price_minor / 100).toFixed(2)}
                </Text>
                <Button size="small" type="primary" onClick={() => setCart((c) => addToCart(c, item))}>
                  Add
                </Button>
              </Space>
            </Flex>
          </Card>
        ))}
        {(!selectedCategory?.items || selectedCategory.items.length === 0) && (
          <Empty description="No items in this category" />
        )}
      </Flex>

      {cart.length > 0 && (
        <Card
          style={{ position: 'fixed', bottom: 16, left: 16, right: 16, maxWidth: '768px', margin: '0 auto' }}
          size="small"
        >
          <Flex justify="space-between" align="center">
            <Text strong>
              {cartCount(cart)} items · ${(cartTotal(cart) / 100).toFixed(2)}
            </Text>
            <Button type="primary" loading={placing} onClick={checkout}>
              {customer ? `Order as ${customer.name}` : 'Login & Order'}
            </Button>
          </Flex>
        </Card>
      )}

      <LoginModal open={loginOpen} onCancel={() => setLoginOpen(false)} onSubmit={handleLogin} error={loginError} />
      <ConsentDrawer open={consentOpen} onConsent={handleConsent} />
    </div>
  );
};
