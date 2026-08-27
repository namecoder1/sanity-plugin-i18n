import {useCallback, useEffect, useRef, useState} from 'react'
import {insert, set, setIfMissing, useClient, type ArrayOfObjectsInputProps} from 'sanity'
import {TabList, Tab, TabPanel, Stack, TextInput, TextArea, Box, Text, Flex, Spinner} from '@sanity/ui'
import type {PortableTextBlock} from '@portabletext/editor'
import {LANGUAGE_SETTINGS_DOC_ID} from '../config'
import {PortableTextTabEditor} from './PortableTextTabEditor'

const API_VERSION = '2023-01-01'

interface LanguageEntry {
  code: string
  label: string
  isDefault?: boolean
}

interface LocaleValue {
  _key: string
  _type: string
  value?: string | PortableTextBlock[]
  sourceHash?: string
}

/**
 * Custom input per i campi 'autoI18n.string' / 'autoI18n.text'.
 * Mostra un tab per ogni lingua configurata in autoI18n.languageSettings
 * e garantisce che la _key di ogni item sia sempre il codice lingua corretto.
 */
export function InternationalizedInput(props: ArrayOfObjectsInputProps<LocaleValue>) {
  const {value, onChange, schemaType} = props
  const client = useClient({apiVersion: API_VERSION})
  const [languages, setLanguages] = useState<LanguageEntry[] | null>(null)
  const [activeLang, setActiveLang] = useState<string | null>(null)

  // Quali _key esistono già nell'array, aggiornato in modo ottimistico (vedi
  // handleChangeFor) e risincronizzato ad ogni valore ricevuto dal form.
  // Necessario perché l'editor Portable Text può emettere più eventi onChange
  // per un singolo carattere digitato (mutazione + selezione, ecc.) prima che
  // React abbia il tempo di ripropagare la `value` prop aggiornata: leggere
  // l'esistenza dell'item direttamente da `value` in quel caso porterebbe a
  // inserire più item duplicati con la stessa _key invece di aggiornare quello
  // appena creato.
  const knownKeysRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const item of value || []) {
      knownKeysRef.current.add(item._key)
    }
  }, [value])

  useEffect(() => {
    let isMounted = true
    client
      .fetch<{supportedLanguages: LanguageEntry[]} | null>(
        `*[_id == $id][0]{supportedLanguages}`,
        {id: LANGUAGE_SETTINGS_DOC_ID},
      )
      .then((res) => {
        if (!isMounted) return
        const langs = res?.supportedLanguages || []
        setLanguages(langs)
        const defaultLang = langs.find((l) => l.isDefault)?.code || langs[0]?.code || null
        setActiveLang(defaultLang)
      })
      .catch((err) => {
        console.error('[auto-i18n] Errore nel caricamento delle lingue:', err)
        if (isMounted) setLanguages([])
      })
    return () => {
      isMounted = false
    }
  }, [client])

  const getRawValueFor = useCallback(
    (langCode: string) => value?.find((item) => item._key === langCode)?.value,
    [value],
  )

  const getStringValueFor = useCallback(
    (langCode: string): string => {
      const raw = getRawValueFor(langCode)
      return typeof raw === 'string' ? raw : ''
    },
    [getRawValueFor],
  )

  const getBlocksValueFor = useCallback(
    (langCode: string): PortableTextBlock[] => {
      const raw = getRawValueFor(langCode)
      return Array.isArray(raw) ? raw : []
    },
    [getRawValueFor],
  )

  // `sourceHash` cambia SOLO quando la traduzione automatica riscrive questo
  // item (mai quando l'utente digita a mano: handleChangeFor tocca solo
  // `value`). Usato come `key` sotto per forzare il remount dell'editor
  // Portable Text quando arriva una traduzione esterna — altrimenti, se il
  // tab è già aperto, l'editor continuerebbe a mostrare il vecchio testo:
  // @portabletext/editor legge `initialValue` solo al mount, non ad ogni
  // variazione della prop `value`.
  const getSourceHashFor = useCallback(
    (langCode: string) => value?.find((item) => item._key === langCode)?.sourceHash,
    [value],
  )

  const handleChangeFor = useCallback(
    (langCode: string, nextValue: string | PortableTextBlock[]) => {
      // Patch puntuali sul singolo item invece di ricostruire e riscrivere
      // l'intero array — vedi il commento su knownKeysRef sopra per il perché
      // "esiste già?" viene deciso dal ref e non dalla prop `value`.
      if (knownKeysRef.current.has(langCode)) {
        onChange(set(nextValue, [{_key: langCode}, 'value']))
      } else {
        knownKeysRef.current.add(langCode)
        onChange([
          setIfMissing([]),
          insert([{_key: langCode, _type: 'localeValue', value: nextValue}], 'after', [-1]),
        ])
      }
    },
    [onChange],
  )

  if (languages === null) {
    return (
      <Flex padding={3} align="center" gap={2}>
        <Spinner muted />
        <Text size={1} muted>
          Caricamento lingue...
        </Text>
      </Flex>
    )
  }

  if (languages.length === 0) {
    return (
      <Box padding={3}>
        <Text size={1} muted>
          Nessuna lingua configurata. Crea un documento &quot;Impostazioni Lingue&quot; con almeno
          una lingua.
        </Text>
      </Box>
    )
  }

  // Determina la variante del campo sottostante guardando il nome dello schema
  // type generato da createInternationalizedFieldType / internationalizedBlockContentType.
  const isBlockContent = schemaType.name.endsWith('.blockContent')
  const isMultiline = schemaType.name.endsWith('.text')

  const hasValueFor = (langCode: string): boolean => {
    if (isBlockContent) return getBlocksValueFor(langCode).length > 0
    return Boolean(getStringValueFor(langCode))
  }

  return (
    <Stack>
      <TabList>
        {languages.map((lang) => {
          const hasValue = hasValueFor(lang.code)
          return (
            <Tab
              key={lang.code}
              id={`tab-${lang.code}`}
              aria-controls={`panel-${lang.code}`}
              label={`${lang.label}${lang.isDefault ? ' (sorgente)' : ''}${hasValue ? '' : ' ·'}`}
              selected={activeLang === lang.code}
              onClick={() => setActiveLang(lang.code)}
            />
          )
        })}
      </TabList>

      {languages.map((lang) => {
        if (activeLang !== lang.code) return null

        return (
          <TabPanel key={lang.code} id={`panel-${lang.code}`} aria-labelledby={`tab-${lang.code}`}>
            {isBlockContent ? (
              <PortableTextTabEditor
                key={`${lang.code}:${getSourceHashFor(lang.code) ?? ''}`}
                value={getBlocksValueFor(lang.code)}
                onChange={(blocks) => handleChangeFor(lang.code, blocks)}
                placeholder={`Testo in ${lang.label}`}
              />
            ) : isMultiline ? (
              <TextArea
                rows={4}
                value={getStringValueFor(lang.code)}
                onChange={(event) => handleChangeFor(lang.code, event.currentTarget.value)}
                placeholder={`Testo in ${lang.label}`}
              />
            ) : (
              <TextInput
                value={getStringValueFor(lang.code)}
                onChange={(event) => handleChangeFor(lang.code, event.currentTarget.value)}
                placeholder={`Testo in ${lang.label}`}
              />
            )}
          </TabPanel>
        )
      })}
    </Stack>
  )
}