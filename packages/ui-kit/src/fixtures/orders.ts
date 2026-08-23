export interface OrderTax {
  rate: number;
  amount: number;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  taxes: OrderTax[];
}

export interface Order {
  id: string;
  type: "DineIn" | "Takeaway" | "Aggregator";
  status: string;
  items: OrderItem[];
  subtotal: number;
  discount?: {
    name: string;
    percentage?: number;
    amount: number;
  };
  packagingCharge?: number;
  taxes: OrderTax[];
  total: number;
  tenderType?: "UPI" | "Card" | "Cash";
  server?: string;
  table?: string;
  aggregator?: "Swiggy" | "Zomato";
  aggregatorId?: string;
}

export const mockActiveDineInOrder: Order = {
  id: "ORD-1098",
  type: "DineIn",
  status: "InProgress",
  table: "T-04",
  server: "Rajesh K",
  items: [
    {
      id: "LI-01",
      name: "Butter Chicken",
      quantity: 1,
      price: 380,
      taxes: [{ rate: 5, amount: 19 }],
    },
    {
      id: "LI-02",
      name: "Garlic Naan",
      quantity: 2,
      price: 120, // 60 * 2
      taxes: [{ rate: 5, amount: 6 }],
    },
    {
      id: "LI-03",
      name: "Mango Lassi",
      quantity: 1,
      price: 110,
      taxes: [{ rate: 12, amount: 13.2 }],
    },
  ],
  subtotal: 610, // 380 + 120 + 110
  discount: {
    name: "Happy Hour",
    percentage: 10,
    amount: 61,
  },
  taxes: [
    { rate: 5, amount: 22.5 }, // (380+120) * 0.9 * 0.05
    { rate: 12, amount: 11.88 }, // 110 * 0.9 * 0.12
  ],
  total: 583.38,
};

export const mockTakeawayOrder: Order = {
  id: "ORD-1099",
  type: "Takeaway",
  status: "Completed",
  tenderType: "UPI",
  items: [
    {
      id: "LI-04",
      name: "Paneer Tikka",
      quantity: 2,
      price: 560,
      taxes: [{ rate: 5, amount: 28 }],
    },
  ],
  subtotal: 560,
  packagingCharge: 30,
  taxes: [{ rate: 5, amount: 29.5 }], // (560+30)*0.05
  total: 619.5,
};

export const mockAggregatorOrders: Order[] = [
  {
    id: "ORD-1100",
    type: "Aggregator",
    aggregator: "Swiggy",
    aggregatorId: "SW-9921",
    status: "InProgress",
    items: [
      {
        id: "LI-05",
        name: "Dal Makhani",
        quantity: 1,
        price: 240,
        taxes: [{ rate: 5, amount: 12 }],
      },
    ],
    subtotal: 240,
    taxes: [{ rate: 5, amount: 12 }],
    total: 252,
  },
  {
    id: "ORD-1101",
    type: "Aggregator",
    aggregator: "Zomato",
    aggregatorId: "ZM-4401",
    status: "Completed",
    items: [
      {
        id: "LI-06",
        name: "Gulab Jamun",
        quantity: 3,
        price: 270,
        taxes: [{ rate: 5, amount: 13.5 }],
      },
    ],
    subtotal: 270,
    taxes: [{ rate: 5, amount: 13.5 }],
    total: 283.5,
  },
];
