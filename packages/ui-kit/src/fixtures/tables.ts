export interface FloorTable {
  id: string;
  name: string;
  capacity: number;
  status: "Available" | "Occupied" | "Reserved";
}

export interface FloorSection {
  id: string;
  name: string;
  tables: FloorTable[];
}

export const mockFloorSections: FloorSection[] = [
  {
    id: "FS-01",
    name: "Main Hall",
    tables: Array.from({ length: 8 }, (_, i) => ({
      id: `T-0${i + 1}`,
      name: `Table T-0${i + 1}`,
      capacity: 4,
      status: i % 3 === 0 ? "Occupied" : "Available",
    })),
  },
  {
    id: "FS-02",
    name: "Outdoor Patio",
    tables: Array.from({ length: 6 }, (_, i) => ({
      id: `P-0${i + 1}`,
      name: `Table P-0${i + 1}`,
      capacity: 2,
      status: i === 1 ? "Reserved" : "Available",
    })),
  },
  {
    id: "FS-03",
    name: "VIP Lounge",
    tables: Array.from({ length: 3 }, (_, i) => ({
      id: `V-0${i + 1}`,
      name: `Table V-0${i + 1}`,
      capacity: 6,
      status: "Available",
    })),
  },
];
