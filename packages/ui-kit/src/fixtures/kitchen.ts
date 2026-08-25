export interface KitchenTicketItem {
  name: string;
  modifiers?: string[];
}

export interface KitchenTicket {
  id: string;
  kotNumber: string;
  stationId: string;
  stationName: string;
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
    status: "InPrep",
    timeStatus: "Late",
    elapsedMinutes: 14,
    items: [
      { name: "Butter Chicken", modifiers: ["Spicy"] },
      { name: "Dal Makhani", modifiers: ["Full"] },
    ],
  },
  {
    id: "KT-002",
    kotNumber: "KOT-043",
    stationId: "ST-02",
    stationName: "Tandoor",
    status: "InPrep",
    timeStatus: "Warning",
    elapsedMinutes: 6,
    items: [
      { name: "Garlic Naan" },
      { name: "Garlic Naan" },
    ],
  },
  {
    id: "KT-003",
    kotNumber: "KOT-044",
    stationId: "ST-03",
    stationName: "Beverages",
    status: "Pending",
    timeStatus: "On-Time",
    elapsedMinutes: 2,
    items: [
      { name: "Mango Lassi" },
    ],
  },
];
