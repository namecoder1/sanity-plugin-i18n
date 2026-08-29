/**
 * The contract every translation engine implements. `translationCore.ts` works
 * only against this interface and never learns whether MyMemory, Azure or
 * something else sits behind it.
 *
 * That indirection is what lets the exact same hashing / staleness / patch-building
 * logic run in two very different places: in the browser (Studio, MyMemory) and in
 * a server-side Sanity Function (Azure, where the subscription key lives).
 * Implement this interface to plug in any other engine — DeepL, an in-house
 * service, a mock for tests.
 */
export interface TranslationProvider {
  /** Translates a single piece of text. Every provider must implement this. */
  translateText(text: string, sourceLang: string, targetLang: string): Promise<string>

  /**
   * Optional: translates many texts in one round trip.
   *
   * Rich text is translated span by span to preserve marks, so a single field can
   * mean dozens of calls. Providers whose API accepts a batch — Azure Translator
   * takes up to 100 texts per request — should implement this: the core uses it
   * whenever it is present and falls back to sequential `translateText` calls when
   * it is not.
   *
   * The returned array MUST have the same length as `texts`, in the same order.
   * Results are matched back to their spans positionally, so a shorter, longer or
   * reordered array would silently attach translations to the wrong spans.
   */
  translateTexts?(texts: string[], sourceLang: string, targetLang: string): Promise<string[]>
}
