import {Flex, Spinner, Text} from '@sanity/ui'
import {useEffect} from 'react'
import {useRouter} from 'sanity/router'

import {LANGUAGE_SETTINGS_DOC_ID} from '../config'

/**
 * Tool registrato nella nav bar dello Studio: dà accesso diretto al documento
 * singleton "Impostazioni Lingue", che altrimenti non sarebbe raggiungibile
 * dall'interfaccia (è nascosto dal menu "crea nuovo documento" in quanto
 * singleton, e non tutte le strutture desk lo espongono esplicitamente).
 *
 * Naviga subito verso il documento invece di mostrare una card intermedia
 * con un pulsante da cliccare: un click in meno, e l'anteprima che si vede
 * è il vero form del documento (con i suoi campi), non una schermata statica.
 */
export function LanguageSettingsTool() {
  const router = useRouter()

  useEffect(() => {
    router.navigateIntent('edit', {id: LANGUAGE_SETTINGS_DOC_ID, type: LANGUAGE_SETTINGS_DOC_ID})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- va eseguito solo al montaggio del tool
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
