import type { Filters } from "../hooks/useROFilters";

const STORAGE_KEY = "ro-filters-v1";

/**
 * Save filters to localStorage
 */
export function saveFilters(filters: Filters): void {
  try {
    const serialized = JSON.stringify(filters);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error("Failed to save filters to localStorage:", error);
  }
}

/**
 * Load filters from localStorage
 * Returns null if no saved filters exist or if loading fails
 */
export function loadFilters(): Filters | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;

    const parsed = JSON.parse(serialized);

    // Validate that the parsed object has the expected structure
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    // Ensure arrays exist (for backward compatibility if structure changes)
    return {
      overdue: parsed.overdue ?? false,
      dueThisWeek: parsed.dueThisWeek ?? false,
      highValue: parsed.highValue ?? false,
      shop: parsed.shop ?? null,
      waitingAction: parsed.waitingAction ?? false,
      excludedShops: Array.isArray(parsed.excludedShops) ? parsed.excludedShops : [],
      selectedStatuses: Array.isArray(parsed.selectedStatuses) ? parsed.selectedStatuses : [],
    };
  } catch (error) {
    console.error("Failed to load filters from localStorage:", error);
    return null;
  }
}

/**
 * Clear saved filters from localStorage
 */
export function clearSavedFilters(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear filters from localStorage:", error);
  }
}
