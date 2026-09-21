import { describe, it, expect, beforeEach } from "vitest";
import { useStaffStore, selectSelected, selectActiveMembers, selectCan } from "./staffStore.js";
import type { StaffMember } from "./staffStore.js";

function member(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: "staff-1",
    name: "Mina",
    role: "Manager",
    permissions: 0b1111,
    isActive: true,
    ...overrides,
  };
}

describe("StaffStore", () => {
  beforeEach(() => {
    useStaffStore.getState().reset();
  });

  it("sets members and clears a stale selection", () => {
    useStaffStore.getState().setMembers([member()]);
    useStaffStore.getState().select("staff-1");
    expect(selectSelected(useStaffStore.getState())?.name).toBe("Mina");
    useStaffStore.getState().setMembers([member({ id: "staff-2", name: "Raj" })]);
    expect(useStaffStore.getState().selectedId).toBeNull();
  });

  it("upserts without duplicating", () => {
    useStaffStore.getState().setMembers([member()]);
    useStaffStore.getState().upsertMember(member({ name: "Mina Rao" }));
    expect(useStaffStore.getState().members).toHaveLength(1);
    expect(useStaffStore.getState().members[0]?.name).toBe("Mina Rao");
    useStaffStore.getState().upsertMember(member({ id: "staff-2", name: "Raj" }));
    expect(useStaffStore.getState().members).toHaveLength(2);
  });

  it("removes members and clears selection", () => {
    useStaffStore.getState().setMembers([member(), member({ id: "staff-2" })]);
    useStaffStore.getState().select("staff-2");
    useStaffStore.getState().removeMember("staff-2");
    expect(useStaffStore.getState().members).toHaveLength(1);
    expect(useStaffStore.getState().selectedId).toBeNull();
  });

  it("toggles active flag and filters active members", () => {
    useStaffStore.getState().setMembers([member(), member({ id: "staff-2" })]);
    useStaffStore.getState().setActive("staff-2", false);
    expect(selectActiveMembers(useStaffStore.getState())).toHaveLength(1);
  });

  it("checks permission bits only for active members", () => {
    useStaffStore.getState().setMembers([member({ permissions: 0b1010 })]);
    expect(selectCan(useStaffStore.getState(), "staff-1", 0b1000)).toBe(true);
    expect(selectCan(useStaffStore.getState(), "staff-1", 0b0100)).toBe(false);
    expect(selectCan(useStaffStore.getState(), "missing", 0b1000)).toBe(false);
    useStaffStore.getState().setActive("staff-1", false);
    expect(selectCan(useStaffStore.getState(), "staff-1", 0b1000)).toBe(false);
  });
});
