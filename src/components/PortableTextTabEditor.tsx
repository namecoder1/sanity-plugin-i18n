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
import {CodeIcon} from '@sanity/icons/Code'
import {ItalicIcon} from '@sanity/icons/Italic'
import {LinkIcon} from '@sanity/icons/Link'
import {OlistIcon} from '@sanity/icons/Olist'
import {StrikethroughIcon} from '@sanity/icons/Strikethrough'
import {UlistIcon} from '@sanity/icons/Ulist'
import {UnderlineIcon} from '@sanity/icons/Underline'
import {Box, Button, Flex, useTheme_v2} from '@sanity/ui'
import {useEffect} from 'react'
import type {ComponentType} from 'react'
import {useTranslation} from 'sanity'

import {I18N_NAMESPACE} from '../i18n'
import {
  DECORATOR_TITLES,
  LINK_TITLE,
  LIST_TITLES,
  STYLE_TITLES,
  validateHref,
  type BlockContentDecorator,
  type BlockContentList,
  type BlockContentStyle,
  type ResolvedBlockContentConfig,
} from '../lib/blockContentConfig'
import {computeListNumbers} from '../lib/listNumbers'

/**
 * Editor schema for one configuration: the same styles/lists/decorators as the
 * Sanity schema built by `defineInternationalizedBlockContent`, in
 * @portabletext/editor syntax (`name` where Sanity uses `value`).
 *
 * Cached per configuration object rather than rebuilt per render: `EditorProvider`
 * reads `initialConfig` once, and the configuration lives on the schema type, so it
 * is the same object for as long as the Studio's schema is.
 */
const schemaCache = new WeakMap<ResolvedBlockContentConfig, ReturnType<typeof defineSchema>>()

function getEditorSchema(config: ResolvedBlockContentConfig) {
  let schema = schemaCache.get(config)
  if (!schema) {
    const toNames = (options: Array<{value: string; title: string}>) =>
      options.map(({value, title}) => ({name: value, title}))
    schema = defineSchema({
      decorators: toNames(config.decorators),
      styles: toNames(config.styles),
      annotations: config.link
        ? [
            {
              name: 'link',
              title: config.link.title,
              fields: [{name: 'href', title: 'URL', type: 'string'}],
            },
          ]
        : [],
      lists: toNames(config.lists),
      inlineObjects: [],
      blockObjects: [],
    })
    schemaCache.set(config, schema)
  }
  return schema
}

/**
 * Registers HOW each node is rendered. Declaring a node in `defineSchema` above only
 * defines which names are valid in the data model — without this NodePlugin
 * registration, marks and styles are applied to the data but produce no markup in
 * the DOM at all.
 *
 * Kept as a module-level constant, not rebuilt on each render, as NodePlugin's docs
 * require: otherwise every render triggers an unregister/re-register cycle. It holds
 * every node any configuration can use; a renderer for a decorator the current
 * schema does not declare is simply never called.
 */
