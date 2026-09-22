import { describe, it, expect, beforeEach } from "vitest";
import { usePaymentsStore, selectCashShare } from "./paymentsStore.js";
import { useEodStore, selectVariance, selectIsClosed } from "./eodStore.js";
import { useReportsStore, selectPeriodLabel } from "./reportsStore.js";

describe("PaymentsStore", () => {
  beforeEach(() => {
    usePaymentsStore.getState().reset();
  });

  it("tracks totals and computes cash share", () => {
    expect(selectCashShare(usePaymentsStore.getState())).toBe(0);
    usePaymentsStore.getState().setTotals({ collected: 1000, upi: 500, card: 300, cash: 200 });
    expect(selectCashShare(usePaymentsStore.getState())).toBe(0.2);
    usePaymentsStore.getState().setMethodFilter("Cash");
    usePaymentsStore.getState().setQuery("TXN");
    expect(usePaymentsStore.getState().methodFilter).toBe("Cash");
    expect(usePaymentsStore.getState().query).toBe("TXN");
  });
});

describe("EodStore", () => {
  beforeEach(() => {
    useEodStore.getState().reset();
  });

  it("walks a shift from open to close", () => {
    expect(selectVariance(useEodStore.getState())).toBeNull();
    expect(selectIsClosed(useEodStore.getState())).toBe(false);
    useEodStore.getState().openShift({
      shiftId: "sh-1",
      openedAt: "2026-09-22T08:00:00Z",
      openingFloat: 2000,
      expectedCash: 15000,
      countedCash: null,
    });
    useEodStore.getState().recordCount(14900);
    expect(selectVariance(useEodStore.getState())).toBe(-100);
    useEodStore.getState().closeShift("2026-09-22T23:00:00Z");
    expect(selectIsClosed(useEodStore.getState())).toBe(true);
  });

  it("ignores counts without an open shift", () => {
    useEodStore.getState().recordCount(100);
    expect(useEodStore.getState().shift).toBeNull();
  });
});

describe("ReportsStore", () => {
  beforeEach(() => {
    useReportsStore.getState().reset();
  });

  it("switches periods with labels", () => {
    useReportsStore.getState().setPeriod("week");
    expect(selectPeriodLabel(useReportsStore.getState())).toBe("Last 7 days");
    useReportsStore.getState().setPeriod("month");
    expect(selectPeriodLabel(useReportsStore.getState())).toBe("Last 30 days");
  });
});
