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
 * Schema for the rich-text editor inside the language tabs: paragraphs, headings,
 * quotes, lists, links, and the bold/italic/underline/strike-through decorators.
 *
 * Must stay in sync with the field definition in
 * `schemaTypes/internationalizedField.ts` — same style/listItem/decorator/annotation
 * values, different syntax, because that one is a Sanity schema and this one is a
 * @portabletext/editor schema.
 */
const STYLES = [
  {name: 'normal', title: 'Normal'},
  {name: 'h1', title: 'Heading 1'},
  {name: 'h2', title: 'Heading 2'},
  {name: 'h3', title: 'Heading 3'},
  {name: 'h4', title: 'Heading 4'},
  {name: 'blockquote', title: 'Quote'},
] as const

const ptSchema = defineSchema({
  decorators: [
    {name: 'strong', title: 'Bold'},
    {name: 'em', title: 'Italic'},
    {name: 'underline', title: 'Underline'},
    {name: 'strike-through', title: 'Strike'},
  ],
  styles: STYLES.map(({name, title}) => ({name, title})),
  annotations: [
    {name: 'link', title: 'Link', fields: [{name: 'href', title: 'URL', type: 'string'}]},
  ],
  lists: [
    {name: 'bullet', title: 'Bullet'},
    {name: 'number', title: 'Numbered'},
  ],
  inlineObjects: [],
  blockObjects: [],
})

/**
 * Registers HOW each node is rendered. Declaring a node in `defineSchema` above only
 * defines which names are valid in the data model — without this NodePlugin
 * registration, marks and styles are applied to the data but produce no markup in
 * the DOM at all.
 *
 * Kept as a module-level constant, not rebuilt on each render, as NodePlugin's docs
 * require: otherwise every render triggers an unregister/re-register cycle.
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
  // A single 'block' renderer that picks the wrapper — heading, quote or paragraph,
  // with or without a list marker — from `node.style` / `node.listItem`. The engine
  // has no separate notion of a "list node": handling it is the text-block
  // renderer's job (see the package's TSDoc).
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

/**
 * Invisible component that forwards every content change to the caller.
 *
 * It hooks into `editor.on('mutation')`, NOT `editor.subscribe()`. The latter fires
 * on every "relevant transition", which by contract includes plain selection moves.
 * Forwarding those meant a click or an arrow key inside the editor produced a Sanity
 * patch with unchanged content — enough to create a draft on a published document
 * the user never edited. The `mutation` event fires only on real content changes and
 * already carries the updated value.
 */
function ChangeForwarder({onChange}: {onChange: (value: PortableTextBlock[]) => void}) {
  const editor = useEditor()

  useEffect(() => {
    const subscription = editor.on('mutation', ({value}) => {
      onChange(value || [])
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
      // onMouseDown rather than onClick: it prevents the contentEditable from
      // blurring, which would drop the selection before the toggle is applied.
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

// The prop is called `blockStyle`, not `style`: a React prop named `style` is
// expected to be a CSS object by convention (and the linter insists on it), whereas
// this is the name of a Portable Text style ('h1', 'blockquote', …) — a string.
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
          // On an active annotation, toggling removes it: no need to ask for a URL
          // just to detach an existing link.
          editor.send({type: 'annotation.toggle', annotation: {name: 'link', value: {}}})
          return
        }
        // Minimal toolbar, and the plugin has no dialog system: a native prompt is
        // the simplest workable compromise here. See "Known limitations" in the
        // README — this is the one piece of UI that is knowingly unpolished.
        const href = window.prompt('Link URL:')
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
  readOnly?: boolean
}

/**
 * Portable Text editor for a single language tab. It is remounted every time the tab
 * becomes visible again (see InternationalizedInput: an inactive TabPanel returns
 * null), so `initialValue` always reflects the current value with no external
 * synchronisation needed.
 */
export function PortableTextTabEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
}: PortableTextTabEditorProps) {
  return (
    <EditorProvider initialConfig={{schemaDefinition: ptSchema, initialValue: value, readOnly}}>
      <NodePlugin nodes={editorNodes} />
      {/* Nothing to forward in read-only mode: mounting the forwarder would only
          risk emitting patches against a document that cannot be edited. */}
      {readOnly ? null : <ChangeForwarder onChange={onChange} />}
      <Box style={{border: '1px solid var(--card-border-color)', borderRadius: 4}}>
        {/* A toolbar whose buttons do nothing is worse than no toolbar: it says the
            field is editable when it is not. */}
        {readOnly ? null : <EditorToolbar />}
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
