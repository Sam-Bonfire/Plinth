import { PlinthApiClient } from '@plinth/ui-kit';

export const getPortalApiClient = (baseUrl?: string): PlinthApiClient => {
  const base = baseUrl ?? (import.meta.env.VITE_API_BASE_URL || '');
  return new PlinthApiClient({ baseUrl: base });
};

export const portalApi = getPortalApiClient();
