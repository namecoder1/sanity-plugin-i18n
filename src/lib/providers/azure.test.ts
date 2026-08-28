import {afterEach, describe, expect, it, vi} from 'vitest'

import {createAzureProvider} from './azure'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createAzureProvider', () => {
  it('builds the request with api-version/from/to and returns the translation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{translations: [{text: 'Hello world', to: 'en'}]}],
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createAzureProvider({apiKey: 'secret-key', region: 'italynorth'})
    const result = await provider.translateText('Ciao mondo', 'it', 'en')

    expect(result).toBe('Hello world')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('api-version=3.0')
    expect(url).toContain('from=it')
    expect(url).toContain('to=en')
    expect(init.method).toBe('POST')
    expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('secret-key')
    expect(init.headers['Ocp-Apim-Subscription-Region']).toBe('italynorth')
    expect(JSON.parse(init.body)).toEqual([{Text: 'Ciao mondo'}])
  })

  it('omits the region header when no region is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{translations: [{text: 'ok'}]}],
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createAzureProvider({apiKey: 'secret-key'})
    await provider.translateText('ciao', 'it', 'en')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Ocp-Apim-Subscription-Region']).toBeUndefined()
  })

  it('throws with the response body when Azure returns a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"error":{"message":"Access denied"}}',
      }),
    )

    const provider = createAzureProvider({apiKey: 'bad-key'})
    await expect(provider.translateText('ciao', 'it', 'en')).rejects.toThrow(/401/)
  })

  it('throws when the response has no translation text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ok: true, json: async () => [{translations: []}]}),
    )

    const provider = createAzureProvider({apiKey: 'k'})
    await expect(provider.translateText('ciao', 'it', 'en')).rejects.toThrow(
      /No translation received/,
    )
  })
})
