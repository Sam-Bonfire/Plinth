import { Button, Card, Checkbox, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography, message, type TableColumnsType } from "antd";
import React, { useMemo, useState } from "react";
import { buildAuditCsv } from "../lib/auditExport.js";

type Role = "Owner" | "Manager" | "Cashier" | "Kitchen";
type StaffStatus = "Active" | "Off duty";

interface StaffMember {
  key: string;
  name: string;
  role: Role;
  outlet: string;
  shift: string;
  ordersToday: number;
  lastAction: string;
  status: StaffStatus;
}

interface AuditEntry {
  key: string;
  time: string;
  actor: string;
  role: Role;
  action: string;
  kind: string;
  target: string;
  value: string;
  approvedBy: string;
  flag: "OK" | "Review";
}

export interface AttendanceEntry {
  key: string;
  staffKey: string;
  name: string;
  clockIn: string; // ISO string
  clockOut: string | null; // ISO string or null if still clocked in
}

export function shiftHours(entries: AttendanceEntry[], nowMs: number = Date.now()): number {
  return entries.reduce((total, entry) => {
    const start = new Date(entry.clockIn).getTime();
    const end = entry.clockOut ? new Date(entry.clockOut).getTime() : nowMs;
    const diff = Math.max(0, end - start);
    return total + diff / (1000 * 60 * 60);
  }, 0);
}

interface StaffFormValues {
  name: string;
  role: Role;
  outlet: string;
  shift: string;
  status: StaffStatus;
}

type EscalationStatus = "Pending" | "Approved" | "Rejected";

interface EscalationRequest {
  key: string;
  staffKey: string;
  name: string;
  fromRole: Role;
  toRole: Role;
  reason: string;
  status: EscalationStatus;
}

const ROLES: Role[] = ["Owner", "Manager", "Cashier", "Kitchen"];
const OUTLETS: string[] = ["Koramangala", "Indiranagar", "HSR Layout"];
const CAPABILITIES: string[] = [
  "Open and close till",
  "Apply discounts",
  "Void orders",
  "Process refunds",
  "Edit menu",
  "View reports",
  "Manage staff",
  "Bump KDS tickets",
];

const seedStaff = (): StaffMember[] => [
  { key: "ST-01", name: "Rajesh K", role: "Manager", outlet: "Koramangala", shift: "Morning", ordersToday: 142, lastAction: "Discount 10% · ORD-1098", status: "Active" },
  { key: "ST-02", name: "Meera S", role: "Cashier", outlet: "Koramangala", shift: "Morning", ordersToday: 118, lastAction: "Tender UPI · ORD-1099", status: "Active" },
  { key: "ST-03", name: "Arun V", role: "Kitchen", outlet: "Koramangala", shift: "Evening", ordersToday: 0, lastAction: "Bump KOT-042", status: "Active" },
  { key: "ST-04", name: "Divya R", role: "Cashier", outlet: "Indiranagar", shift: "Evening", ordersToday: 64, lastAction: "Login 16:02", status: "Off duty" },
];

const seedPerms = (): Record<string, Record<Role, boolean>> => ({
  "Open and close till": { Owner: true, Manager: true, Cashier: true, Kitchen: false },
  "Apply discounts": { Owner: true, Manager: true, Cashier: false, Kitchen: false },
  "Void orders": { Owner: true, Manager: true, Cashier: false, Kitchen: false },
  "Process refunds": { Owner: true, Manager: true, Cashier: false, Kitchen: false },
  "Edit menu": { Owner: true, Manager: true, Cashier: false, Kitchen: false },
  "View reports": { Owner: true, Manager: true, Cashier: false, Kitchen: false },
  "Manage staff": { Owner: true, Manager: false, Cashier: false, Kitchen: false },
  "Bump KDS tickets": { Owner: true, Manager: true, Cashier: false, Kitchen: true },
});

