import { describe, expect, it } from 'vitest'
import en from './en.json'
import uk from './uk.json'

// Every locale JSON is maintained by hand in parallel (see README) - this is
// the check that would have caught every "forgot to add the key to the
// other file" slip made while building out each feature this session.
function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [prefix]

  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeyPaths(value, prefix ? `${prefix}.${key}` : key)
  )
}

describe('dictionary parity', () => {
  it('en.json and uk.json expose exactly the same set of keys', () => {
    const enKeys = collectKeyPaths(en).sort()
    const ukKeys = collectKeyPaths(uk).sort()

    const missingInUk = enKeys.filter(k => !ukKeys.includes(k))
    const missingInEn = ukKeys.filter(k => !enKeys.includes(k))

    expect(missingInUk, 'keys present in en.json but missing from uk.json').toEqual([])
    expect(missingInEn, 'keys present in uk.json but missing from en.json').toEqual([])
  })

  it('has no empty string values in either locale', () => {
    for (const [name, dict] of [['en', en], ['uk', uk]] as const) {
      const emptyKeys = collectKeyPaths(dict).filter(path => {
        const value = path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], dict)
        return value === ''
      })
      expect(emptyKeys, `empty string values in ${name}.json`).toEqual([])
    }
  })
})
