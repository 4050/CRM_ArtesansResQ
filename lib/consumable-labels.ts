import type { Dictionary } from '@/app/[lang]/dictionaries'
import type { ConsumableUnit, ConsumableCategory } from '@/types'

// Single source of truth for the picker lists — used by both InventoryClient
// (main warehouse) and TeamStockClient (team stock).
export const CONSUMABLE_UNITS: ConsumableUnit[] = ['pcs', 'pair', 'ml', 'l', 'g', 'kg', 'pack', 'vial', 'amp']
export const CONSUMABLE_CATEGORIES: ConsumableCategory[] = ['ppe', 'dressings', 'instruments', 'solutions', 'medications', 'other']

// category is free text in the DB — values outside the known preset codes
// have no translation and are shown as-is.
export function unitLabel(dict: Dictionary, unit: string): string {
  return (dict.consumables.units as Record<string, string>)[unit] ?? unit
}

export function categoryLabel(dict: Dictionary, category: string): string {
  return (dict.consumables.categories as Record<string, string>)[category] ?? category
}
