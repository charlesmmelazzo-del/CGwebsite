// ─── Cocktail Creepypastas — ingredient names for the recipe cards ──────────

const UNITS =
  "oz|ounces?|ml|cl|dash(?:es)?|drops?|bar ?spoons?|bsp|tsp|teaspoons?|tbsp|tablespoons?|parts?|cups?|splash(?:es)?|pinch(?:es)?|wedges?|slices?";
const AMOUNT = new RegExp(`^[\\d¼½¾⅓⅔⅛.,/\\s-]+(?:(?:${UNITS})\\b\\.?)?\\s*(?:of\\s+)?`, "i");

/**
 * Just the ingredient names for a card — "2 oz bourbon" becomes "Bourbon".
 * The admin's Ingredients field can hold the full measured list; the
 * measurements live on the downloadable recipe.
 */
export function ingredientNames(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\n|;/)
    .map((line) => line.trim().replace(/^[-•*]\s*/, "").replace(AMOUNT, "").trim())
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase() + name.slice(1));
}
