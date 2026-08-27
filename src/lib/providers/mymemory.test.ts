import {afterEach, describe, expect, it, vi} from 'vitest'

import {createMyMemoryProvider} from './mymemory'

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createMyMemoryProvider', () => {
  it('returns the top translation when it looks sane', async () => {
    mockFetchOnce({
      responseStatus: 200,
      responseData: {translatedText: 'Hello everyone', match: 0.95},
      matches: [],
    })

    const provider = createMyMemoryProvider({})
    const result = await provider.translateText('Ciao a tutti', 'it', 'en')

    expect(result).toBe('Hello everyone')
  })

  it('throws when MyMemory reports a non-200 responseStatus', async () => {
    mockFetchOnce({responseStatus: 403, responseData: {translatedText: 'QUOTA EXCEEDED'}})

    const provider = createMyMemoryProvider({})
    await expect(provider.translateText('Ciao', 'it', 'en')).rejects.toThrow(/MyMemory API error/)
  })

  it('discards a suspiciously long top match (translation-memory artifact) in favor of a sane alternative', async () => {
    // Regressione: "Oggi ci siamo divertiti a mangiare carne e pesce." è tornato
    // come "...fishCambridge, MA: Harvard University Press." — un frammento
    // bibliografico estraneo trascinato dal match di libreria di MyMemory.
    mockFetchOnce({
      responseStatus: 200,
      responseData: {
        translatedText: 'fish Cambridge, MA: Harvard University Press.',
        match: 0.9,
      },
      matches: [
        {translation: 'fish Cambridge, MA: Harvard University Press.', match: 0.9},
        {translation: 'fish.', match: 0.6},
      ],
    })

    const provider = createMyMemoryProvider({})
    const result = await provider.translateText('pesce.', 'it', 'en')

    expect(result).toBe('fish.')
  })

  it('discards a low-quality match in favor of a higher-quality alternative', async () => {
    mockFetchOnce({
      responseStatus: 200,
      responseData: {translatedText: 'sospetta', match: 0.2},
      matches: [
        {translation: 'sospetta', match: 0.2},
        {translation: 'buona traduzione', match: 0.8},
      ],
    })

    const provider = createMyMemoryProvider({})
    const result = await provider.translateText('testo', 'it', 'en')

    expect(result).toBe('buona traduzione')
  })

  it('falls back to the top result (with a warning) when no candidate passes the checks', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchOnce({
      responseStatus: 200,
      responseData: {
        translatedText: 'unico risultato disponibile ma sospetto'.repeat(5),
        match: 0.1,
      },
      matches: [],
    })

    const provider = createMyMemoryProvider({})
    const result = await provider.translateText('x', 'it', 'en')

    expect(result).toBe('unico risultato disponibile ma sospetto'.repeat(5))
    expect(warnSpy).toHaveBeenCalled()
  })

  it('passes apiKey and email through as query params', async () => {
    mockFetchOnce({responseStatus: 200, responseData: {translatedText: 'ok', match: 1}})
    const provider = createMyMemoryProvider({apiKey: 'my-key', email: 'me@example.com'})

    await provider.translateText('ciao', 'it', 'en')

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('key=my-key')
    expect(calledUrl).toContain('de=me%40example.com')
    expect(calledUrl).toContain('langpair=it%7Cen')
  })
})
