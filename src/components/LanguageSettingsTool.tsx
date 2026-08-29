import {Flex, Spinner, Text} from '@sanity/ui'
import {useEffect} from 'react'
import {useRouter} from 'sanity/router'

import {LANGUAGE_SETTINGS_DOC_ID} from '../config'

/**
 * Tool registered in the Studio nav bar, giving direct access to the "Language
 * Settings" singleton. Without it the document would be hard to reach: it is kept
 * out of the "create new document" menu precisely because it is a singleton, and not
 * every structure exposes it explicitly.
 *
 * It navigates straight to the document rather than showing an intermediate card
 * with a button to click: one click fewer, and what you land on is the document's
 * real form with its fields, not a static placeholder screen.
 */
export function LanguageSettingsTool() {
  const router = useRouter()

  useEffect(() => {
    router.navigateIntent('edit', {id: LANGUAGE_SETTINGS_DOC_ID, type: LANGUAGE_SETTINGS_DOC_ID})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- must run on tool mount only
  }, [])

  return (
    <Flex height="fill" align="center" justify="center" gap={3}>
      <Spinner muted />
      <Text size={1} muted>
        Opening Language Settings...
      </Text>
    </Flex>
  )
}
