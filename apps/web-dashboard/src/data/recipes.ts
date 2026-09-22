export interface Recipe {
  key: string;
  item: string;
  uses: string;
  cost: number;
  margin: string;
}

export const seedRecipes = (): Recipe[] => [
  { key: "REC-01", item: "Butter Chicken", uses: "Chicken, Garam Masala, Butter", cost: 98, margin: "69%" },
  { key: "REC-02", item: "Paneer Tikka", uses: "Paneer, Garam Masala", cost: 72, margin: "74%" },
  { key: "REC-03", item: "Dal Makhani", uses: "Butter, Garam Masala", cost: 48, margin: "78%" },
  { key: "REC-04", item: "Garlic Naan", uses: "Butter", cost: 12, margin: "80%" },
];
