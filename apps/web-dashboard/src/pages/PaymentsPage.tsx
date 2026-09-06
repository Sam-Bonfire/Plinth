import { AlertBanner, DoughnutChart } from "@plinth/ui-kit";
import { Button, Card, Col, Input, InputNumber, Modal, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography, message, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";

type PayMethod = "UPI" | "Card" | "Cash";
type TxnStatus = "Settled" | "Pending" | "Refunded";

interface Txn {
  key: string;
  id: string;
  order: string;
  method: PayMethod;
  channel: string;
  amount: number;
  time: string;
  status: TxnStatus;
}

interface ReconRow {
  key: string;
  platform: string;
  expected: number;
  received: number;
}

const seedTxns = (): Txn[] => [
  { key: "TXN-9001", id: "TXN-9001", order: "ORD-1098", method: "UPI", channel: "Dine-in", amount: 583.38, time: "12:14", status: "Settled" },
  { key: "TXN-9002", id: "TXN-9002", order: "ORD-1099", method: "UPI", channel: "Takeaway", amount: 619.5, time: "11:55", status: "Settled" },
  { key: "TXN-9003", id: "TXN-9003", order: "SW-9921", method: "Card", channel: "Swiggy", amount: 252, time: "12:11", status: "Settled" },
  { key: "TXN-9004", id: "TXN-9004", order: "ZM-4401", method: "Cash", channel: "Zomato", amount: 283.5, time: "12:02", status: "Pending" },
  { key: "TXN-9005", id: "TXN-9005", order: "ORD-1097", method: "Cash", channel: "Dine-in", amount: 845, time: "11:38", status: "Settled" },
];

const seedRecon = (): ReconRow[] => [
  { key: "Swiggy", platform: "Swiggy", expected: 48210, received: 48210 },
  { key: "Zomato", platform: "Zomato", expected: 39840, received: 38600 },
];

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const statusColor = (s: TxnStatus): string => (s === "Settled" ? "success" : s === "Pending" ? "processing" : "default");

export const PaymentsPage: React.FC = () => {
  const [txns, setTxns] = useState<Txn[]>(seedTxns);
  const [recon] = useState<ReconRow[]>(seedRecon);
  const [query, setQuery] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [refundKey, setRefundKey] = useState<string | null>(null);
  const [cashOpen, setCashOpen] = useState<boolean>(false);
  const [counted, setCounted] = useState<number>(0);
  const [reconAt, setReconAt] = useState<string | null>(null);

  const settled = useMemo((): Txn[] => txns.filter((t: Txn): boolean => t.status === "Settled"), [txns]);
  const sumBy = (m: PayMethod): number => settled.filter((t: Txn): boolean => t.method === m).reduce((s: number, t: Txn): number => s + t.amount, 0);
  const collected = settled.reduce((s: number, t: Txn): number => s + t.amount, 0);
  const cashExpected = sumBy("Cash");

  const rows = useMemo((): Txn[] => {
    const q = query.trim().toLowerCase();
    return txns.filter((t: Txn): boolean => {
      if (methodFilter !== "all" && t.method !== methodFilter) return false;
      if (q !== "" && !t.id.toLowerCase().includes(q) && !t.order.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [txns, methodFilter, query]);

  const refundTarget = txns.find((t: Txn): boolean => t.key === refundKey) ?? null;

  const confirmRefund = (): void => {
    if (!refundTarget) return;
    setTxns((prev: Txn[]): Txn[] => prev.map((t: Txn): Txn => (t.key === refundTarget.key ? { ...t, status: "Refunded" } : t)));
    void message.success(`Refund of ${inr(refundTarget.amount)} for ${refundTarget.id} processed.`);
    setRefundKey(null);
  };

  const saveCashVariance = (): void => {
    const variance = counted - cashExpected;
    void message.success(`Cash variance ${inr(variance)} recorded (counted ${inr(counted)} vs expected ${inr(cashExpected)}).`);
    setCashOpen(false);
  };

  const runRecon = (): void => {
    const matched = recon.filter((r: ReconRow): boolean => r.expected === r.received).length;
    setReconAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    void message.success(`Reconciliation complete: ${matched} matched, ${recon.length - matched} need review.`);
  };

  const exportCsv = (): void => {
    const csv = ["txn,order,method,channel,amount,time,status", ...rows.map((t: Txn): string => [t.id, t.order, t.method, t.channel, t.amount, t.time, t.status].join(","))].join("\n");
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "transactions.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
    void message.success(`Exported ${rows.length} transactions.`);
  };

  const txnColumns: TableColumnsType<Txn> = [
    { title: "Txn", dataIndex: "id", key: "id", render: (id: string): React.ReactNode => <Typography.Text style={{ fontFamily: "var(--mono)" }}>{id}</Typography.Text> },
    { title: "Order", dataIndex: "order", key: "order", width: 100 },
    { title: "Method", dataIndex: "method", key: "method", width: 80 },
    { title: "Channel", dataIndex: "channel", key: "channel", width: 100 },
    { title: "Amount", dataIndex: "amount", key: "amount", align: "right", render: (a: number): React.ReactNode => <Typography.Text strong>{inr(a)}</Typography.Text> },
    { title: "Time", dataIndex: "time", key: "time", width: 70 },
    { title: "Status", dataIndex: "status", key: "status", width: 100, render: (s: TxnStatus): React.ReactNode => <Tag color={statusColor(s)}>{s}</Tag> },
    {
      title: "Action",
      key: "action",
      width: 90,
      render: (_: unknown, row: Txn): React.ReactNode =>
        row.status === "Settled" ? (
          <Button size="small" onClick={(): void => setRefundKey(row.key)}>
            Refund
          </Button>
        ) : null,
    },
  ];

  const reconColumns: TableColumnsType<ReconRow> = [
    { title: "Platform", dataIndex: "platform", key: "platform" },
    { title: "Expected", dataIndex: "expected", key: "expected", align: "right", render: (v: number): React.ReactNode => inr(v) },
    { title: "Received", dataIndex: "received", key: "received", align: "right", render: (v: number): React.ReactNode => inr(v) },
    {
      title: "Variance",
      key: "variance",
      align: "right",
      render: (_: unknown, row: ReconRow): React.ReactNode => {
        const v = row.received - row.expected;
        return <Typography.Text type={v === 0 ? "success" : "danger"}>{inr(v)}</Typography.Text>;
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, row: ReconRow): React.ReactNode =>
        row.expected === row.received ? <Tag color="success">Matched</Tag> : <Tag color="warning">Needs review</Tag>,
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Collected Today" value={inr(collected)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="UPI" value={inr(sumBy("UPI"))} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Card" value={inr(sumBy("Card"))} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Cash" value={inr(cashExpected)} />
          </Card>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={16}>
          <Card
            title="Transaction Log"
            style={{ marginBottom: 16 }}
            extra={
              <Space>
                <Input allowClear placeholder="Search…" value={query} onChange={(e): void => setQuery(e.target.value)} style={{ width: 160 }} />
                <Segmented value={methodFilter} onChange={(v): void => setMethodFilter(v as string)} options={["all", "UPI", "Card", "Cash"]} />
                <Button size="small" onClick={exportCsv}>
                  Export
                </Button>
              </Space>
            }
          >
            <Table<Txn> dataSource={rows} columns={txnColumns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No transactions match." }} />
          </Card>
          <Card title="Aggregator Reconciliation" extra={reconAt !== null ? <Typography.Text type="secondary">Last run {reconAt}</Typography.Text> : <Button size="small" onClick={runRecon}>Run Now</Button>}>
            <Table<ReconRow> dataSource={recon} columns={reconColumns} rowKey="key" pagination={false} size="small" />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Payment Split" style={{ marginBottom: 16 }}>
            <DoughnutChart
              data={[
                { method: "UPI", value: sumBy("UPI") },
                { method: "Card", value: sumBy("Card") },
                { method: "Cash", value: cashExpected },
              ]}
              angleField="value"
              colorField="method"
              height={220}
            />
          </Card>
          <Card title="Quick Actions" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button block onClick={(): void => setRefundKey(settled[0]?.key ?? null)} disabled={settled.length === 0}>
                Process Refund
              </Button>
              <Button block onClick={(): void => { setCounted(cashExpected); setCashOpen(true); }}>
                Cash Variance
              </Button>
              <Button block onClick={runRecon}>
                Reconcile All
              </Button>
              <Button block onClick={exportCsv}>
                Export CSV
              </Button>
            </Space>
          </Card>
          <Card title="Fraud Alerts">
            <AlertBanner type="warning" message="Refund velocity" description="3 refunds above ₹2,000 by the same cashier in the last hour." />
            <AlertBanner type="error" message="Payout shortfall" description="Zomato payout is short by ₹1,240 against expected settlement." />
          </Card>
        </Col>
      </Row>

      <Modal title="Process Refund" open={refundKey !== null} onOk={confirmRefund} okButtonProps={{ disabled: refundTarget === null }} onCancel={(): void => setRefundKey(null)} okText="Confirm Refund">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            value={refundKey}
            onChange={(v): void => setRefundKey(v as string)}
            options={settled.map((t: Txn) => ({ label: `${t.id} · ${inr(t.amount)}`, value: t.key }))}
            style={{ width: "100%" }}
            placeholder="Select a settled transaction"
          />
          {refundTarget !== null && (
            <Typography.Text type="secondary">
              Refunding {inr(refundTarget.amount)} for order {refundTarget.order} ({refundTarget.method}).
            </Typography.Text>
          )}
        </Space>
      </Modal>

      <Modal title="Cash Variance" open={cashOpen} onOk={saveCashVariance} onCancel={(): void => setCashOpen(false)} okText="Record Variance">
        <Space direction="vertical">
          <Typography.Text type="secondary">Expected in drawer: {inr(cashExpected)}</Typography.Text>
          <Space>
            <InputNumber min={0} value={counted} onChange={(v: number | null): void => setCounted(v ?? 0)} prefix="₹" />
            <Typography.Text>counted cash</Typography.Text>
          </Space>
          <Typography.Text strong>Variance: {inr(counted - cashExpected)}</Typography.Text>
        </Space>
      </Modal>
    </div>
  );
};
