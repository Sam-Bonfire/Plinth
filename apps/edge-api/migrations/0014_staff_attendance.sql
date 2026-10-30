-- Migration: 0014_staff_attendance.sql

CREATE TABLE staff_attendance (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    clock_in TEXT NOT NULL,
    clock_out TEXT,
    created_at TEXT NOT NULL
);

-- Ensure a single active shift per staff at a time (e.g., uniqueness on active records by leaving clock_out NULL)
CREATE UNIQUE INDEX idx_staff_attendance_active ON staff_attendance(tenant_id, location_id, staff_id) WHERE clock_out IS NULL;
CREATE INDEX idx_staff_attendance_history ON staff_attendance(tenant_id, location_id, staff_id, clock_in DESC);
