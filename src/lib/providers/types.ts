/**
 * Interfaccia comune a qualunque motore di traduzione. `translationCore.ts`
 * lavora solo contro questa interfaccia: non sa (e non deve sapere) se sotto
 * c'è MyMemory, Azure o altro — questo permette di riusare identica la
 * logica di hashing/staleness/patch sia nel plugin (browser, MyMemory) sia
 * in una Sanity Function server-side (Azure, dove vive la subscription key).
 */
export interface TranslationProvider {
  translateText(text: string, sourceLang: string, targetLang: string): Promise<string>
}
