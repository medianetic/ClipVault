import { describe, it, expect } from 'vitest'
import { i18n } from './i18n'

describe('i18n consistency', () => {
  const messages = i18n.global.messages.value as any
  const en = messages.en
  const de = messages.de
  const es = messages.es

  // Helper function to get all keys of a nested object
  const getAllKeys = (obj: any, prefix = ''): string[] => {
    return Object.keys(obj).reduce((res: string[], el) => {
      if (typeof obj[el] === 'object' && obj[el] !== null && !Array.isArray(obj[el])) {
        return [...res, ...getAllKeys(obj[el], prefix + el + '.')]
      }
      return [...res, prefix + el]
    }, [])
  }

  it('has the same keys for en, de and es', () => {
    const enKeys = getAllKeys(en).sort()
    const deKeys = getAllKeys(de).sort()
    const esKeys = getAllKeys(es).sort()

    // Find missing keys in DE
    const missingInDe = enKeys.filter(k => !deKeys.includes(k))
    // Find missing keys in EN
    const missingInEn = deKeys.filter(k => !enKeys.includes(k))
    // Find missing keys in ES
    const missingInEs = enKeys.filter(k => !esKeys.includes(k))
    // Find extra keys in ES (not in EN)
    const extraInEs = esKeys.filter(k => !enKeys.includes(k))

    if (missingInDe.length > 0) {
      console.error('Keys missing in German:', missingInDe)
    }
    if (missingInEn.length > 0) {
      console.error('Keys missing in English:', missingInEn)
    }
    if (missingInEs.length > 0) {
      console.error('Keys missing in Spanish:', missingInEs)
    }
    if (extraInEs.length > 0) {
      console.error('Extra keys in Spanish:', extraInEs)
    }

    expect(missingInDe).toEqual([])
    expect(missingInEn).toEqual([])
    expect(missingInEs).toEqual([])
    expect(extraInEs).toEqual([])
  })

  it('has valid translation strings (not empty)', () => {
    const enKeys = getAllKeys(en)
    enKeys.forEach(key => {
      const parts = key.split('.')
      let val = en
      parts.forEach(p => val = val[p])
      expect(typeof val).toBe('string')
      expect(val.length).toBeGreaterThan(0)
    })
  })
})
