import { CheckCircleOutlined } from "@ant-design/icons";
import { Alert, Spin, Button, Card, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography, message, type TableColumnsType } from "antd";
import React, { useState } from "react";
import { loadRoleMatrix } from "../lib/roleMatrix.js";
import { useAuth } from "../providers/AuthProvider.js";

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







const roleColor = (r: Role): string => (r === "Owner" ? "purple" : r === "Manager" ? "blue" : r === "Cashier" ? "green" : "orange");

export const StaffPage: React.FC = () => {
  const { client } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [perms, setPerms] = useState<RoleMatrix>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [form] = Form.useForm<StaffFormValues>();
  const [escalations, setEscalations] = useState<EscalationRequest[]>([]);
  const [escStaffKey, setEscStaffKey] = useState<string | null>(null);
  const [escRole, setEscRole] = useState<Role>("Manager");
  const [escReason, setEscReason] = useState<string>("");
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [staffRes, attendanceRes, matrix] = await Promise.all([
        client.listStaff(),
        client.listAttendance(),
        loadRoleMatrix(client)
      ]);

      setStaff(staffRes.data.map(s => ({
        key: s.id,
        name: s.name,
        role: s.role as Role,
        outlet: s.location_id,
        shift: "Morning",
        ordersToday: 0,
        lastAction: "Active",
        status: s.is_active ? "Active" : "Off duty"
      })));

      setAttendanceEntries(attendanceRes.data.map(a => ({
        key: a.id,
        staffKey: a.staff_id,
        name: a.name,
        clockIn: a.clock_in,
        clockOut: a.clock_out ?? null
      })));

      setPerms(matrix);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleClockIn = async (member: StaffMember): Promise<void> => {
    try {
      await client.recordAttendance({ staff_id: member.key, action: "CLOCK_IN" });
      void message.success(`${member.name} clocked in.`);
      void loadData();
    } catch (err) {
      void message.error(`Failed to clock in: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleClockOut = async (member: StaffMember): Promise<void> => {
    try {
      await client.recordAttendance({ staff_id: member.key, action: "CLOCK_OUT" });
      void message.success(`${member.name} clocked out.`);
      void loadData();
    } catch (err) {
      void message.error(`Failed to clock out: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

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
          perms[row.capability]?.[role] ? <CheckCircleOutlined style={{ color: "#52c41a" }} /> : null
        ),
      }),
    ),
  ];

  return (
    <div>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      <Spin spinning={loading}>
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
              <Card
                title="Role Permissions Matrix"
                extra={
                  null
                }
              >
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
      </Spin>
    </div>
  );
};
