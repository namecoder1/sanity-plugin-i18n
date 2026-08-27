import {
  EditorProvider,
  PortableTextEditable,
  defineAnnotation,
  defineDecorator,
  defineSchema,
  defineTextBlock,
  useEditor,
  useEditorSelector,
  type PortableTextBlock,
  type PortableTextObject,
} from '@portabletext/editor'
import {NodePlugin} from '@portabletext/editor/plugins'
import {isActiveAnnotation, isActiveListItem, isActiveStyle} from '@portabletext/editor/selectors'
import {BlockquoteIcon} from '@sanity/icons/Blockquote'
import {BoldIcon} from '@sanity/icons/Bold'
import {ItalicIcon} from '@sanity/icons/Italic'
import {LinkIcon} from '@sanity/icons/Link'
import {OlistIcon} from '@sanity/icons/Olist'
import {StrikethroughIcon} from '@sanity/icons/Strikethrough'
import {UlistIcon} from '@sanity/icons/Ulist'
import {UnderlineIcon} from '@sanity/icons/Underline'
import {Box, Button, Flex, Text} from '@sanity/ui'
import {useEffect} from 'react'
import type {ComponentType} from 'react'

/**
 * Schema per l'editor rich-text nei tab lingua: paragrafi, titoli, citazioni,
 * liste, link, e i decorator grassetto/corsivo/sottolineato/barrato. Deve
 * restare in sincronia con la definizione del campo in
 * `schemaTypes/internationalizedField.ts` (stessi valori di style/listItem/
 * decorator/annotation, sintassi diversa: quello è schema Sanity, questo è
 * schema di @portabletext/editor).
 */
const STYLES = [
  {name: 'normal', title: 'Normale'},
  {name: 'h1', title: 'Titolo 1'},
  {name: 'h2', title: 'Titolo 2'},
  {name: 'h3', title: 'Titolo 3'},
  {name: 'h4', title: 'Titolo 4'},
  {name: 'blockquote', title: 'Citazione'},
] as const

const ptSchema = defineSchema({
  decorators: [
    {name: 'strong', title: 'Grassetto'},
    {name: 'em', title: 'Corsivo'},
    {name: 'underline', title: 'Sottolineato'},
    {name: 'strike-through', title: 'Barrato'},
  ],
  styles: STYLES.map(({name, title}) => ({name, title})),
  annotations: [
    {name: 'link', title: 'Link', fields: [{name: 'href', title: 'URL', type: 'string'}]},
  ],
  lists: [
    {name: 'bullet', title: 'Puntata'},
    {name: 'number', title: 'Numerata'},
  ],
  inlineObjects: [],
  blockObjects: [],
})

/**
 * Registra COME renderizzare visivamente ogni nodo. Dichiararlo in
 * `defineSchema` (sopra) definisce solo i nomi validi nel modello dati — senza
 * questa registrazione via NodePlugin, i marks/stili vengono applicati ai
 * dati ma non producono alcun markup nel DOM. Costante a livello di modulo
 * (non ricreata ad ogni render) come richiesto dalla doc di NodePlugin, per
 * evitare un ciclo di unregister/re-register ad ogni render.
 */
