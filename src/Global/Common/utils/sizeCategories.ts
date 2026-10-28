// Kinds of sized items a player's saved sizes are kept for. Mirrors SIZE_CATEGORIES in the
// backend's OrderFormController; an order form item opts in through its sizeCategory.
const APPAREL = ["XS", "S", "M", "L", "XL", "XXL"];

export const SIZE_CATEGORIES: Array<{ id: string; label: string; options: string[] }> = [
  { id: "shirt", label: "Shirt", options: APPAREL },
  { id: "shorts", label: "Shorts", options: APPAREL },
  { id: "hoodie", label: "Hoodie", options: APPAREL },
  { id: "pants", label: "Sweatpants", options: APPAREL },
  { id: "polo", label: "Polo", options: APPAREL },
  { id: "jersey", label: "Jersey", options: APPAREL },
  { id: "gloves", label: "Gloves", options: ["Normal", "Goalie"] },
];

export type SavedSizes = Record<string, string>;

export function sizeCategoryLabel(id: string | null | undefined): string {
  return SIZE_CATEGORIES.find((c) => c.id === id)?.label ?? "None";
}
