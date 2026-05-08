/**
 * Utility for robust audio language detection from video metadata.
 */
export interface LanguageOption {
  code: string
  label: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'lang_en' },
  { code: 'de', label: 'lang_de' },
  { code: 'fr', label: 'lang_fr' },
  { code: 'es', label: 'lang_es' },
]

export class LanguageUtils {
  /**
   * Detects available audio languages from yt-dlp metadata formats.
   * @param formats The formats array from yt-dlp JSON metadata
   * @returns Array of supported language codes found in the metadata
   */
  static detectAvailableLanguages(formats: any[]): string[] {
    if (!formats || !Array.isArray(formats)) return []
    
    const langs = new Set<string>()
    const supportedCodes = SUPPORTED_LANGUAGES.map(l => l.code)
    
    formats.forEach((f: any) => {
      // 1. Check explicit language fields
      const explicitLangs = [f.language, f.lang, f.language_full_name, f.language_name]
      explicitLangs.forEach(l => {
        if (l && typeof l === 'string' && l !== 'und') {
          const code = l.split(/[-_ (]/)[0].toLowerCase()
          // Check for code match
          if (supportedCodes.includes(code)) {
            langs.add(code)
          }
          // Check for full name match
          if (l.toLowerCase().includes('english')) langs.add('en')
          if (l.toLowerCase().includes('german') || l.toLowerCase().includes('deutsch')) langs.add('de')
          if (l.toLowerCase().includes('french') || l.toLowerCase().includes('français')) langs.add('fr')
          if (l.toLowerCase().includes('spanish') || l.toLowerCase().includes('español')) langs.add('es')
        }
      })

      // 2. Scan format_note and format_id for keywords/codes
      const extra = (String(f.format_note || '') + ' ' + String(f.format_id || '')).toLowerCase()
      
      if (/(^|[-_])en([-_]|$)|english/.test(extra)) langs.add('en')
      if (/(^|[-_])de([-_]|$)|german|deutsch/.test(extra)) langs.add('de')
      if (/(^|[-_])fr([-_]|$)|french|français/.test(extra)) langs.add('fr')
      if (/(^|[-_])es([-_]|$)|spanish|español/.test(extra)) langs.add('es')
    })

    // 3. Fallback logic: If any non-English language was detected, 
    // English is almost certainly available as a primary or fallback track.
    if (langs.size > 0 && (langs.has('de') || langs.has('fr') || langs.has('es'))) {
      langs.add('en')
    }

    return Array.from(langs)
  }

  /**
   * Returns the full LanguageOption objects for detected codes.
   */
  static getAvailableLanguageOptions(formats: any[]): LanguageOption[] {
    const detectedCodes = this.detectAvailableLanguages(formats)
    return SUPPORTED_LANGUAGES.filter(l => detectedCodes.includes(l.code))
  }
}
