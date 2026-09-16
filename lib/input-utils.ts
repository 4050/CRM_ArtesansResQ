// Clamps a `<input type="number" min="1">` onChange value to a valid
// integer quantity. A partially-typed value (empty, "-", scientific
// notation mid-entry) makes Number(raw) NaN, and Math.max(1, NaN) is NaN -
// which then silently defeats any `quantity > qty_in_stock` over-stock
// check downstream, since every comparison against NaN is false. A
// fractional value (e.g. "1.5") isn't NaN but still isn't valid, since
// every quantity column in this app is an integer - Postgres would reject
// it as a raw, untranslated type-cast error. Falls back to 1 for anything
// that doesn't parse, rather than the previous value, so a cleared field
// doesn't leave a stale number in place.
export function clampQuantityInput(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1
}

// Same guarding as clampQuantityInput, but floors at 0 rather than 1 - for
// `<input type="number" min="0">` fields where empty/zero is a legitimate
// value (e.g. a new item's opening stock, or its reorder minimum).
export function clampNonNegativeInt(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}
