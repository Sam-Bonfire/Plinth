export interface ModifierOption {
  name: string;
  price?: number;
}

export interface ModifierGroup {
  name: string;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  gstRate: number;
  isVeg: boolean;
  modifierGroups: ModifierGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
}

export const mockModifiers: Record<string, ModifierGroup> = {
  portion: {
    name: "Portion size",
    options: [{ name: "Half" }, { name: "Full" }],
  },
  spice: {
    name: "Spice level",
    options: [{ name: "Mild" }, { name: "Medium" }, { name: "Spicy" }],
  },
  addons: {
    name: "Add-ons",
    options: [{ name: "Extra Butter" }, { name: "Extra Cheese" }],
  },
};

export const mockMenuItems: MenuItem[] = [
  {
    id: "MI-001",
    name: "Butter Chicken",
    price: 380,
    gstRate: 5,
    isVeg: false,
    modifierGroups: [mockModifiers.portion!, mockModifiers.spice!],
  },
  {
    id: "MI-002",
    name: "Paneer Tikka",
    price: 280,
    gstRate: 5,
    isVeg: true,
    modifierGroups: [mockModifiers.spice!],
  },
  {
    id: "MI-003",
    name: "Garlic Naan",
    price: 60,
    gstRate: 5,
    isVeg: true,
    modifierGroups: [mockModifiers.addons!],
  },
  {
    id: "MI-004",
    name: "Dal Makhani",
    price: 240,
    gstRate: 5,
    isVeg: true,
    modifierGroups: [mockModifiers.portion!],
  },
  {
    id: "MI-005",
    name: "Mango Lassi",
    price: 110,
    gstRate: 12,
    isVeg: true,
    modifierGroups: [],
  },
  {
    id: "MI-006",
    name: "Gulab Jamun",
    price: 90,
    gstRate: 5,
    isVeg: true,
    modifierGroups: [],
  },
];

export const mockCategories: MenuCategory[] = [
  { id: "CAT-01", name: "Starters" },
  { id: "CAT-02", name: "Main Course" },
  { id: "CAT-03", name: "Tandoor & Breads" },
  { id: "CAT-04", name: "Desserts" },
  { id: "CAT-05", name: "Beverages" },
];
