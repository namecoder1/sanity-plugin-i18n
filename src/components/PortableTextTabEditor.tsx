import {useEffect} from 'react'
import type {ComponentType} from 'react'
import {
  EditorProvider,
  PortableTextEditable,
  defineDecorator,
  defineSchema,
  useEditor,
  useEditorSelector,
  type PortableTextBlock,
} from '@portabletext/editor'
import {NodePlugin} from '@portabletext/editor/plugins'
import {Box, Button, Flex, Text} from '@sanity/ui'
import {BoldIcon} from '@sanity/icons/Bold'
import {ItalicIcon} from '@sanity/icons/Italic'

/**
 * Schema minimo per l'editor rich-text nei tab lingua: solo paragrafi con
 * grassetto/corsivo. Niente liste, link o oggetti custom per l'MVP — vedi
 * lo stesso limite in translateAction.ts (traduzione span-per-span).
 */
const ptSchema = defineSchema({
  decorators: [{name: 'strong', title: 'Grassetto'}, {name: 'em', title: 'Corsivo'}],
  styles: [{name: 'normal', title: 'Normale'}],
  annotations: [],
  lists: [],
  inlineObjects: [],
  blockObjects: [],
})

/**
 * Registra COME renderizzare visivamente ogni decorator. Dichiararlo in
 * `defineSchema` (sopra) definisce solo i nomi validi nel modello dati — senza
 * questa registrazione via NodePlugin, i marks vengono applicati ai dati ma
 * non producono alcun <strong>/<em> nel DOM. Costante a livello di modulo
 * (non ricreata ad ogni render) come richiesto dalla doc di NodePlugin, per
 * evitare un ciclo di unregister/re-register ad ogni render.
 */
const decoratorNodes = [
  defineDecorator({type: 'strong', render: ({children}) => <strong>{children}</strong>}),
  defineDecorator({type: 'em', render: ({children}) => <em>{children}</em>}),
]

/** Componente "invisibile" che inoltra ogni cambiamento del contenuto al chiamante. */
function ChangeForwarder({onChange}: {onChange: (value: PortableTextBlock[]) => void}) {
  const editor = useEditor()

  useEffect(() => {
    const subscription = editor.subscribe({
      next: ({context}) => {
        onChange(context.value || [])
      },
    })
    return () => subscription.unsubscribe()
  }, [editor, onChange])

  return null
}

function DecoratorButton({decorator, icon}: {decorator: 'strong' | 'em'; icon: ComponentType}) {
  const editor = useEditor()
  const active = useEditorSelector(editor, (snapshot) => Boolean(snapshot.decoratorState[decorator]))

  return (
    <Button
      icon={icon}
      mode={active ? 'default' : 'bleed'}
      tone={active ? 'primary' : 'default'}
      padding={2}
      // onMouseDown invece di onClick: previene il blur del contentEditable,
      // che altrimenti perderebbe la selezione prima che il toggle si applichi.
      onMouseDown={(event) => {
        event.preventDefault()
        editor.send({type: 'decorator.toggle', decorator})
      }}
    />
  )
}

function EditorToolbar() {
  return (
    <Flex gap={1} padding={1} style={{borderBottom: '1px solid var(--card-border-color)'}}>
      <DecoratorButton decorator="strong" icon={BoldIcon} />
      <DecoratorButton decorator="em" icon={ItalicIcon} />
    </Flex>
  )
}

interface PortableTextTabEditorProps {
  value: PortableTextBlock[]
  onChange: (value: PortableTextBlock[]) => void
  placeholder?: string
}

/**
 * Editor Portable Text per un singolo tab lingua. Viene rimontato ogni volta
 * che il tab torna visibile (vedi InternationalizedInput: il TabPanel non
 * attivo ritorna null), quindi `initialValue` riflette sempre il valore
 * corrente senza bisogno di sincronizzazione esterna.
 */
export function PortableTextTabEditor({value, onChange, placeholder}: PortableTextTabEditorProps) {
  return (
    <EditorProvider initialConfig={{schemaDefinition: ptSchema, initialValue: value}}>
      <NodePlugin nodes={decoratorNodes} />
      <ChangeForwarder onChange={onChange} />
      <Box style={{border: '1px solid var(--card-border-color)', borderRadius: 4}}>
        <EditorToolbar />
        <Box padding={2} style={{minHeight: 120}}>
          <PortableTextEditable
            style={{minHeight: 100, outline: 'none'}}
            renderPlaceholder={() => (
              <Text muted size={2}>
                {placeholder}
              </Text>
            )}
          />
        </Box>
      </Box>
    </EditorProvider>
  )
}
