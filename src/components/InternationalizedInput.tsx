import type {PortableTextBlock} from '@portabletext/editor'
import {
  TabList,
  Tab,
  TabPanel,
  Stack,
  TextInput,
  TextArea,
  Box,
  Text,
  Flex,
  Spinner,
} from '@sanity/ui'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
  FieldPresence,
  FormFieldValidationStatus,
  insert,
  set,
  setIfMissing,
  type ArrayOfObjectsInputProps,
} from 'sanity'

import {groupByLanguage} from '../lib/localeMarkers'
import {useLanguageSettings} from '../lib/useLanguageSettings'
import {PortableTextTabEditor} from './PortableTextTabEditor'

interface LocaleValue {
  _key: string
  _type: string
  value?: string | PortableTextBlock[]
  sourceHash?: string
}

/**
 * Custom input for the 'autoI18n.string' / 'autoI18n.text' / 'autoI18n.blockContent'
 * fields. Renders one tab per language configured in autoI18n.languageSettings and
 * guarantees that every item's _key is the right language code.
 */
export function InternationalizedInput(props: ArrayOfObjectsInputProps<LocaleValue>) {
  const {value, onChange, schemaType, readOnly, elementProps, validation, presence} = props
  const {status, languages} = useLanguageSettings()
  const [selectedLang, setSelectedLang] = useState<string | null>(null)

  // Which _keys already exist in the array. Updated optimistically by
  // handleChangeFor and REBUILT — not merely extended — from every value the form
  // hands back.
  //
  // The optimistic update is needed because the Portable Text editor can emit
  // several onChange calls for a single typed character before React propagates the
  // updated `value` prop. Reading item existence from `value` at that moment would
  // insert several items sharing one _key instead of updating the one just created.
  //
  // The rebuild covers the opposite case: after a "discard changes" the array is
  // empty again but the ref is not, and a set() against a missing item is a silent
  // no-op — the user typed and nothing was saved.
  const knownKeysRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    knownKeysRef.current = new Set((value || []).map((item) => item._key))
  }, [value])

  // The active tab is DERIVED during render rather than synchronised through an
  // effect: until the user picks one it follows the source language, and a pick
  // lapses on its own if that language is removed from the settings. Doing it with
  // useEffect + setState would cost an extra render on every mount and leave state
  // that can keep pointing at a language which no longer exists.
  const defaultLang = languages.find((l) => l.isDefault)?.code || languages[0]?.code || null
  const activeLang =
    selectedLang && languages.some((l) => l.code === selectedLang) ? selectedLang : defaultLang

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

  // `sourceHash` changes ONLY when automatic translation rewrites this item, never
  // when the user types by hand (handleChangeFor touches `value` alone). It is used
  // as a `key` below to force the Portable Text editor to remount when a translation
  // arrives from outside — otherwise, with the tab already open, the editor would go
  // on showing the old text: @portabletext/editor reads `initialValue` at mount only,
  // not on every change of the `value` prop.
  const getSourceHashFor = useCallback(
    (langCode: string) => value?.find((item) => item._key === langCode)?.sourceHash,
    [value],
  )

  const handleChangeFor = useCallback(
    (langCode: string, nextValue: string | PortableTextBlock[]) => {
      if (readOnly) return
      // Targeted patches on the single item instead of rebuilding and rewriting the
      // whole array — see the knownKeysRef comment above for why "does it exist
      // already?" is answered by the ref rather than by the `value` prop.
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
    [onChange, readOnly],
  )

  const langCodes = useMemo(() => languages.map((lang) => lang.code), [languages])

  const validationByLang = useMemo(
    () => groupByLanguage(validation, langCodes),
    [validation, langCodes],
  )
  const presenceByLang = useMemo(() => groupByLanguage(presence, langCodes), [presence, langCodes])

  if (status === 'loading') {
    return (
      <Flex padding={3} align="center" gap={2}>
        <Spinner muted />
        <Text size={1} muted>
          Loading languages...
        </Text>
      </Flex>
    )
  }

  if (languages.length === 0) {
    return (
      <Box padding={3}>
        <Text size={1} muted>
          {status === 'error'
            ? 'Could not load language settings. Check the browser console for details.'
            : 'No language configured. Open "Language Settings" from the navbar and add at least one language.'}
        </Text>
      </Box>
    )
  }

  // Works out which underlying field variant this is from the name of the schema
  // type produced by createInternationalizedFieldType / internationalizedBlockContentType.
  const isBlockContent = schemaType.name.endsWith('.blockContent')
  const isMultiline = schemaType.name.endsWith('.text')

  const hasValueFor = (langCode: string): boolean => {
    if (isBlockContent) return getBlocksValueFor(langCode).length > 0
    return Boolean(getStringValueFor(langCode))
  }

  return (
    <Stack gap={1}>
      <TabList gap={1}>
        {languages.map((lang) => {
          const hasValue = hasValueFor(lang.code)
          const langValidation = validationByLang.get(lang.code) || []
          const hasError = langValidation.some((marker) => marker.level === 'error')

          return (
            <Tab
              key={lang.code}
              id={`${elementProps.id}-tab-${lang.code}`}
              aria-controls={`${elementProps.id}-panel-${lang.code}`}
              // The dot means "no content in this language", the triangle means a
              // validation error: two different states, two different markers, both
              // readable without opening the tab.
              label={`${lang.label}${lang.isDefault ? ' (source)' : ''}${hasError ? ' ⚠' : hasValue ? '' : ' ·'}`}
              selected={activeLang === lang.code}
              onClick={() => setSelectedLang(lang.code)}
            />
          )
        })}
      </TabList>

      {languages.map((lang) => {
        if (activeLang !== lang.code) return null

        const langValidation = validationByLang.get(lang.code) || []
        const langPresence = presenceByLang.get(lang.code) || []

        return (
          <TabPanel
            key={lang.code}
            id={`${elementProps.id}-panel-${lang.code}`}
            aria-labelledby={`${elementProps.id}-tab-${lang.code}`}
          >
            <Stack gap={2}>
              {langValidation.length > 0 || langPresence.length > 0 ? (
                <Flex align="center" justify="space-between" gap={2}>
                  <Box>
                    {langValidation.length > 0 ? (
                      <FormFieldValidationStatus validation={langValidation} fontSize={1} />
                    ) : null}
                  </Box>
                  {langPresence.length > 0 ? (
                    <FieldPresence presence={langPresence} maxAvatars={4} />
                  ) : null}
                </Flex>
              ) : null}

              {isBlockContent ? (
                <PortableTextTabEditor
                  key={`${lang.code}:${getSourceHashFor(lang.code) ?? ''}`}
                  value={getBlocksValueFor(lang.code)}
                  onChange={(blocks) => handleChangeFor(lang.code, blocks)}
                  placeholder={`Text in ${lang.label}`}
                  readOnly={Boolean(readOnly)}
                />
              ) : isMultiline ? (
                <TextArea
                  {...elementProps}
                  rows={4}
                  readOnly={Boolean(readOnly)}
                  value={getStringValueFor(lang.code)}
                  onChange={(event) => handleChangeFor(lang.code, event.currentTarget.value)}
                  placeholder={`Text in ${lang.label}`}
                />
              ) : (
                <TextInput
                  {...elementProps}
                  readOnly={Boolean(readOnly)}
                  value={getStringValueFor(lang.code)}
                  onChange={(event) => handleChangeFor(lang.code, event.currentTarget.value)}
                  placeholder={`Text in ${lang.label}`}
                />
              )}
            </Stack>
          </TabPanel>
        )
      })}
    </Stack>
  )
}
