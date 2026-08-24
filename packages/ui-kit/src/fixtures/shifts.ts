export interface ShiftReport {
  shiftId: string;
  floatAmount: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  expectedTillAmount: number;
  actualTillAmount?: number;
  tillVariance?: number;
}

export const mockShiftReport: ShiftReport = {
  shiftId: "SH-881",
  floatAmount: 5000,
  cashSales: 18420,
  upiSales: 42950,
  cardSales: 31200,
  expectedTillAmount: 23420, // 5000 + 18420
  actualTillAmount: 23400,
  tillVariance: -20,
};
