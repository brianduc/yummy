// YUMMY — UI Size System
// Scales the entire app by changing html font-size (rem root).
// All Tailwind rem/em classes cascade from this single value.

export const UI_SIZE_STEPS  = [12, 14, 16, 18, 20] as const
export const UI_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'] as const
export const UI_SIZE_DEFAULT_INDEX = 2 // 16px — Normal / M

const STORAGE_KEY = 'yummy_ui_size'

/**
 * Apply a UI size by index (0–4).
 * Sets html font-size and persists the choice to localStorage.
 */
export function applyUiSize(index: number): void {
  const clamped = Math.max(0, Math.min(4, index))
  const px = UI_SIZE_STEPS[clamped]
  if (typeof document !== 'undefined') {
    document.documentElement.style.fontSize = `${px}px`
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(clamped))
  }
}

/**
 * Read saved index from localStorage and apply it.
 * Falls back to index 2 (16px) if nothing is stored.
 * Call once on app boot alongside loadSavedTheme().
 */
export function loadSavedUiSize(): void {
  if (typeof window === 'undefined') return
  const raw = localStorage.getItem(STORAGE_KEY)
  const index = raw !== null ? parseInt(raw, 10) : UI_SIZE_DEFAULT_INDEX
  applyUiSize(isNaN(index) ? UI_SIZE_DEFAULT_INDEX : index)
}

/**
 * Return the currently saved index (0–4). Default 2.
 * Safe to call server-side (returns default).
 */
export function getSavedUiSizeIndex(): number {
  if (typeof window === 'undefined') return UI_SIZE_DEFAULT_INDEX
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return UI_SIZE_DEFAULT_INDEX
  const index = parseInt(raw, 10)
  return isNaN(index) ? UI_SIZE_DEFAULT_INDEX : Math.max(0, Math.min(4, index))
}
