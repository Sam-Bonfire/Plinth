export interface Recipe {
  key: string;
  item: string;
  uses: string;
  cost: number;
  margin: string;
  isSubRecipe?: boolean;
}

export const subRecipeCost = (recipe: Recipe, allRecipes: Recipe[]): number => {
  let totalCost = recipe.cost;

  // Parse uses string into an array of ingredients (ignoring empty strings)
  const ingredients = recipe.uses.split(',').map(s => s.trim()).filter(s => s.length > 0);

  for (const ingredient of ingredients) {
    const matchingSubRecipe = allRecipes.find(r => r.isSubRecipe && r.item === ingredient);
    if (matchingSubRecipe) {
      totalCost += matchingSubRecipe.cost;
    }
  }

  return totalCost;
};

export const seedRecipes = (): Recipe[] => [
  { key: "REC-01", item: "Butter Chicken", uses: "Chicken, Base Gravy, Butter", cost: 50, margin: "69%" },
  { key: "REC-02", item: "Paneer Tikka", uses: "Paneer, Garam Masala", cost: 72, margin: "74%" },
  { key: "REC-03", item: "Dal Makhani", uses: "Butter, Garam Masala", cost: 48, margin: "78%" },
  { key: "REC-04", item: "Garlic Naan", uses: "Butter", cost: 12, margin: "80%" },
  { key: "REC-05", item: "Base Gravy", uses: "Tomato, Onion, Garam Masala", cost: 48, margin: "0%", isSubRecipe: true },
];
