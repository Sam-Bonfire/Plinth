export type CategoryColorPrefs = Record<string, string>;

export const PRESET_COLORS = ["magenta", "red", "orange", "green", "cyan", "blue"] as const;
export type PresetColor = typeof PRESET_COLORS[number];

export function moveCategory(order: string[], id: string, dir: "up" | "down"): string[] {
  const index = order.indexOf(id);
  if (index === -1) return [...order];
  if (dir === "up" && index > 0) {
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    return newOrder;
  }
  if (dir === "down" && index < order.length - 1) {
    const newOrder = [...order];
    [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    return newOrder;
  }
  return [...order];
}

export function colorFor(categoryId: string, prefs: CategoryColorPrefs): string | undefined {
  return prefs[categoryId];
}