const editorNodes = [
  defineDecorator({type: 'strong', render: ({children}) => <strong>{children}</strong>}),
  defineDecorator({type: 'em', render: ({children}) => <em>{children}</em>}),
  defineDecorator({type: 'code', render: ({children}) => <code>{children}</code>}),
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

      // Plain elements that inherit the editable's typography, not @sanity/ui's
      // <Text>: that one sets its own font size and trims its line box with negative
      // margins, so a marker drawn with it sat lower than the text beside it.
      const content = listItem ? (
        <div
          style={{display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: (level - 1) * 20}}
        >
          <span contentEditable={false} style={{userSelect: 'none', flexShrink: 0}}>
            {listItem === 'number' ? <ListNumber blockKey={node._key} /> : '•'}
          </span>
          <div style={{flex: 1, minWidth: 0}}>{children}</div>
        </div>
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
        case 'h5':
          return <h5 style={{margin: 0}}>{content}</h5>
        case 'h6':
          return <h6 style={{margin: 0}}>{content}</h6>
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
 * The "1." / "2." in front of a numbered list item. The block renderer only sees its
 * own block, so the position comes from the editor's whole value — computed once per
 * value for all items (see computeListNumbers), and selected as a number so an item
 * re-renders only when its own position changes.
 */
function ListNumber({blockKey}: {blockKey: string}) {
  const editor = useEditor()
  const position = useEditorSelector(
    editor,
    (snapshot) => computeListNumbers(snapshot.context.value).get(blockKey) ?? 1,
  )
  return <>{position}.</>
}

/**
 * Keeps the editor's read-only state in step with the form's.
 *
 * `EditorProvider` reads `initialConfig.readOnly` once, at mount. The Studio mounts
 * the form read-only while the document is still loading and flips it a moment later,
 * so an editor mounted in that window stayed locked — toolbar back, caret refused —
 * until a tab switch remounted it. `update readOnly` is the editor's public event for
 * changing it after mount.
 */
function ReadOnlySync({readOnly}: {readOnly: boolean}) {
  const editor = useEditor()

  useEffect(() => {
    editor.send({type: 'update readOnly', readOnly})
  }, [editor, readOnly])

  return null
}

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

const DECORATOR_ICONS: Record<BlockContentDecorator, ComponentType> = {
  'strong': BoldIcon,
  'em': ItalicIcon,
  'code': CodeIcon,
  'underline': UnderlineIcon,
  'strike-through': StrikethroughIcon,
}

const LIST_ICONS: Record<BlockContentList, ComponentType> = {
  bullet: UlistIcon,
  number: OlistIcon,
}

/**
 * A button's tooltip. The resolved configuration always carries a title, filled in
 * with an English default when the schema set none; that default is swapped for the
 * Studio-locale string, while a title the schema did set is shown as written.
 */
function useButtonTitle(key: string, title: string, defaultTitle: string | undefined): string {
  const {t} = useTranslation(I18N_NAMESPACE)
  return title === defaultTitle ? t(key) : title
}

function DecoratorButton({
  decorator,
  title: configuredTitle,
}: {
  decorator: BlockContentDecorator
  title: string
}) {
  const editor = useEditor()
  const title = useButtonTitle(
    `toolbar.decorator.${decorator}`,
    configuredTitle,
    DECORATOR_TITLES[decorator],
  )
  const active = useEditorSelector(editor, (snapshot) =>
    Boolean(snapshot.decoratorState[decorator]),
  )

  return (
    <Button
      icon={DECORATOR_ICONS[decorator]}
      title={title}
      aria-label={title}
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

function ListButton({
  listItem,
  title: configuredTitle,
}: {
  listItem: BlockContentList
  title: string
}) {
  const editor = useEditor()
  const title = useButtonTitle(`toolbar.list.${listItem}`, configuredTitle, LIST_TITLES[listItem])
  const active = useEditorSelector(editor, isActiveListItem(listItem))

  return (
    <Button
      icon={LIST_ICONS[listItem]}
      title={title}
      aria-label={title}
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
//
// The button shows a short label (¶, H2, …, or the quote icon) and puts the
// configured title — which may be long, "Sottotitolo" — in the tooltip.
function StyleToggleButton({
  blockStyle,
  title: configuredTitle,
}: {
  blockStyle: string
  title: string
}) {
  const editor = useEditor()
  const title = useButtonTitle(
    `toolbar.style.${blockStyle}`,
    configuredTitle,
    STYLE_TITLES[blockStyle as BlockContentStyle],
  )
  const active = useEditorSelector(editor, isActiveStyle(blockStyle))

  return (
    <Button
      icon={blockStyle === 'blockquote' ? BlockquoteIcon : undefined}
      text={
        blockStyle === 'blockquote'
          ? undefined
          : blockStyle === 'normal'
            ? '¶'
            : blockStyle.toUpperCase()
      }
      title={title}
      aria-label={title}
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

function LinkButton({link}: {link: Exclude<ResolvedBlockContentConfig['link'], false>}) {
  const editor = useEditor()
  const active = useEditorSelector(editor, isActiveAnnotation('link'))
  const {t} = useTranslation(I18N_NAMESPACE)
  const title = useButtonTitle('toolbar.link.title', link.title, LINK_TITLE)

  return (
    <Button
      icon={LinkIcon}
      title={title}
      aria-label={title}
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
        const href = window.prompt(t('toolbar.link.prompt', {title}))
        if (!href) return
        // Same check the Sanity schema runs on save, done up front: a link the
        // schema would reject is not applied at all, rather than applied and then
        // flagged as a validation error the user has to go and find. The "required"
        // message is the schema's English one, so the editor shows its own.
        if (!href.trim()) {
          window.alert(t('toolbar.link.required'))
          return
        }
        const result = validateHref(link, href)
        if (result !== true) {
          window.alert(result)
          return
        }
        editor.send({type: 'annotation.toggle', annotation: {name: 'link', value: {href}}})
      }}
    />
  )
}

function EditorToolbar({config}: {config: ResolvedBlockContentConfig}) {
  return (
    <Flex
      gap={1}
      padding={1}
      align="center"
      wrap="wrap"
      style={{borderBottom: '1px solid var(--card-border-color)'}}
    >
      {config.styles.map((s) => (
        <StyleToggleButton key={s.value} blockStyle={s.value} title={s.title} />
      ))}
      {config.decorators.map((d) => (
        <DecoratorButton key={d.value} decorator={d.value} title={d.title} />
      ))}
      {config.lists.map((l) => (
        <ListButton key={l.value} listItem={l.value} title={l.title} />
      ))}
      {config.link ? <LinkButton link={config.link} /> : null}
    </Flex>
  )
}

interface PortableTextTabEditorProps {
  /** Which styles/decorators/lists/link to offer — see `defineInternationalizedBlockContent`. */
  config: ResolvedBlockContentConfig
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
  config,
  value,
  onChange,
  placeholder,
  readOnly = false,
}: PortableTextTabEditorProps) {
  const {font} = useTheme_v2()
  const bodyText = font.text.sizes[2]

  return (
    <EditorProvider
      initialConfig={{schemaDefinition: getEditorSchema(config), initialValue: value, readOnly}}
    >
      <NodePlugin nodes={editorNodes} />
      <ReadOnlySync readOnly={readOnly} />
      {/* Nothing to forward in read-only mode: mounting the forwarder would only
          risk emitting patches against a document that cannot be edited. */}
      {readOnly ? null : <ChangeForwarder onChange={onChange} />}
      <Box style={{border: '1px solid var(--card-border-color)', borderRadius: 4}}>
        {/* A toolbar whose buttons do nothing is worse than no toolbar: it says the
            field is editable when it is not. */}
        {readOnly ? null : <EditorToolbar config={config} />}
        <Box padding={2} style={{minHeight: 120}}>
          <PortableTextEditable
            // The Studio's body text (Sanity UI text size 2, like the plain-text
            // inputs), set once here so paragraphs, list markers and the placeholder
            // all share one font size and line height and line up with the caret.
            style={{
              minHeight: 100,
              outline: 'none',
              fontFamily: font.text.family,
              fontSize: bodyText.fontSize,
              lineHeight: `${bodyText.lineHeight}px`,
            }}
            renderPlaceholder={() => (
              // A plain span for the same reason as the list marker: <Text> is a
              // block with its own metrics and rendered below the caret.
              <span style={{color: 'var(--card-muted-fg-color)'}}>{placeholder}</span>
            )}
          />
        </Box>
      </Box>
    </EditorProvider>
  )
}
