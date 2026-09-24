import { Button, Card, Input, Select, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';

export interface PlaygroundEndpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  params: string[];
}

export interface BuiltRequest {
  method: string;
  url: string;
  body: string | null;
}

const DEFAULT_ENDPOINTS: PlaygroundEndpoint[] = [
  { id: 'health', method: 'GET', path: '/health', description: 'Service health probe', params: [] },
  { id: 'menu', method: 'GET', path: '/api/v1/public/menu/catalog', description: 'Public menu catalog', params: ['tenant_id'] },
  { id: 'webhook', method: 'POST', path: '/api/v1/webhooks/razorpay', description: 'Razorpay webhook sample', params: ['order_id'] },
];

const MOCK_RESPONSES: Record<string, string> = {
  health: '{\n  "status": "ok",\n  "version": "0.1.0",\n  "d1_reachable": true\n}',
  menu: '{\n  "categories": [{ "id": "CAT-01", "name": "Starters", "items": [] }]\n}',
  webhook: '{\n  "received": true\n}',
};

/** Builds a display request from an endpoint + param values (URL-encoded). */
export const buildRequest = (endpoint: PlaygroundEndpoint, values: Record<string, string>): BuiltRequest => {
  const query = endpoint.params
    .filter((p: string): boolean => (values[p] ?? '').trim() !== '')
    .map((p: string): string => `${encodeURIComponent(p)}=${encodeURIComponent(values[p] as string)}`)
    .join('&');
  const url = query === '' ? endpoint.path : `${endpoint.path}?${query}`;
  const body = endpoint.method === 'POST' ? JSON.stringify({ sample: true, ...values }, null, 2) : null;
  return { method: endpoint.method, url, body };
};

export const toCurl = (req: BuiltRequest): string => {
  const parts = [`curl -X ${req.method} 'https://api.plinth.example${req.url}'`];
  if (req.body !== null) parts.push(`-H 'Content-Type: application/json' -d '${req.body}'`);
  return parts.join(' ');
};

interface Props {
  endpoints?: PlaygroundEndpoint[];
}

export const ApiPlayground: React.FC<Props> = ({ endpoints = DEFAULT_ENDPOINTS }: Props) => {
  const [selectedId, setSelectedId] = useState<string>(endpoints[0]?.id ?? '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<boolean>(false);

  const endpoint = endpoints.find((e: PlaygroundEndpoint): boolean => e.id === selectedId) ?? endpoints[0];
  const request = useMemo((): BuiltRequest | null => (endpoint ? buildRequest(endpoint, values) : null), [endpoint, values]);

  if (!endpoint || !request) return null;

  const setParam = (key: string, value: string): void => {
    setValues((prev: Record<string, string>): Record<string, string> => ({ ...prev, [key]: value }));
  };

  const copyCurl = (): void => {
    void navigator.clipboard?.writeText(toCurl(request)).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <Card title="API Playground">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Select
          value={endpoint.id}
          onChange={(v: string): void => { setSelectedId(v); setValues({}); setCopied(false); }}
          options={endpoints.map((e: PlaygroundEndpoint): { label: string; value: string } => ({ label: `${e.method} ${e.path}`, value: e.id }))}
          style={{ width: '100%' }}
        />
        <Typography.Text type="secondary">{endpoint.description}</Typography.Text>
        {endpoint.params.map((p: string): React.ReactNode => (
          <Input key={p} placeholder={p} value={values[p] ?? ''} onChange={(e): void => setParam(p, e.target.value)} />
        ))}
        <Typography.Text code copyable={false}>
          {request.method} {request.url}
        </Typography.Text>
        {request.body !== null && (
          <Typography.Text code style={{ whiteSpace: 'pre-wrap' }}>
            {request.body}
          </Typography.Text>
        )}
        <Typography.Title level={5}>Mock response</Typography.Title>
        <Typography.Text code style={{ whiteSpace: 'pre-wrap' }}>
          {MOCK_RESPONSES[endpoint.id] ?? '{}'}
        </Typography.Text>
        <Space>
          <Button size="small" onClick={copyCurl}>
            Copy cURL
          </Button>
          {copied && <Typography.Text type="success">Copied!</Typography.Text>}
        </Space>
      </Space>
    </Card>
  );
};
