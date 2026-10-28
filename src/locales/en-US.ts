/**
 * English strings for the plugin's interface: the default locale, and the one
 * i18next falls back on for any key a Studio locale does not provide.
 *
 * Keys are prefixed with the part of the interface that shows them. Plurals follow
 * i18next's rules (`_one` / `_other`, selected by `count`). `{{…}}` are i18next
 * interpolations, filled in by the component.
 *
 * Every other locale is typed against this object (`PluginLocaleResources`), so a
 * key added here and forgotten there fails the type check instead of silently
 * falling back to English.
 */
const enUS = {
  /** Tab label of the language translation starts from. */
  'input.tab.source': '{{language}} (source)',
  /** Placeholder of the text input / rich-text editor in one language tab. */
  'input.placeholder': 'Text in {{language}}',
  'input.loading': 'Loading languages...',
  'input.load-error': 'Could not load language settings. Check the browser console for details.',
  'input.no-languages':
    'No language configured. Open the language settings from the navbar and add at least one language.',

  /** Label of the "Translate missing" document action. */
  'action.translate': 'Translate missing',
  /** Banner bar: missing or stale translations in the open document. */
  'banner.pending_one': '{{count}} translation missing or out of date.',
  'banner.pending_other': '{{count}} translations missing or out of date.',
  /** Appended to the banner text with provider 'azure', where a Function translates on save. */
  'banner.automatic_one': 'It will be translated automatically on save.',
  'banner.automatic_other': 'They will be translated automatically on save.',
  'banner.translate-now': 'Translate now',

  /** Shared by the action and the banner while a run is in progress. */
  'translate.in-progress': 'Translating...',
  'translate.progress': 'Translating {{done}}/{{total}}...',
  'translate.done-nothing': 'Everything is already translated',
  'translate.done_one': 'Translated {{count}} field',
  'translate.done_other': 'Translated {{count}} field/language pairs',
  'translate.stopped': 'Stopped after {{applied}} of {{total}} translations',
  /** Description of the "stopped" toast; `error` is the provider's message. */
  'translate.stopped-description': '{{error}} — what was already translated has been kept.',
  'translate.failed': 'Translation failed',
  'translate.no-target-language':
    'No target language configured: add at least one language besides the source one in the language settings.',

  /** Rich-text toolbar: tooltips of buttons whose schema sets no title of its own. */
  'toolbar.style.normal': 'Normal',
  'toolbar.style.h1': 'Heading 1',
  'toolbar.style.h2': 'Heading 2',
  'toolbar.style.h3': 'Heading 3',
  'toolbar.style.h4': 'Heading 4',
  'toolbar.style.h5': 'Heading 5',
  'toolbar.style.h6': 'Heading 6',
  'toolbar.style.blockquote': 'Quote',
  'toolbar.decorator.strong': 'Bold',
  'toolbar.decorator.em': 'Italic',
  'toolbar.decorator.code': 'Code',
  'toolbar.decorator.underline': 'Underline',
  'toolbar.decorator.strike-through': 'Strike',
  'toolbar.list.bullet': 'Bullet',
  'toolbar.list.number': 'Numbered',
  'toolbar.link.title': 'Link',
  /** Native prompt asking for a link's URL; `title` is the link button's title. */
  'toolbar.link.prompt': '{{title}} URL:',
  'toolbar.link.required': 'Link is required',

  /** Shown for the instant the navbar tool takes to redirect; `title` is the tool's title. */
  'tool.opening': 'Opening {{title}}...',
}

/** @internal The shape every locale bundle of the plugin must have. */
export type PluginLocaleResources = Record<keyof typeof enUS, string>

export default enUS
