export interface PortalCustomer {
  name: string;
  phone: string;
}

export interface PlacedOrder {
  order_id: string;
  ticket_id: string;
  total_minor: number;
  itemCount: number;
  placedAt: string;
}

const CUSTOMER_KEY = 'plinth-portal-customer';
const ORDERS_KEY = 'plinth-portal-orders';

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: session stays in memory only.
  }
};

export const loadCustomer = (): PortalCustomer | null => readJson<PortalCustomer>(CUSTOMER_KEY);

export const saveCustomer = (c: PortalCustomer): void => writeJson(CUSTOMER_KEY, c);

export const loadOrders = (): PlacedOrder[] => readJson<PlacedOrder[]>(ORDERS_KEY) ?? [];

export const saveOrder = (o: PlacedOrder): void => writeJson(ORDERS_KEY, [o, ...loadOrders()].slice(0, 20));
