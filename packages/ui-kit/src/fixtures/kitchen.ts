export interface KitchenTicketItem {
  name: string;
  quantity: number;
  modifiers?: string[];
}

export interface KitchenTicket {
  id: string;
  kotNumber: string;
  stationId: string;
  stationName: string;
  channel: string;
  tableName: string;
  status: "Pending" | "InPrep" | "Ready";
  timeStatus: "On-Time" | "Warning" | "Late";
  elapsedMinutes: number;
  items: KitchenTicketItem[];
}

export const mockKitchenTickets: KitchenTicket[] = [
  {
    id: "KT-001",
    kotNumber: "KOT-042",
    stationId: "ST-01",
    stationName: "Main Kitchen",
    channel: "Dine-in",
    tableName: "T-04",
    status: "InPrep",
    timeStatus: "Late",
    elapsedMinutes: 14,
    items: [
      { name: "Butter Chicken", quantity: 2, modifiers: ["Spicy"] },
      { name: "Dal Makhani", quantity: 1, modifiers: ["Full"] },
    ],
  },
  {
    id: "KT-002",
    kotNumber: "KOT-043",
    stationId: "ST-02",
    stationName: "Tandoor",
    channel: "Swiggy",
    tableName: "SW-9921",
    status: "InPrep",
    timeStatus: "Warning",
    elapsedMinutes: 6,
    items: [
      { name: "Garlic Naan", quantity: 2 },
    ],
  },
  {
    id: "KT-003",
    kotNumber: "KOT-044",
    stationId: "ST-03",
    stationName: "Beverages",
    channel: "Dine-in",
    tableName: "T-09",
    status: "Pending",
    timeStatus: "On-Time",
    elapsedMinutes: 2,
    items: [
      { name: "Mango Lassi", quantity: 2 },
    ],
  },
];
