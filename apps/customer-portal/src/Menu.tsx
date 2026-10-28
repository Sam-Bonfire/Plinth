import {
  addLine,
  cartTotals,
  PlinthApiClient,
  type CartLine,
  type PublicMenuCatalogResponseDto,
  type PublicMenuCategoryDto,
  type PublicMenuItemDto,
  type PublicTenantDto,
} from '@plinth/ui-kit';
import { Alert, Button, Card, Empty, Flex, Segmented, Space, Spin, Tag, Typography, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { portalApi } from './api.js';
import { ConsentDrawer, type ConsentChoices } from './ConsentDrawer.js';
import { LoginModal, type LoginSubmitData } from './LoginModal.js';
import { inr } from './money.js';
import { loadConsent, loadCustomer, saveConsent, saveCustomer, saveOrder, type PortalCustomer } from './session.js';

export type {
  PublicTenantDto,
  PublicMenuCatalogResponseDto,
  PublicMenuItemDto,
  PublicMenuCategoryDto,
};

const { Title, Text, Paragraph } = Typography;

export interface MenuProps {
  client?: PlinthApiClient;
}

export const Menu = ({ client = portalApi }: MenuProps = {}): React.JSX.Element => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<PublicTenantDto[]>([]);
  const [catalog, setCatalog] = useState<PublicMenuCatalogResponseDto | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PortalCustomer | null>(() => loadCustomer());
  const [loginOpen, setLoginOpen] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | undefined>(undefined);
  const [placing, setPlacing] = useState<boolean>(false);
  const [placedId, setPlacedId] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchCatalogOrTenants = async () => {
      setLoading(true);
      setError(null);

      if (!tenantId) {
        try {
          const data = await client.getPublicTenants();
          setTenants(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const data = await client.getPublicMenu(tenantId);
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

    fetchCatalogOrTenants();
  }, [client, tenantId]);

  const placeOrder = async (cust: PortalCustomer): Promise<void> => {
    if (!tenantId || cart.length === 0) return;
    
    const locationId = searchParams.get('location_id');
    if (!locationId) {
      void message.error('Scan the outlet QR to order');
      return;
    }
    
    setPlacing(true);
    try {
      const data = await client.createPublicOrder({
        tenant_id: tenantId,
        location_id: locationId,
        channel: 'Takeaway',
        customer_name: cust.name,
        items: cart.map((l) => ({
          menu_item_id: l.itemId,
          name: l.name,
          unit_price_minor: l.unitPriceMinor,
          quantity: l.qty,
        })),
      });
      saveOrder({
        order_id: data.order_id,
        ticket_id: data.ticket_id,
        tenant_id: tenantId,
        total_minor: data.total_minor,
        itemCount: cartTotals(cart).count,
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
      const res = await client.customerLogin({ tenant_id: tenantId, phone: data.phone });
      const cust: PortalCustomer = { name: res.customer.name, phone: res.customer.phone };
      setCustomer(cust);
      saveCustomer(cust);
      
      // Check consent immediately after login
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
      if (loadConsent() === null) {
        setConsentOpen(true);
        return;
      }
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

  if (!tenantId) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        <Title level={1} style={{ textAlign: 'center', marginBottom: '24px', fontSize: 24 }}>
          Select a Restaurant
        </Title>
        <Flex vertical gap="middle">
          {tenants.map(t => (
            <Link key={t.id} to={`/?tenant_id=${t.id}`} style={{ display: 'block' }}>
              <Button block size="large">{t.name}</Button>
            </Link>
          ))}
          {tenants.length === 0 && (
            <Empty description="No restaurants available" />
          )}
        </Flex>
      </div>
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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px', paddingBottom: '96px', scrollPaddingBottom: 96 }}>
      <Title level={1} style={{ textAlign: 'center', marginBottom: '24px', fontSize: 24 }}>
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
          aria-label="Menu category"
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
                  {inr(item.price_minor)}
                </Text>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    setCart((c) =>
                      addLine(c, {
                        itemId: item.id,
                        name: item.name,
                        detail: '',
                        unitPriceMinor: item.price_minor,
                        gstRatePercent: 0,
                      }),
                    )
                  }
                >
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
          role="region"
          aria-label="Cart summary"
          style={{ position: 'sticky', bottom: 16, marginTop: 16 }}
          size="small"
        >
          <Flex justify="space-between" align="center">
            <Text strong>
              {cartTotals(cart).count} items · {inr(cartTotals(cart).subtotalMinor)}
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
