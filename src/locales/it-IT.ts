import type {PluginLocaleResources} from './en-US'

/**
 * Italian strings for the plugin's interface. See `en-US.ts` for what each key is.
 * "Source" is rendered as "lingua di partenza" in prose and "origine" on the tabs,
 * where space is short.
 */
const itIT: PluginLocaleResources = {
  'input.tab.source': '{{language}} (origine)',
  'input.placeholder': 'Testo in {{language}}',
  'input.loading': 'Caricamento delle lingue...',
  'input.load-error':
    'Impossibile caricare le impostazioni delle lingue. Controlla la console del browser per i dettagli.',
  'input.no-languages':
    'Nessuna lingua configurata. Apri le impostazioni delle lingue dalla barra di navigazione e aggiungine almeno una.',

  'action.translate': 'Traduci mancanti',
  'banner.pending_one': '{{count}} traduzione mancante o da aggiornare.',
  'banner.pending_other': '{{count}} traduzioni mancanti o da aggiornare.',
  'banner.automatic_one': 'Verrà tradotta automaticamente al salvataggio.',
  'banner.automatic_other': 'Verranno tradotte automaticamente al salvataggio.',
  'banner.translate-now': 'Traduci ora',

  'translate.in-progress': 'Traduzione in corso...',
  'translate.progress': 'Traduzione {{done}}/{{total}}...',
  'translate.done-nothing': 'È già tutto tradotto',
  'translate.done_one': '{{count}} campo tradotto',
  'translate.done_other': '{{count}} traduzioni completate (campo per lingua)',
  'translate.stopped': 'Interrotto dopo {{applied}} traduzioni su {{total}}',
  'translate.stopped-description': '{{error}} — le traduzioni già completate sono state mantenute.',
  'translate.failed': 'Traduzione non riuscita',
  'translate.no-target-language':
    'Nessuna lingua in cui tradurre: nelle impostazioni delle lingue aggiungine almeno una oltre a quella di partenza.',

  'toolbar.style.normal': 'Normale',
  'toolbar.style.h1': 'Titolo 1',
  'toolbar.style.h2': 'Titolo 2',
  'toolbar.style.h3': 'Titolo 3',
  'toolbar.style.h4': 'Titolo 4',
  'toolbar.style.h5': 'Titolo 5',
  'toolbar.style.h6': 'Titolo 6',
  'toolbar.style.blockquote': 'Citazione',
  'toolbar.decorator.strong': 'Grassetto',
  'toolbar.decorator.em': 'Corsivo',
  'toolbar.decorator.code': 'Codice',
  'toolbar.decorator.underline': 'Sottolineato',
  'toolbar.decorator.strike-through': 'Barrato',
  'toolbar.list.bullet': 'Elenco puntato',
  'toolbar.list.number': 'Elenco numerato',
  'toolbar.link.title': 'Link',
  'toolbar.link.prompt': '{{title}} — indirizzo (URL):',
  'toolbar.link.required': 'Inserisci un indirizzo per il link',

  'tool.opening': 'Apertura in corso: {{title}}...',
}

export default itIT