const seedAudit = (): AuditEntry[] => [
  { key: "A-01", time: "12:14", actor: "Rajesh K", role: "Manager", action: "Discount 10%", kind: "Discounts", target: "ORD-1098", value: "-₹61", approvedBy: "Self", flag: "OK" },
  { key: "A-02", time: "12:02", actor: "Meera S", role: "Cashier", action: "Void item", kind: "Voids", target: "ORD-1101", value: "Gulab Jamun ×1", approvedBy: "Rajesh K", flag: "Review" },
  { key: "A-03", time: "11:55", actor: "Meera S", role: "Cashier", action: "Refund", kind: "Refunds", target: "TXN-9002", value: "₹619.50", approvedBy: "Rajesh K", flag: "OK" },
  { key: "A-04", time: "11:38", actor: "Divya R", role: "Cashier", action: "Login", kind: "Logins", target: "POS-02", value: "PIN", approvedBy: "—", flag: "OK" },
  { key: "A-05", time: "10:20", actor: "Rajesh K", role: "Manager", action: "86 Gulab Jamun", kind: "Menu changes", target: "MI-006", value: "Unavailable", approvedBy: "Self", flag: "OK" },
];

const seedAttendance = (): AttendanceEntry[] => [
  { key: "ATT-01", staffKey: "ST-01", name: "Rajesh K", clockIn: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), clockOut: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() }, // Normal completed shift (3 hours)
  { key: "ATT-02", staffKey: "ST-02", name: "Meera S", clockIn: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), clockOut: null }, // Missing-out shift (clocked in 2 hours ago)
  { key: "ATT-03", staffKey: "ST-03", name: "Arun V", clockIn: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(), clockOut: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }, // Overnight/long shift (8 hours)
];

const roleColor = (r: Role): string => (r === "Owner" ? "purple" : r === "Manager" ? "blue" : r === "Cashier" ? "green" : "orange");

