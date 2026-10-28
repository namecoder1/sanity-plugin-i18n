/**
 * Configuration for the internationalized rich-text types: which styles, decorators,
 * lists and link the editor offers.
 *
 * Kept free of React and `sanity` so the same resolved object can feed both halves
 * of a rich-text type — the Sanity schema in `schemaTypes/internationalizedField.ts`
 * and the editor schema in `components/PortableTextTabEditor.tsx` — and be tested
 * without either.
 */

/**
 * Block styles the editor can render. The same set Sanity's own `block` type offers
 * by default.
 *
 * @public
 */
export type BlockContentStyle = 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote'

/**
 * Decorators the editor can render. The same set Sanity's own `block` type offers by
 * default.
 *
 * @public
 */
export type BlockContentDecorator = 'strong' | 'em' | 'code' | 'underline' | 'strike-through'

/**
 * List types the editor can render.
 *
 * @public
 */
export type BlockContentList = 'bullet' | 'number'

/**
 * One entry of `styles`, `decorators` or `lists`. `title` is what the Studio shows
 * (button tooltip, Sanity's own labels); it defaults to an English name.
 *
 * @public
 */
export interface BlockContentOption<Value extends string> {
  value: Value
  title?: string
}

/**
 * Link annotation settings.
 *
 * @public
 */
export interface BlockContentLinkOptions {
  /** Label of the annotation. Default: "Link". */
  title?: string
  /**
   * Sanity type of the `href` field. `'string'` (the default) accepts relative links
   * (`/contact`, `#section`, `mailto:`, `tel:`); `'url'` is what `autoI18n.blockContent`
   * has always used, and only accepts absolute URLs.
   */
  type?: 'string' | 'url'
  /**
   * Checks an `href`: return `true` to accept it, or an error message to reject it.
   * Runs both as Sanity validation and in the editor, before the link is applied.
   * Without it, a `'string'` link accepts any non-empty value.
   */
  validate?: (href: string) => true | string
}

/** @internal Fully-resolved configuration: every title filled in, link normalised. */
export interface ResolvedBlockContentConfig {
  styles: Array<{value: BlockContentStyle; title: string}>
  decorators: Array<{value: BlockContentDecorator; title: string}>
  lists: Array<{value: BlockContentList; title: string}>
  link: false | {title: string; type: 'string' | 'url'; validate?: (href: string) => true | string}
}

/**
 * Key under the schema type's `options` where the resolved configuration lives, so
 * `InternationalizedInput` can find it on whatever schema type it is handed.
 */
export const BLOCK_CONTENT_OPTIONS_KEY = 'autoI18nBlockContent'

// Insertion order is the toolbar order when the caller omits a list. Exported so the
// editor can tell a default title (translated there to the Studio's locale) from one
// the caller set.
/** @internal */
export const STYLE_TITLES: Record<BlockContentStyle, string> = {
  normal: 'Normal',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
  blockquote: 'Quote',
}

/** @internal */
export const DECORATOR_TITLES: Record<BlockContentDecorator, string> = {
  'strong': 'Bold',
  'em': 'Italic',
  'code': 'Code',
  'underline': 'Underline',
  'strike-through': 'Strike',
}

/** @internal */
export const LIST_TITLES: Record<BlockContentList, string> = {
  bullet: 'Bullet',
  number: 'Numbered',
}

/** @internal Title of the link annotation when the caller sets none. */
export const LINK_TITLE = 'Link'

function resolveOptions<Value extends string>(
  kind: string,
  titles: Record<Value, string>,
  options: ReadonlyArray<BlockContentOption<Value>> | undefined,
): Array<{value: Value; title: string}> {
  const allowed = Object.keys(titles) as Value[]
  if (options === undefined) return allowed.map((value) => ({value, title: titles[value]}))

  const seen = new Set<string>()
  return options.map((option) => {
    // Thrown here, at schema definition time, rather than left for the editor: an
    // unknown value would otherwise surface as a style the Studio silently cannot
    // render, far from the line that caused it.
    if (!allowed.includes(option.value)) {
      throw new Error(
        `sanity-plugin-i18n: unknown ${kind} "${option.value}". Supported: ${allowed.join(', ')}.`,
      )
    }
    if (seen.has(option.value)) {
      throw new Error(`sanity-plugin-i18n: ${kind} "${option.value}" is listed twice.`)
    }
    seen.add(option.value)
    return {value: option.value, title: option.title || titles[option.value]}
  })
}

/** @internal */
export interface BlockContentConfigInput {
  styles?: ReadonlyArray<BlockContentOption<BlockContentStyle>>
  decorators?: ReadonlyArray<BlockContentOption<BlockContentDecorator>>
  lists?: ReadonlyArray<BlockContentOption<BlockContentList>>
  link?: false | BlockContentLinkOptions
}

/**
 * Validates the caller's options and fills in the defaults. An omitted list means
 * "everything Sanity offers by default"; an empty list means "none".
 *
 * @internal
 */
export function resolveBlockContentConfig(
  input: BlockContentConfigInput = {},
): ResolvedBlockContentConfig {
  const link = input.link ?? {}
  return {
    styles: resolveOptions('style', STYLE_TITLES, input.styles),
    decorators: resolveOptions('decorator', DECORATOR_TITLES, input.decorators),
    lists: resolveOptions('list', LIST_TITLES, input.lists),
    link:
      link === false
        ? false
        : {
            title: link.title || LINK_TITLE,
            type: link.type ?? 'string',
            ...(link.validate ? {validate: link.validate} : {}),
          },
  }
}

/**
 * Checks an `href` the way the Sanity schema will: the caller's `validate` if there
 * is one, otherwise "not empty". Returns `true` or the error message.
 *
 * @internal
 */
export function validateHref(
  link: Exclude<ResolvedBlockContentConfig['link'], false>,
  href: string,
): true | string {
  if (!href.trim()) return 'Link is required'
  return link.validate ? link.validate(href) : true
}

/**
 * Reads the configuration off a schema type, walking up the `type` chain: a field
 * that sets its own `options` replaces the parent's instead of merging with them, so
 * the configuration may only be found on an ancestor.
 *
 * @internal
 */
export function getBlockContentConfig(
  schemaType: {options?: unknown; type?: unknown} | null | undefined,
): ResolvedBlockContentConfig | undefined {
  let current = schemaType
  let guard = 0
  while (current && guard < 20) {
    const options = current.options as Record<string, unknown> | undefined
    const config = options?.[BLOCK_CONTENT_OPTIONS_KEY]
    if (config) return config as ResolvedBlockContentConfig
    current = current.type as typeof schemaType
    guard += 1
  }
  return undefined
}

/**
 * The configuration `autoI18n.blockContent` has always had: H1–H4 and quote, four
 * decorators, both lists, and a `url` link. Changing it would change which data that
 * type accepts, so it is frozen here rather than following the defaults above.
 *
 * @internal
 */
export const BLOCK_CONTENT_TYPE_CONFIG: BlockContentConfigInput = {
  styles: [
    {value: 'normal'},
    {value: 'h1'},
    {value: 'h2'},
    {value: 'h3'},
    {value: 'h4'},
    {value: 'blockquote'},
  ],
  decorators: [{value: 'strong'}, {value: 'em'}, {value: 'underline'}, {value: 'strike-through'}],
  lists: [{value: 'bullet'}, {value: 'number'}],
  link: {type: 'url'},
}
