const FAVORITES_KEY = "cg-menu-favorites";

export function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function setFavorites(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

export function toggleFavorite(id: string): string[] {
  const current = getFavorites();
  const next = current.includes(id)
    ? current.filter((v) => v !== id)
    : [...current, id];
  setFavorites(next);
  return next;
}
