# sanity-plugin-auto-i18n


## Installation

```sh
npm install sanity-plugin-auto-i18n
```

## Usage

Add it as a plugin in `sanity.config.ts` (or .js):

```ts
import {defineConfig} from 'sanity'
import {autoI18nPlugin} from 'sanity-plugin-auto-i18n'

export default defineConfig({
  //...
  plugins: [
    autoI18nPlugin({
      apiKey: process.env.SANITY_STUDIO_MYMEMORY_KEY, // opzionale
      email: 'tuo@email.com', // opzionale, alza il rate limit di MyMemory
      defaultSourceLanguage: 'it', // fallback se nessuna lingua è marcata come sorgente
    }),
  ],
})
```

Usa i tipi `autoI18n.string` / `autoI18n.text` / `autoI18n.blockContent` al posto di
`string` / `text` / array di blocchi Portable Text nei tuoi schema:

```ts
defineField({name: 'title', type: 'autoI18n.string'})
defineField({name: 'excerpt', type: 'autoI18n.text'})
defineField({name: 'body', type: 'autoI18n.blockContent'}) // rich text (grassetto/corsivo)
```

Ognuno di questi campi salva un array `[{_key: 'it', value: '...'}, {_key: 'en', value: '...'}]`
invece di un valore singolo — un tab per lingua nell'editor dello Studio, gestito
automaticamente dal plugin.

`autoI18n.blockContent` supporta solo paragrafi con grassetto/corsivo (niente liste, link,
o oggetti custom) — è un MVP pensato per accompagnarsi alla traduzione automatica span-per-span
(vedi "Limiti noti" più sotto).

## Come si traduce

Il plugin aggiunge due modi per lanciare la traduzione automatica (fanno la stessa cosa,
ridondanti apposta perché il primo è facile da non notare):

- **Azione "Traduci mancanti"** nella toolbar del documento, subito accanto a "Pubblica".
- **Banner** in cima al form del documento, quando ci sono campi mancanti o da aggiornare,
  con un pulsante "Traduci ora".

Entrambi traducono dalla lingua sorgente verso tutte le altre lingue configurate, **saltando
i campi che hanno già una traduzione aggiornata** — se modifichi il testo sorgente dopo aver
già tradotto, il plugin se ne accorge da solo e ritraduce solo quel campo al prossimo click
(non tocca le lingue non toccate, né le traduzioni che hai modificato a mano e che nel
frattempo il sorgente non ha più cambiato).

Con `provider: 'azure'` (vedi sotto) questi due controlli spariscono: la traduzione non gira
più nel browser, ma automaticamente al salvataggio, via una Sanity Function.

### Configurare le lingue (sorgente e traduzioni automatiche)

Il plugin aggiunge una voce **"Impostazioni Lingue"** nella nav bar dello Studio. Da lì si apre
un documento singleton con un array `supportedLanguages`, dove ogni riga ha:

- `code`: il codice lingua (es. `it`, `en`, `de`) — deve corrispondere alle chiavi usate nei
  campi internazionalizzati;
- `label`: l'etichetta visibile nei tab dell'editor;
- `isDefault`: **spunta questa casella su una sola lingua** — è la lingua sorgente, quella da
  cui si parte per tradurre.

Tutte le altre lingue nell'array diventano automaticamente le lingue "target": quando premi
**"Traduci mancanti"** su un documento, il plugin traduce dalla lingua sorgente verso ognuna
delle altre lingue elencate, saltando quelle che hanno già un valore.

Se nessuna lingua ha `isDefault: true`, viene usato `defaultSourceLanguage` passato in
configurazione (o `it` come ultimo fallback).

## Motore di traduzione: MyMemory (default) o Azure Translator

```ts
autoI18nPlugin({
  provider: 'mymemory', // default — non serve scriverlo esplicitamente
  apiKey: process.env.SANITY_STUDIO_MYMEMORY_KEY, // opzionale
  email: 'tuo@email.com', // opzionale, alza il rate limit di MyMemory
})
```

**MyMemory** (default) — chiamato direttamente dal browser, funziona subito senza nessuna
configurazione aggiuntiva. Nessuna infrastruttura da creare o mantenere. Consigliato per
iniziare, per progetti piccoli, o se non vuoi gestire un account Azure.

**Azure Translator** (`provider: 'azure'`) — qualità di traduzione nettamente superiore (un
vero motore di machine translation, non una translation memory — vedi "Limiti noti"), ma
**richiede infrastruttura aggiuntiva**: la subscription key di Azure non può stare nel bundle
browser dello Studio, quindi la traduzione gira in una Sanity Function server-side che si
attiva da sola al salvataggio. Vedi la guida completa passo-passo in
[`azure-function-template/README.md`](./azure-function-template/README.md) — richiede un
account Azure (tier gratuito disponibile), qualche comando da terminale (`sanity blueprints`),
e copiare un paio di file nel repo del tuo Studio. Non è complicato, ma non è "zero
configurazione" come MyMemory: se stai solo provando il plugin, parti da MyMemory.

## Limiti noti

- **MyMemory è una translation memory, non un vero motore di traduzione**: restituisce la
  frase più simile nel suo database (spesso libri, paper accademici). Su testo breve o
  generico può occasionalmente restituire frammenti estranei del contesto originale (es. una
  citazione bibliografica). Il plugin filtra i risultati più sospetti (punteggio di qualità
  basso, lunghezza anomala) ma non è una garanzia assoluta — con Azure Translator questo non
  succede.
- **Traduzione span-per-span nel rich text**: per preservare grassetto/corsivo con API che
  traducono solo testo semplice, ogni "span" di un blocco Portable Text viene tradotto
  separatamente. Questo può ridurre la fluidità quando una frase è spezzata da formattazione
  inline (es. "il **gatto** nero" tradotto in due chiamate separate invece di una frase intera).
- **`autoI18n.blockContent` è un MVP**: solo paragrafi con grassetto/corsivo, niente liste,
  link, o oggetti custom.

## License

[MIT](LICENSE) © tobi

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.
