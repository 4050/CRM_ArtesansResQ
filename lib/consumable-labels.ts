import type { Dictionary } from '@/app/[lang]/dictionaries'

// category is free text in the DB — values outside the known preset codes
// have no translation and are shown as-is.
export function unitLabel(dict: Dictionary, unit: string): string {
  return (dict.consumables.units as Record<string, string>)[unit] ?? unit
}

export function categoryLabel(dict: Dictionary, category: string): string {
  return (dict.consumables.categories as Record<string, string>)[category] ?? category
}
