import type { Dictionary } from '@/app/[lang]/dictionaries'
import type { ConsumableUnit, ConsumableCategory, ConsumableSource } from '@/types'

// Single source of truth for the picker lists — used by both InventoryClient
// (main warehouse) and TeamStockClient (team stock).
export const CONSUMABLE_UNITS: ConsumableUnit[] = ['pcs', 'pair', 'ml', 'l', 'g', 'kg', 'pack', 'vial', 'amp']
export const CONSUMABLE_CATEGORIES: ConsumableCategory[] = ['ppe', 'dressings', 'instruments', 'solutions', 'medications', 'other']

// The 3 funding sources the main warehouse screen is split into.
export const CONSUMABLE_SOURCES: ConsumableSource[] = ['state_procurement', 'charity', 'other']

// category is free text in the DB — values outside the known preset codes
// have no translation and are shown as-is.
export function unitLabel(dict: Dictionary, unit: string): string {
  return (dict.consumables.units as Record<string, string>)[unit] ?? unit
}

export function categoryLabel(dict: Dictionary, category: string): string {
  return (dict.consumables.categories as Record<string, string>)[category] ?? category
}

export function sourceLabel(dict: Dictionary, source: string): string {
  return (dict.consumables.sources as Record<string, string>)[source] ?? source
}