const editorNodes = [
  defineDecorator({type: 'strong', render: ({children}) => <strong>{children}</strong>}),
  defineDecorator({type: 'em', render: ({children}) => <em>{children}</em>}),
  defineDecorator({type: 'underline', render: ({children}) => <u>{children}</u>}),
  defineDecorator({type: 'strike-through', render: ({children}) => <s>{children}</s>}),
  defineAnnotation({
    type: 'link',
    render: ({annotation, children}) => (
      <a
        href={(annotation as PortableTextObject & {href?: string}).href}
        style={{color: 'var(--card-link-color, #2276fc)'}}
      >
        {children}
      </a>
    ),
  }),
  // Un solo renderer per 'block' che sceglie il wrapper (titolo/citazione/
  // paragrafo, con o senza marcatore lista) in base a `node.style`/
  // `node.listItem` — l'engine non ha un concetto di "nodo lista" separato,
  // è il text-block renderer a doversene occupare (vedi TSDoc del pacchetto).
  defineTextBlock({
    type: 'block',
    render: ({node, children}) => {
      const style = (node as {style?: string}).style || 'normal'
      const listItem = (node as {listItem?: string}).listItem
      const level = (node as {level?: number}).level || 1

      const content = listItem ? (
        <Flex gap={2}>
          <Text style={{paddingLeft: (level - 1) * 20}}>{listItem === 'number' ? '1.' : '•'}</Text>
          <Box flex={1}>{children}</Box>
        </Flex>
      ) : (
        children
      )

      switch (style) {
        case 'h1':
          return <h1 style={{margin: 0}}>{content}</h1>
        case 'h2':
          return <h2 style={{margin: 0}}>{content}</h2>
        case 'h3':
          return <h3 style={{margin: 0}}>{content}</h3>
        case 'h4':
          return <h4 style={{margin: 0}}>{content}</h4>
        case 'blockquote':
          return (
            <blockquote
              style={{
                margin: 0,
                paddingLeft: 12,
                borderLeft: '3px solid var(--card-border-color)',
                fontStyle: 'italic',
              }}
            >
              {content}
            </blockquote>
          )
        default:
          return <p style={{margin: 0}}>{content}</p>
      }
    },
  }),
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

function DecoratorButton({
  decorator,
  icon,
}: {
  decorator: 'strong' | 'em' | 'underline' | 'strike-through'
  icon: ComponentType
}) {
  const editor = useEditor()
  const active = useEditorSelector(editor, (snapshot) =>
    Boolean(snapshot.decoratorState[decorator]),
  )

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

function ListButton({listItem, icon}: {listItem: 'bullet' | 'number'; icon: ComponentType}) {
  const editor = useEditor()
  const active = useEditorSelector(editor, isActiveListItem(listItem))

  return (
    <Button
      icon={icon}
      mode={active ? 'default' : 'bleed'}
      tone={active ? 'primary' : 'default'}
      padding={2}
      onMouseDown={(event) => {
        event.preventDefault()
        editor.send({type: 'list item.toggle', listItem})
      }}
    />
  )
}

// Prop chiamata `blockStyle`, non `style`: un prop React chiamato `style` deve
// essere un oggetto CSS per convenzione (e il linter lo pretende), qui invece
// è il nome dello style Portable Text ('h1', 'blockquote', ...) — una stringa.
function StyleToggleButton({
  blockStyle,
  icon,
  text,
}: {
  blockStyle: string
  icon?: ComponentType
  text?: string
}) {
  const editor = useEditor()
  const active = useEditorSelector(editor, isActiveStyle(blockStyle))

  return (
    <Button
      icon={icon}
      text={text}
      mode={active ? 'default' : 'bleed'}
      tone={active ? 'primary' : 'default'}
      padding={2}
      fontSize={1}
      onMouseDown={(event) => {
        event.preventDefault()
        editor.send({type: 'style.toggle', style: blockStyle})
      }}
    />
  )
}

function LinkButton() {
  const editor = useEditor()
  const active = useEditorSelector(editor, isActiveAnnotation('link'))

  return (
    <Button
      icon={LinkIcon}
      mode={active ? 'default' : 'bleed'}
      tone={active ? 'primary' : 'default'}
      padding={2}
      onMouseDown={(event) => {
        event.preventDefault()
        if (active) {
          // Sull'annotazione attiva, toggle la rimuove: nessun bisogno di
          // chiedere l'URL per staccare un link esistente.
          editor.send({type: 'annotation.toggle', annotation: {name: 'link', value: {}}})
          return
        }
        // Toolbar minimale, nessun sistema di dialog nel plugin: un prompt
        // nativo è il compromesso più semplice per l'MVP.
        const href = window.prompt('URL del link:')
        if (href) {
          editor.send({type: 'annotation.toggle', annotation: {name: 'link', value: {href}}})
        }
      }}
    />
  )
}

function EditorToolbar() {
  return (
    <Flex
      gap={1}
      padding={1}
      align="center"
      wrap="wrap"
      style={{borderBottom: '1px solid var(--card-border-color)'}}
    >
      <StyleToggleButton blockStyle="normal" text="¶" />
      {STYLES.filter((s) => s.name !== 'normal' && s.name !== 'blockquote').map((s) => (
        <StyleToggleButton key={s.name} blockStyle={s.name} text={s.name.toUpperCase()} />
      ))}
      <StyleToggleButton blockStyle="blockquote" icon={BlockquoteIcon} />
      <DecoratorButton decorator="strong" icon={BoldIcon} />
      <DecoratorButton decorator="em" icon={ItalicIcon} />
      <DecoratorButton decorator="underline" icon={UnderlineIcon} />
      <DecoratorButton decorator="strike-through" icon={StrikethroughIcon} />
      <ListButton listItem="bullet" icon={UlistIcon} />
      <ListButton listItem="number" icon={OlistIcon} />
      <LinkButton />
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
      <NodePlugin nodes={editorNodes} />
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
