import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiPlayground, buildRequest, toCurl, type PlaygroundEndpoint } from './ApiPlayground.js';

const menu: PlaygroundEndpoint = {
  id: 'menu',
  method: 'GET',
  path: '/api/v1/public/menu/catalog',
  description: 'menu',
  params: ['tenant_id'],
};

describe('buildRequest', () => {
  it('builds a GET url with encoded params', () => {
    expect(buildRequest(menu, { tenant_id: 't 1' })).toEqual({
      method: 'GET',
      url: '/api/v1/public/menu/catalog?tenant_id=t%201',
      body: null,
    });
  });

  it('omits blank params', () => {
    expect(buildRequest(menu, { tenant_id: '  ' }).url).toBe('/api/v1/public/menu/catalog');
  });

  it('builds a POST body', () => {
    const req = buildRequest({ ...menu, method: 'POST', params: [] }, {});
    expect(req.body).toContain('"sample": true');
    expect(toCurl(req)).toContain("curl -X POST");
  });
});

describe('ApiPlayground', () => {
  it('switches endpoints and renders params + mock response', async () => {
    render(<ApiPlayground />);
    expect(await screen.findByText('Service health probe')).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const options = await screen.findAllByText('GET /api/v1/public/menu/catalog');
    fireEvent.click(options[options.length - 1] as HTMLElement);
    expect(await screen.findByPlaceholderText('tenant_id')).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText('tenant_id'), { target: { value: 't-1' } });
    expect(await screen.findByText(/tenant_id=t-1/)).toBeDefined();
  });
});
