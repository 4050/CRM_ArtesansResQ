import { describe, expect, it } from 'vitest'
import { unitLabel, categoryLabel, sourceLabel, CONSUMABLE_UNITS, CONSUMABLE_CATEGORIES, CONSUMABLE_SOURCES } from './consumable-labels'
import type { Dictionary } from '@/app/[lang]/dictionaries'
import en from '@/app/[lang]/dictionaries/en.json'

const dict = en as unknown as Dictionary

describe('unitLabel / categoryLabel / sourceLabel', () => {
  it('translates every known unit, category and source code', () => {
    for (const unit of CONSUMABLE_UNITS) {
      expect(unitLabel(dict, unit)).not.toBe('')
    }
    for (const category of CONSUMABLE_CATEGORIES) {
      expect(categoryLabel(dict, category)).not.toBe('')
    }
    for (const source of CONSUMABLE_SOURCES) {
      expect(sourceLabel(dict, source)).not.toBe('')
    }
  })

  it('falls back to the raw value for an unknown code', () => {
    // Consumable.category/unit/source are free text in the DB, so a value
    // outside the known preset must render as-is instead of throwing or
    // showing "undefined".
    expect(unitLabel(dict, 'unknown-unit')).toBe('unknown-unit')
    expect(categoryLabel(dict, 'unknown-category')).toBe('unknown-category')
    expect(sourceLabel(dict, 'unknown-source')).toBe('unknown-source')
  })
})