export const StaffPage: React.FC = () => {
  const [staff, setStaff] = useState<StaffMember[]>(seedStaff);
  const [perms, setPerms] = useState<Record<string, Record<Role, boolean>>>(seedPerms);
  const [auditKind, setAuditKind] = useState<string>("all");
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [form] = Form.useForm<StaffFormValues>();
  const [escalations, setEscalations] = useState<EscalationRequest[]>([]);
  const [escStaffKey, setEscStaffKey] = useState<string | null>(null);
  const [escRole, setEscRole] = useState<Role>("Manager");
  const [escReason, setEscReason] = useState<string>("");
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>(seedAttendance);

  const handleClockIn = (member: StaffMember): void => {
    const entry: AttendanceEntry = {
      key: `ATT-${Date.now()}`,
      staffKey: member.key,
      name: member.name,
      clockIn: new Date().toISOString(),
      clockOut: null,
    };
    setAttendanceEntries((prev) => [...prev, entry]);
    void message.success(`${member.name} clocked in.`);
  };

  const handleClockOut = (member: StaffMember): void => {
    setAttendanceEntries((prev) => {
      const reversed = [...prev].reverse();
      const index = reversed.findIndex(e => e.staffKey === member.key && e.clockOut === null);
      if (index !== -1) {
        const actualIndex = prev.length - 1 - index;
        const newEntries = [...prev];
        newEntries[actualIndex] = { ...newEntries[actualIndex], clockOut: new Date().toISOString() };
        return newEntries;
      }
      return prev;
    });
    void message.success(`${member.name} clocked out.`);
  };

  const auditRows = useMemo(
    (): AuditEntry[] => seedAudit().filter((a: AuditEntry): boolean => auditKind === "all" || a.kind === auditKind),
    [auditKind],
  );

  const openAdd = (): void => {
    form.setFieldsValue({ name: "", role: "Cashier", outlet: OUTLETS[0], shift: "Morning", status: "Active" });
    setEditing("new");
  };

  const openEdit = (m: StaffMember): void => {
    form.setFieldsValue({ name: m.name, role: m.role, outlet: m.outlet, shift: m.shift, status: m.status });
    setEditing(m);
  };

  const saveMember = (values: StaffFormValues): void => {
    if (editing === "new") {
      const key = `ST-${staff.length + 1}-${values.name.length}`;
      setStaff((prev: StaffMember[]): StaffMember[] => [...prev, { key, ordersToday: 0, lastAction: "Joined today", ...values }]);
      void message.success(`Staff member ${values.name} added.`);
    } else if (editing !== null) {
      setStaff((prev: StaffMember[]): StaffMember[] => prev.map((m: StaffMember): StaffMember => (m.key === editing.key ? { ...m, ...values } : m)));
      void message.success(`Staff member ${values.name} updated.`);
    }
    setEditing(null);
  };

  const togglePerm = (capability: string, role: Role, value: boolean): void => {
    setPerms((prev) => ({ ...prev, [capability]: { ...prev[capability], [role]: value } }));
  };

  const savePerms = (): void => {
    void message.success("Role permissions saved.");
  };

  const submitEscalation = (): void => {
    const member = staff.find((m: StaffMember): boolean => m.key === escStaffKey);
    if (!member || escReason.trim() === "" || member.role === escRole) {
      return;
    }
    const req: EscalationRequest = {
      key: `ESC-${escalations.length + 1}`,
      staffKey: member.key,
      name: member.name,
      fromRole: member.role,
      toRole: escRole,
      reason: escReason.trim(),
      status: "Pending",
    };
    setEscalations((prev: EscalationRequest[]): EscalationRequest[] => [...prev, req]);
    setEscReason("");
    void message.success(`Escalation requested for ${member.name}.`);
  };

  const resolveEscalation = (key: string, status: EscalationStatus): void => {
    setEscalations((prev: EscalationRequest[]): EscalationRequest[] =>
      prev.map((r: EscalationRequest): EscalationRequest => (r.key === key ? { ...r, status } : r)),
    );
    if (status === "Approved") {
      const req = escalations.find((r: EscalationRequest): boolean => r.key === key);
      if (req) {
        setStaff((prev: StaffMember[]): StaffMember[] =>
          prev.map((m: StaffMember): StaffMember => (m.key === req.staffKey ? { ...m, role: req.toRole } : m)),
        );
      }
    }
  };

  const exportAudit = (): void => {
    const csv = buildAuditCsv(auditRows);
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
    void message.success(`Exported ${auditRows.length} audit entries.`);
  };

  const staffColumns: TableColumnsType<StaffMember> = [
    { title: "Name", dataIndex: "name", key: "name", render: (n: string): React.ReactNode => <Typography.Text strong>{n}</Typography.Text> },
    { title: "Role", dataIndex: "role", key: "role", width: 110, render: (r: Role): React.ReactNode => <Tag color={roleColor(r)}>{r}</Tag> },
    { title: "Outlet", dataIndex: "outlet", key: "outlet", width: 130 },
    { title: "Shift", dataIndex: "shift", key: "shift", width: 100 },
    { title: "Orders Today", dataIndex: "ordersToday", key: "ordersToday", width: 120, align: "right" },
    { title: "Last Action", dataIndex: "lastAction", key: "lastAction" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: StaffStatus): React.ReactNode => <Tag color={s === "Active" ? "success" : "default"}>{s}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      render: (_: unknown, row: StaffMember): React.ReactNode => (
        <Button size="small" onClick={(): void => openEdit(row)}>
          Edit
        </Button>
      ),
    },
  ];

  const permColumns: TableColumnsType<{ key: string; capability: string }> = [
    { title: "Capability", dataIndex: "capability", key: "capability" },
    ...ROLES.map(
      (role: Role) => ({
        title: role,
        key: role,
        width: 110,
        align: "center" as const,
        render: (_: unknown, row: { key: string; capability: string }): React.ReactNode => (
          <Checkbox checked={perms[row.capability]?.[role] ?? false} onChange={(e): void => togglePerm(row.capability, role, e.target.checked)} />
        ),
      }),
    ),
  ];

  const auditColumns: TableColumnsType<AuditEntry> = [
    { title: "Time", dataIndex: "time", key: "time", width: 70 },
    { title: "Actor", dataIndex: "actor", key: "actor", width: 110 },
    { title: "Role", dataIndex: "role", key: "role", width: 100, render: (r: Role): React.ReactNode => <Tag color={roleColor(r)}>{r}</Tag> },
    { title: "Action", dataIndex: "action", key: "action" },
    { title: "Target", dataIndex: "target", key: "target", width: 110 },
    { title: "Value", dataIndex: "value", key: "value", width: 130 },
    { title: "Approved By", dataIndex: "approvedBy", key: "approvedBy", width: 110 },
    {
      title: "Flag",
      dataIndex: "flag",
      key: "flag",
      width: 100,
      render: (f: "OK" | "Review"): React.ReactNode => <Tag color={f === "OK" ? "success" : "warning"}>{f}</Tag>,
    },
  ];

  return (
    <div>
      <Tabs
        defaultActiveKey="list"
        tabBarExtraContent={
          <Button type="primary" size="small" onClick={openAdd}>
            + Add Staff
          </Button>
        }
        items={[
          {
            key: "list",
            label: "Staff List",
            children: (
              <Card>
                <Table<StaffMember> dataSource={staff} columns={staffColumns} rowKey="key" pagination={false} size="small" />
              </Card>
            ),
          },
          {
            key: "perms",
            label: "Permissions",
            children: (
              <Card title="Role Permissions Matrix" extra={<Button size="small" onClick={savePerms}>Save Changes</Button>}>
                <Table<{ key: string; capability: string }>
                  dataSource={CAPABILITIES.map((c: string) => ({ key: c, capability: c }))}
                  columns={permColumns}
                  rowKey="key"
                  pagination={false}
                  size="small"
                />
              </Card>
            ),
          },
          {
            key: "escalations",
            label: `Escalations${escalations.filter((r: EscalationRequest): boolean => r.status === "Pending").length > 0 ? ` (${escalations.filter((r: EscalationRequest): boolean => r.status === "Pending").length})` : ""}`,
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <Card title="Request Role Escalation">
                  <Space wrap>
                    <Select
                      value={escStaffKey}
                      onChange={(v): void => setEscStaffKey(v as string)}
                      options={staff.map((m: StaffMember) => ({ label: `${m.name} · ${m.role}`, value: m.key }))}
                      style={{ width: 220 }}
                      placeholder="Select staff member"
                    />
                    <Select
                      value={escRole}
                      onChange={(v): void => setEscRole(v as Role)}
                      options={ROLES.map((r: Role) => ({ label: r, value: r }))}
                      style={{ width: 140 }}
                      placeholder="Target role"
                    />
                    <Input
                      value={escReason}
                      onChange={(e): void => setEscReason(e.target.value)}
                      placeholder="Reason for escalation…"
                      style={{ width: 240 }}
                    />
                    <Button type="primary" size="small" onClick={submitEscalation}>
                      Submit Request
                    </Button>
                  </Space>
                </Card>
                <Card title="Escalation Requests">
                  <Table<EscalationRequest>
                    dataSource={escalations}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: "No escalation requests." }}
                    columns={[
                      { title: "Staff", dataIndex: "name", key: "name" },
                      {
                        title: "Change",
                        key: "change",
                        render: (_: unknown, row: EscalationRequest): React.ReactNode => (
                          <Typography.Text>
                            {row.fromRole} → {row.toRole}
                          </Typography.Text>
                        ),
                      },
                      { title: "Reason", dataIndex: "reason", key: "reason" },
                      {
                        title: "Status",
                        dataIndex: "status",
                        key: "status",
                        width: 110,
                        render: (s: EscalationStatus): React.ReactNode => (
                          <Tag color={s === "Pending" ? "processing" : s === "Approved" ? "success" : "default"}>{s}</Tag>
                        ),
                      },
                      {
                        title: "Action",
                        key: "action",
                        width: 170,
                        render: (_: unknown, row: EscalationRequest): React.ReactNode =>
                          row.status === "Pending" ? (
                            <Space>
                              <Button size="small" type="primary" onClick={(): void => resolveEscalation(row.key, "Approved")}>
                                Approve
                              </Button>
                              <Button size="small" danger onClick={(): void => resolveEscalation(row.key, "Rejected")}>
                                Reject
                              </Button>
                            </Space>
                          ) : null,
                      },
                    ]}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: "attendance",
            label: "Attendance",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <Card title="Clock In / Clock Out">
                  <Table<StaffMember>
                    dataSource={staff}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: "Name", dataIndex: "name", key: "name", render: (n: string): React.ReactNode => <Typography.Text strong>{n}</Typography.Text> },
                      { title: "Role", dataIndex: "role", key: "role", render: (r: Role): React.ReactNode => <Tag color={roleColor(r)}>{r}</Tag> },
                      {
                        title: "Action",
                        key: "action",
                        render: (_: unknown, row: StaffMember): React.ReactNode => {
                          const isClockedIn = attendanceEntries.some(e => e.staffKey === row.key && e.clockOut === null);
                          return (
                            <Space>
                              <Button size="small" type="primary" onClick={() => handleClockIn(row)} disabled={isClockedIn}>
                                Clock In
                              </Button>
                              <Button size="small" danger onClick={() => handleClockOut(row)} disabled={!isClockedIn}>
                                Clock Out
                              </Button>
                            </Space>
                          );
                        }
                      }
                    ]}
                  />
                </Card>
                <Card title="Daily Attendance Log">
                  <Table<AttendanceEntry>
                    dataSource={attendanceEntries}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: "Staff", dataIndex: "name", key: "name", render: (n: string): React.ReactNode => <Typography.Text strong>{n}</Typography.Text> },
                      { title: "Clock In", dataIndex: "clockIn", key: "clockIn", render: (v: string): string => new Date(v).toLocaleTimeString() },
                      { title: "Clock Out", dataIndex: "clockOut", key: "clockOut", render: (v: string | null): string => v ? new Date(v).toLocaleTimeString() : "Active" },
                      {
                        title: "Hours",
                        key: "hours",
                        render: (_: unknown, row: AttendanceEntry): string => shiftHours([row]).toFixed(2)
                      }
                    ]}
                  />
                </Card>
              </Space>
            )
          },
          {
            key: "audit",
            label: "Audit Log",
            children: (
              <Card
                title="Audit Log"
                extra={
                  <Space>
                    <Select
                      value={auditKind}
                      onChange={(v): void => setAuditKind(v as string)}
                      options={["all", "Discounts", "Voids", "Refunds", "Logins", "Menu changes"].map((k: string) => ({ label: k === "all" ? "All actions" : k, value: k }))}
                      style={{ width: 150 }}
                    />
                    <Button size="small" onClick={exportAudit}>
                      Export
                    </Button>
                  </Space>
                }
              >
                <Table<AuditEntry> dataSource={auditRows} columns={auditColumns} rowKey="key" pagination={false} size="small" locale={{ emptyText: "No audit entries for this filter." }} />
              </Card>
            ),
          },
        ]}
      />

      <Modal title={editing === "new" ? "Add Staff Member" : "Edit Staff Member"} open={editing !== null} onOk={(): void => { void form.submit(); }} onCancel={(): void => setEditing(null)} okText="Save">
        <Form form={form} layout="vertical" onFinish={saveMember} preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Staff name" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={ROLES.map((r: Role) => ({ label: r, value: r }))} />
          </Form.Item>
          <Form.Item name="outlet" label="Outlet" rules={[{ required: true }]}>
            <Select options={OUTLETS.map((o: string) => ({ label: o, value: o }))} />
          </Form.Item>
          <Form.Item name="shift" label="Shift" rules={[{ required: true }]}>
            <Select options={["Morning", "Evening", "Night"].map((s: string) => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select options={["Active", "Off duty"].map((s: string) => ({ label: s, value: s }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
