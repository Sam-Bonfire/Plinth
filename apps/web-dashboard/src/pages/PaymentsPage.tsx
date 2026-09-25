import { DoughnutChart, type ZReportDto } from "@plinth/ui-kit";import { Button, Card, Col, Descriptions, Input, InputNumber, Modal, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography, message, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";
import { CashDropModal, type CashDrop } from "../components/CashDropModal.js";
import { FraudAlerts } from "../components/FraudAlerts.js";
import { UpiQrModal } from "../components/UpiQrModal.js";
import { useAuth } from "../providers/AuthProvider.js";

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

const escapeCsvField = (field: string | number): string => {
  const str = String(field);
  if (/[,"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const buildPaymentsCsv = (rows: Txn[]): string => {
  const header = ["date", "method", "amount", "status", "reference"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvField(r.time),
        escapeCsvField(r.method),
        escapeCsvField(r.amount),
        escapeCsvField(r.status),
        escapeCsvField(r.id),
      ].join(",")
    );
  }
  return lines.join("\n");
};

export interface LocalZ {
  gross: number;
  byMethod: Record<string, number>;
  refunded: number;
}

/** Summarizes settled txns into a Z-report-shaped total (demo/offline fallback). */
export const buildLocalZ = (rows: Txn[]): LocalZ => {
  const settled = rows.filter((r: Txn): boolean => r.status === "Settled");
  const byMethod: Record<string, number> = {};
  let refunded = 0;
  for (const r of rows) {
    if (r.status === "Refunded") refunded += r.amount;
  }
  let gross = 0;
  for (const r of settled) {
    gross += r.amount;
    byMethod[r.method] = (byMethod[r.method] ?? 0) + r.amount;
  }
  return { gross, byMethod, refunded };
};

export const PaymentsPage: React.FC = () => {
  const [txns, setTxns] = useState<Txn[]>(seedTxns);
  const [recon] = useState<ReconRow[]>(seedRecon);
  const [query, setQuery] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [refundKey, setRefundKey] = useState<string | null>(null);
  const [cashOpen, setCashOpen] = useState<boolean>(false);
  const [counted, setCounted] = useState<number>(0);
  const [reconAt, setReconAt] = useState<string | null>(null);
  const [drops, setDrops] = useState<CashDrop[]>([]);
  const [dropOpen, setDropOpen] = useState<boolean>(false);
  const [upiOpen, setUpiOpen] = useState<boolean>(false);
  const [closeOpen, setCloseOpen] = useState<boolean>(false);
  const [shiftId, setShiftId] = useState<string>("");
  const [physicalCash, setPhysicalCash] = useState<number | null>(null);
  const [closeNote, setCloseNote] = useState<string>("");
  const [zReport, setZReport] = useState<ZReportDto | null>(null);
  const [zLocal, setZLocal] = useState<LocalZ | null>(null);
  const { client } = useAuth();

  const settled = useMemo((): Txn[] => txns.filter((t: Txn): boolean => t.status === "Settled"), [txns]);
  const sumBy = (m: PayMethod): number => settled.filter((t: Txn): boolean => t.method === m).reduce((s: number, t: Txn): number => s + t.amount, 0);
  const collected = settled.reduce((s: number, t: Txn): number => s + t.amount, 0);
  const dropsTotal = drops.reduce((s: number, d: CashDrop): number => s + d.amount, 0);
  const cashExpected = sumBy("Cash") - dropsTotal;

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

  const recordDrop = (drop: CashDrop): void => {
    setDrops((prev: CashDrop[]): CashDrop[] => [...prev, drop]);
    setDropOpen(false);
    void message.success(`Cash drop of ${inr(drop.amount)} recorded (${drop.reason}).`);
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

  const submitClose = (): void => {
    if (shiftId.trim() === "" || physicalCash === null) {
      void message.error("Enter the shift ID and counted cash.");
      return;
    }
    client
      .closeShift({ shift_id: shiftId.trim(), physical_cash_minor: Math.round(physicalCash * 100), notes: closeNote.trim() === "" ? null : closeNote.trim() })
      .then((report: ZReportDto): void => {
        setZReport(report);
        setZLocal(null);
        setCloseOpen(false);
        void message.success(`Shift ${shiftId} closed.`);
      })
      .catch((): void => {
        // Offline/demo fallback: summarize local settled txns.
        setZLocal(buildLocalZ(txns));
        setZReport(null);
        setCloseOpen(false);
        void message.success("Shift closed locally (offline) - see summary.");
      });
  };

  const exportCsv = (): void => {
    const csv = buildPaymentsCsv(rows);
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
              <Button block onClick={(): void => setUpiOpen(true)}>
                Generate UPI QR
              </Button>
              <Button block onClick={(): void => setRefundKey(settled[0]?.key ?? null)} disabled={settled.length === 0}>
                Process Refund
              </Button>
              <Button block onClick={(): void => { setCounted(cashExpected); setCashOpen(true); }}>
                Cash Variance
              </Button>
              <Button block onClick={(): void => setDropOpen(true)}>
                Cash Drop
              </Button>
              <Button block onClick={runRecon}>
                Reconcile All
              </Button>
              <Button block onClick={exportCsv}>
                Export CSV
              </Button>
              <Button block type="primary" onClick={(): void => setCloseOpen(true)}>
                Close Shift
              </Button>
            </Space>
          </Card>
          <FraudAlerts
            alerts={[
              { id: "a-1", kind: "warning", message: "Refund velocity", description: "3 refunds above ₹2,000 by the same cashier in the last hour." },
              { id: "a-2", kind: "error", message: "Payout shortfall", description: "Zomato payout is short by ₹1,240 against expected settlement." },
            ]}
          />
          {drops.length > 0 && (
            <Card title="Cash Drops" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                {drops.map((d: CashDrop, i: number): React.ReactNode => (
                  <Typography.Text key={i}>
                    {inr(d.amount)} · {d.reason}
                    {d.note !== "" ? ` · ${d.note}` : ""}
                  </Typography.Text>
                ))}
                <Typography.Text strong>Total dropped: {inr(dropsTotal)}</Typography.Text>
              </Space>
            </Card>
          )}
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

      <CashDropModal open={dropOpen} onClose={(): void => setDropOpen(false)} onSubmit={recordDrop} />

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

      <UpiQrModal
        open={upiOpen}
        onClose={(): void => setUpiOpen(false)}
        pa="store@upi"
        pn="Plinth Store"
      />

      <Modal title="Close Shift" open={closeOpen} onOk={submitClose} onCancel={(): void => setCloseOpen(false)} okText="Close Shift">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input placeholder="Shift ID (e.g. SHIFT-2026-09-25-M1)" value={shiftId} onChange={(e): void => setShiftId(e.target.value)} />
          <InputNumber min={0} prefix="₹" placeholder="Counted cash" value={physicalCash} onChange={(v: number | null): void => setPhysicalCash(v)} style={{ width: "100%" }} />
          <Input placeholder="Note (optional)" value={closeNote} onChange={(e): void => setCloseNote(e.target.value)} />
        </Space>
      </Modal>

      {(zReport !== null || zLocal !== null) && (
        <Card
          title="Z-Report"
          style={{ marginTop: 16 }}
          extra={
            <Button size="small" onClick={(): void => window.print()}>
              Print
            </Button>
          }
        >
          {zReport !== null ? (
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="Shift">{zReport.shift_id}</Descriptions.Item>
              <Descriptions.Item label="Closed">{zReport.closed_at}</Descriptions.Item>
              <Descriptions.Item label="Gross sales">{inr(zReport.gross_sales / 100)}</Descriptions.Item>
              <Descriptions.Item label="Net sales">{inr(zReport.net_sales / 100)}</Descriptions.Item>
              <Descriptions.Item label="Tax">{inr(zReport.total_tax / 100)}</Descriptions.Item>
              <Descriptions.Item label="Discounts">{inr(zReport.total_discounts / 100)}</Descriptions.Item>
              <Descriptions.Item label="Physical cash">{inr(zReport.physical_cash / 100)}</Descriptions.Item>
              <Descriptions.Item label="Expected cash">{inr(zReport.expected_cash / 100)}</Descriptions.Item>
              <Descriptions.Item label="Variance">{inr(zReport.variance / 100)}</Descriptions.Item>
              <Descriptions.Item label="Tenders">
                {zReport.tender_breakdown.map(([m, amt]): string => `${m}: ${inr(amt / 100)}`).join(" · ")}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="Gross (local)">{inr(zLocal?.gross ?? 0)}</Descriptions.Item>
              <Descriptions.Item label="Refunded">{inr(zLocal?.refunded ?? 0)}</Descriptions.Item>
              {Object.entries(zLocal?.byMethod ?? {}).map(([m, amt]): React.ReactNode => (
                <Descriptions.Item key={m} label={m}>
                  {inr(amt)}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}
        </Card>
      )}
    </div>
  );
};
