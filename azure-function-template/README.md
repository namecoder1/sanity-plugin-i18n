# Template: traduzione automatica via Azure Translator

`provider: 'azure'` nel plugin **non traduce da solo**. La subscription key di Azure
Translator non deve mai finire nel bundle browser dello Studio (chiunque apra lo Studio
la vedrebbe nelle richieste di rete), quindi la traduzione deve girare **server-side**,
in una [Sanity Function](https://www.sanity.io/docs/blueprints) che si attiva da sola
ogni volta che un documento viene creato o aggiornato.

Questa cartella è il codice pronto all'uso di quella Function. Non fa parte del pacchetto
npm del plugin (le Sanity Function si compilano sui server di Sanity, che non hanno
accesso al tuo `node_modules`/pacchetti locali non pubblicati) — va **copiata dentro il
tuo Studio** e deployata con la tua identità Sanity + la tua key Azure.

Se usi solo MyMemory (il provider di default) **non ti serve nulla di tutto questo** —
salta questa cartella, il bottone "Traduci mancanti" e il banner funzionano già da soli.

## 1. Crea una risorsa Azure Translator

Sul [portale Azure](https://portal.azure.com): crea una risorsa "Translator" (il tier
gratuito esiste ed è sufficiente per iniziare). Una volta creata, vai su
**Keys and Endpoint** e prendi nota di:

- **KEY 1** (va bene una delle due — KEY 2 è solo un duplicato per ruotarle senza downtime)
- **Region**, es. `italynorth` — scrivila esattamente come appare, minuscola e senza spazi

## 2. Copia i file nel tuo Studio

Copia `functions/translate-azure/` e `sanity.blueprint.ts.example` (rinominandolo
`sanity.blueprint.ts`) **nella radice del repo del tuo Studio** — non dentro `src/`,
allo stesso livello di `sanity.config.ts`.

Se il tuo Studio è già dentro una sottocartella di un monorepo (es. `apps/studio/`),
metti `sanity.blueprint.ts` e `functions/` un livello sopra, non dentro. Se invece il tuo
Studio è alla radice del repo (il caso più comune per un progetto singolo) va bene
metterli lì insieme: al deploy vedrai un avviso —

```
Notice
 Blueprint should not be co-located with a Sanity Studio.
```

— è **atteso e innocuo** in questo caso: è un consiglio di Sanity per chi gestisce più
progetti (studio, frontend, functions) nello stesso monorepo, non un errore. Ignoralo pure.

## 3. Installa le dipendenze della function

```sh
cd functions/translate-azure
npm install
cd ../..
```

Passaggio facile da dimenticare: senza questo, il deploy fallisce con un errore tipo
`Rolldown failed to resolve import "@sanity/functions"` — la function ha il suo
`package.json` separato da quello dello Studio, con le sue dipendenze da installare a parte.

## 4. Inizializza il Blueprint (una volta sola)

```sh
npx sanity@latest blueprints init . --type ts --stack-name production --project-id <il-tuo-project-id>
```

Ti chiederà conferma/login se non sei già autenticato. Questo crea uno "Stack" — lo stato
remoto deployato — collegato al tuo progetto Sanity. Non modifica ancora nulla di visibile.

## 5. Deploy (crea davvero la Function)

```sh
npx sanity@latest blueprints plan     # anteprima, sicuro, non tocca nulla
npx sanity@latest blueprints deploy   # applica per davvero
```

**Solo dopo che il deploy è completato** la Function esiste come risorsa remota — è
importante fare deploy PRIMA di impostare i secret al passo successivo, altrimenti
`functions env add` risponde `Error: Unable to find function`.

La Function funziona già a questo punto, anche senza i secret: semplicemente registra un
log di errore ("AZURE_TRANSLATOR_KEY non impostata") e non fa nulla, senza rompere niente.

## 6. Imposta i secret

```sh
npx sanity@latest functions env add translate-azure AZURE_TRANSLATOR_KEY <la-tua-KEY-1>
npx sanity@latest functions env add translate-azure AZURE_TRANSLATOR_REGION <la-tua-region>
```

## 7. Verifica che funzioni

Modifica e salva un campo internazionalizzato in italiano su un documento nello Studio,
poi controlla i log:

```sh
npx sanity@latest functions logs translate-azure
```

Dovresti vedere `Tradotti N campo/lingua su <id-documento>`. Se vuoi controllare anche il
contenuto effettivo del documento senza aprire lo Studio:

```sh
npx sanity@latest documents query '*[_id=="<id-documento>"]{...}' --project <project-id> --dataset <dataset>
```

(nota: `--project` è deprecato a favore di `--project-id`, ma entrambi funzionano ancora
al momento in cui scrivo; se il documento è ancora in bozza, il suo `_id` reale ha il
prefisso `drafts.` davanti).

## 8. Attiva Azure nello Studio

In `sanity.config.ts`:

```ts
autoI18nPlugin({
  provider: 'azure',
  defaultSourceLanguage: 'it',
})
```

Con `provider: 'azure'` il bottone "Traduci mancanti" e il pulsante nel banner spariscono
dallo Studio (non c'è più nulla da eseguire lato client) — resta solo il conteggio
informativo "N traduzioni mancanti o da aggiornare. Verranno tradotte automaticamente al
salvataggio."

## Note / limiti di questo template

- **Filtro documenti**: per default la Function gira su ogni tipo di documento tranne
  `autoI18n.languageSettings`. Se hai molti tipi documento senza campi internazionalizzati,
  puoi restringere il filtro in `sanity.blueprint.ts` (es. `_type == "post"`) per risparmiare
  invocazioni — non è indispensabile, la Function esce subito senza fare nulla se non trova
  campi da tradurre, ma un filtro più stretto è comunque più pulito.
- **Codice duplicato**: `functions/translate-azure/index.ts` contiene una copia (non un
  import) della logica di hashing/staleness del plugin, perché il pacchetto npm del plugin
  non è raggiungibile dal build remoto della Function. Se aggiorni la logica di traduzione
  nel plugin, ricordati di riportare a mano le stesse modifiche qui (è commentato nel file).
- **Test locale**: `npx sanity@latest functions test translate-azure --document-id <id>
  --dataset <dataset> --with-user-token` esegue la function in locale, ma NON legge i
  secret impostati con `functions env add` (quelli valgono solo per il deploy remoto) — per
  testare in locale con valori reali vanno passati come variabili d'ambiente della shell,
  es. `AZURE_TRANSLATOR_KEY=... npx sanity@latest functions test ...`.
