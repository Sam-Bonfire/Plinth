import { KDSTicketCard, PlinthEmptyState, mockKitchenTickets, type KDSTicketItem, type KitchenTicketItem } from "@plinth/ui-kit";
import { Button, Card, Col, Row, Space, Statistic, Typography, message } from "antd";
import React, { useMemo, useState } from "react";

type Sla = "OnTime" | "Warning" | "Late";

interface TicketView {
  id: string;
  kot: number;
  kotLabel: string;
  station: string;
  channel: string;
  tableName: string;
  elapsedSeconds: number;
  sla: Sla;
  items: KDSTicketItem[];
}

const SLA_MAP: Record<string, Sla> = { "On-Time": "OnTime", Warning: "Warning", Late: "Late" };

const toView = (t: { id: string; kotNumber: string; stationName: string; channel: string; tableName: string; elapsedMinutes: number; timeStatus: string; items: KitchenTicketItem[] }): TicketView => ({
  id: t.id,
  kot: Number(t.kotNumber.replace("KOT-", "")),
  kotLabel: t.kotNumber,
  station: t.stationName,
  channel: t.channel,
  tableName: t.tableName,
  elapsedSeconds: t.elapsedMinutes * 60,
  sla: SLA_MAP[t.timeStatus] ?? "OnTime",
  items: t.items.map((item: KitchenTicketItem, i: number): KDSTicketItem => ({
    id: `${t.id}-LI-${i}`,
    name: item.name,
    quantity: item.quantity,
    modifiers: item.modifiers,
  })),
});

const seedTickets = (): TicketView[] => mockKitchenTickets.map(toView);

const INJECT_TEMPLATES: { station: string; channel: string; tableName: string; name: string; quantity: number }[] = [
  { station: "Main Kitchen", channel: "Dine-in", tableName: "T-12", name: "Paneer Tikka Masala", quantity: 1 },
  { station: "Tandoor", channel: "Zomato", tableName: "ZM-4410", name: "Tandoori Roti", quantity: 4 },
  { station: "Beverages", channel: "Takeaway", tableName: "Counter", name: "Mango Lassi", quantity: 2 },
];

export const KitchenPage: React.FC = () => {
  const [tickets, setTickets] = useState<TicketView[]>(seedTickets);
  const [bumpedToday, setBumpedToday] = useState<number>(389);
  const [kotSeq, setKotSeq] = useState<number>(45);
  const [injectIdx, setInjectIdx] = useState<number>(0);

  const stations = useMemo((): string[] => {
    const names = tickets.map((t: TicketView): string => t.station);
    return [...new Set(names)];
  }, [tickets]);

  const openCount = tickets.length;
  const lateCount = tickets.filter((t: TicketView): boolean => t.sla === "Late").length;
  const avgMinutes = openCount === 0 ? 0 : tickets.reduce((s: number, t: TicketView): number => s + t.elapsedSeconds, 0) / openCount / 60;

  const bump = (ticket: TicketView): void => {
    setTickets((prev: TicketView[]): TicketView[] => prev.filter((t: TicketView): boolean => t.id !== ticket.id));
    setBumpedToday((n: number): number => n + 1);
    void message.success(`${ticket.kotLabel} bumped.`);
  };

  const inject = (): void => {
    const tpl = INJECT_TEMPLATES[injectIdx % INJECT_TEMPLATES.length];
    const ticket: TicketView = {
      id: `KT-INJ-${kotSeq}`,
      kot: kotSeq,
      kotLabel: `KOT-0${kotSeq}`,
      station: tpl.station,
      channel: tpl.channel,
      tableName: tpl.tableName,
      elapsedSeconds: 0,
      sla: "OnTime",
      items: [{ id: `KT-INJ-${kotSeq}-LI-0`, name: tpl.name, quantity: tpl.quantity }],
    };
    setTickets((prev: TicketView[]): TicketView[] => [...prev, ticket]);
    setKotSeq((n: number): number => n + 1);
    setInjectIdx((n: number): number => n + 1);
    void message.info(`Test order ${ticket.kotLabel} injected.`);
  };

  const refresh = (): void => {
    setTickets(seedTickets());
    void message.success("Board refreshed from the pass.");
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space size="large">
              <Statistic title="Open" value={openCount} />
              <Statistic title="Late" value={lateCount} valueStyle={lateCount > 0 ? { color: "var(--r)" } : undefined} />
              <Statistic title="Avg prep" value={`${avgMinutes.toFixed(0)}m`} />
              <Statistic title="Bumped today" value={bumpedToday} valueStyle={{ color: "var(--g)" }} />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button onClick={inject}>+ Inject Test Order</Button>
              <Button onClick={refresh}>Refresh</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      {openCount === 0 ? (
        <Card>
          <PlinthEmptyState preset="no-kds-tickets" />
        </Card>
      ) : (
        <Row gutter={16}>
          {stations.map((station: string): React.ReactNode => {
            const stationTickets = tickets.filter((t: TicketView): boolean => t.station === station);
            return (
              <Col span={8} key={station}>
                <Typography.Title level={5}>
                  {station} · {stationTickets.length}
                </Typography.Title>
                {stationTickets.map((t: TicketView): React.ReactNode => (
                  <KDSTicketCard
                    key={t.id}
                    ticketId={t.id}
                    kotNumber={t.kot}
                    channel={t.channel}
                    tableName={t.tableName}
                    elapsedSeconds={t.elapsedSeconds}
                    slaStatus={t.sla}
                    items={t.items}
                    onBump={(): void => bump(t)}
                  />
                ))}
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};
