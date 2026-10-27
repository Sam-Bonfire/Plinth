import { KDSTicketCard, PlinthEmptyState, type KDSTicketItem, type KitchenTicketDto } from "@plinth/ui-kit";
import { Alert, Button, Card, Col, List, Row, Space, Statistic, Typography, message } from "antd";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { buildReprintJob, type ReprintJob, type TicketView } from "../helpers/reprint.js";
import { useKdsTick } from "../hooks/useKdsTick.js";
import { useAuth } from "../providers/AuthProvider.js";

const STATION_LABELS: Record<string, string> = { MainKitchen: "Main Kitchen", ColdStation: "Cold Station" };

const stationLabel = (station: KitchenTicketDto["station"]): string =>
  typeof station === "string" ? (STATION_LABELS[station] ?? station) : "Custom";

/** Maps a backend ticket onto the board view (backend carries no channel/table, so show the order ref). */
export const mapDtoToView = (dto: KitchenTicketDto, nowMs: number = Date.now()): TicketView => {
  const createdMs = Date.parse(dto.created_at);
  const elapsedSeconds = Number.isNaN(createdMs) ? 0 : Math.max(0, Math.floor((nowMs - createdMs) / 1000));
  return {
    id: dto.id,
    kot: dto.kot_number,
    kotLabel: `KOT-${dto.kot_number}`,
    station: stationLabel(dto.station),
    channel: "—",
    tableName: `Order ${dto.order_id.slice(0, 8)}`,
    elapsedSeconds,
    sla: dto.sla_status,
    items: dto.items.map((item, i): KDSTicketItem => ({
      id: `${dto.id}-LI-${i}`,
      name: item.name,
      quantity: item.quantity,
      modifiers: item.modifiers.flatMap((m): string[] => m.selected_options),
      notes: item.special_instructions ?? undefined,
    })),
  };
};

export const KitchenPage: React.FC = () => {
  const { client } = useAuth();
  const [tickets, setTickets] = useState<TicketView[]>([]);
  const [live, setLive] = useState<boolean>(true);
  const [reprintLog, setReprintLog] = useState<ReprintJob[]>([]);

  const applyTick = useCallback((step: (prev: TicketView[]) => TicketView[]): void => {
    setTickets(step);
  }, []);
  useKdsTick<TicketView>(applyTick);

  const fetchLive = useCallback((): void => {
    client
      .listKitchenTickets()
      .then((dtos): void => {
        if (!Array.isArray(dtos)) throw new Error("Unexpected KDS payload");
        const nowMs = Date.now();
        setTickets(dtos.map((dto): TicketView => mapDtoToView(dto, nowMs)));
        setLive(true);
      })
      .catch((): void => {
        setTickets([]);
        setLive(false);
      });
  }, [client]);

  useEffect((): (() => void) => {
    fetchLive();
    const timer = setInterval(fetchLive, 15_000);
    return (): void => clearInterval(timer);
  }, [fetchLive]);

  const stations = useMemo((): string[] => {
    const names = tickets.map((t: TicketView): string => t.station);
    return [...new Set(names)];
  }, [tickets]);

  const openCount = tickets.length;
  const lateCount = tickets.filter((t: TicketView): boolean => t.sla === "Late").length;
  const avgMinutes = openCount === 0 ? 0 : tickets.reduce((s: number, t: TicketView): number => s + t.elapsedSeconds, 0) / openCount / 60;

  const bump = (ticket: TicketView): void => {
    client
      .bumpTicket(ticket.id)
      .then((): void => {
        setTickets((prev: TicketView[]): TicketView[] => prev.filter((t: TicketView): boolean => t.id !== ticket.id));
        void message.success(`${ticket.kotLabel} bumped.`);
      })
      .catch((err: unknown): void => {
        const msg = err instanceof Error ? err.message : "Bump failed";
        void message.error(msg);
      });
  };

  const reprint = (ticket: TicketView): void => {
    const job = buildReprintJob(ticket);
    setReprintLog((prev: ReprintJob[]): ReprintJob[] => [job, ...prev].slice(0, 5));
    void message.success(`${ticket.kotLabel} re-queued for printing.`);
  };

  const refresh = (): void => {
    fetchLive();
    void message.success("Board refreshed from the pass.");
  };

  return (
    <div>
      {!live && (
        <Alert
          message="Live kitchen service unreachable."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Card style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space size="large">
              <Statistic title="Open" value={openCount} />
              <Statistic title="Late" value={lateCount} valueStyle={lateCount > 0 ? { color: "var(--r)" } : undefined} />
              <Statistic title="Avg prep" value={`${avgMinutes.toFixed(0)}m`} />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button onClick={refresh}>Refresh</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      {reprintLog.length > 0 && (
        <Card style={{ marginBottom: 16 }} size="small" title="Recent Reprints">
          <List
            size="small"
            dataSource={reprintLog}
            renderItem={(item: ReprintJob): React.ReactNode => (
              <List.Item>
                <Typography.Text type="secondary">
                  {new Date(item.queuedAt).toLocaleTimeString()}
                </Typography.Text>
                {" - "}
                <Typography.Text strong>{item.ticketId}</Typography.Text>
                {" - "}
                <Typography.Text>{item.payload_lines.length - 1} items</Typography.Text>
              </List.Item>
            )}
          />
        </Card>
      )}
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
                <Typography.Title level={2} style={{ fontSize: 14 }}>
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
                    onReprint={(): void => reprint(t)}
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
