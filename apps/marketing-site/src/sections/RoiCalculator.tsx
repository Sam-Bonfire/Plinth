import { Card, Col, InputNumber, Row, Statistic, Typography } from 'antd';
import { useMemo, useState } from 'react';

const { Title } = Typography;

export interface RoiEstimateInputs {
  ordersPerDay: number;
  avgBill: number; // minor units (cents)
  outlets: number;
}

export interface RoiEstimateResult {
  monthlySavings: number; // minor units (cents)
  paybackMonths: number;
}

export function roiEstimate(inputs: RoiEstimateInputs): RoiEstimateResult {
  const { ordersPerDay, avgBill, outlets } = inputs;

  if (ordersPerDay <= 0 || avgBill <= 0 || outlets <= 0) {
    return { monthlySavings: 0, paybackMonths: 0 };
  }

  // Calculate monthly revenue in minor units (cents), assuming 30 days
  const monthlyRevenue = ordersPerDay * avgBill * 30 * outlets;

  // Assume Plinth saves 2% of the monthly revenue
  const monthlySavings = Math.floor(monthlyRevenue * 0.02);

  // Assume a fixed one-time setup cost of $500 (50000 cents) per outlet
  const totalCost = 50000 * outlets;

  const paybackMonths = monthlySavings > 0 ? totalCost / monthlySavings : 0;

  return { monthlySavings, paybackMonths };
}

export interface RoiCalculatorProps {
  defaultOrdersPerDay?: number;
  defaultAvgBill?: number; // minor units (cents)
  defaultOutlets?: number;
}

export const RoiCalculator: React.FC<RoiCalculatorProps> = ({
  defaultOrdersPerDay = 100,
  defaultAvgBill = 1500, // $15.00
  defaultOutlets = 1,
}) => {
  const [ordersPerDay, setOrdersPerDay] = useState<number>(defaultOrdersPerDay);
  const [avgBill, setAvgBill] = useState<number>(defaultAvgBill);
  const [outlets, setOutlets] = useState<number>(defaultOutlets);

  const { monthlySavings, paybackMonths } = useMemo(() => {
    return roiEstimate({ ordersPerDay, avgBill, outlets });
  }, [ordersPerDay, avgBill, outlets]);

  return (
    <Card title={<Title level={3}>ROI & Cost Savings Calculator</Title>} variant="outlined">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Orders per Day (per Outlet)</label>
            <InputNumber
              aria-label="Orders per day"
              min={0}
              value={ordersPerDay}
              onChange={(value) => setOrdersPerDay(value || 0)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Average Bill ($)</label>
            <InputNumber
              aria-label="Average bill"
              min={0}
              value={avgBill / 100}
              onChange={(value) => setAvgBill(Math.round((value || 0) * 100))}
              precision={2}
              style={{ width: '100%' }}
              prefix="$"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Number of Outlets</label>
            <InputNumber
              aria-label="Number of outlets"
              min={0}
              value={outlets}
              onChange={(value) => setOutlets(value || 0)}
              style={{ width: '100%' }}
            />
          </div>
        </Col>
        <Col xs={24} md={12}>
          <Card variant="borderless" style={{ background: '#f5f5f5', height: '100%' }}>
            <div data-testid="monthly-savings">
              <Statistic
                title="Estimated Monthly Savings"
                value={monthlySavings / 100}
                precision={2}
                prefix="$"
              />
            </div>
            <div data-testid="payback-months">
              <Statistic
                title="Payback Period (Months)"
                value={paybackMonths}
                precision={1}
                style={{ marginTop: 32 }}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};
