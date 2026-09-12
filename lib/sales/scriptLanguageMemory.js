// lib/sales/scriptLanguageMemory.js
//
// Which language a rep last chose for the AI call script — remembered in
// the browser, per rep, per language-of-lead.
//
// Per REP because localStorage is per browser and a shared machine is the
// ordinary case in a sales room (lib/sales/repLanguage.js records the
// console coming up in German off a shared marketing-site click). Per
// LANGUAGE-OF-LEAD because a Quebec lead and a Texas lead are two habits: a
// bilingual rep who reads French scripts for Quebec still wants English for
// Ontario, and one remembered value would flip them every other call.
//
// A convenience only. The route decides the default and the screen opens
// on it; this changes which language the SECOND read asks for. Every read
// and write is wrapped, because localStorage throws in private windows and
// under some site-data settings, and a preference is not worth a blank
// dialler.

const PREFIX = "fieldquo-script-language";

/** The key for one rep and one kind of lead. Exported for the check. */
export function scriptLanguageKey(scriptLanguage) {
  const repId = typeof scriptLanguage?.repId === "string" && scriptLanguage.repId ? scriptLanguage.repId : "anon";
  const lead = typeof scriptLanguage?.leadLanguage === "string" && scriptLanguage.leadLanguage ? scriptLanguage.leadLanguage : "any";
  return `${PREFIX}:${repId}:${lead}`;
}

/** The remembered code, or null. Never a default. */
export function rememberedScriptLanguage(scriptLanguage, storage = typeof window !== "undefined" ? window.localStorage : null) {
  try {
    const value = storage?.getItem?.(scriptLanguageKey(scriptLanguage));
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

/** Remember a choice; choosing the default forgets it, so a later change
 *  to what "default" means reaches this rep instead of a frozen copy. */
export function rememberScriptLanguage(scriptLanguage, language, storage = typeof window !== "undefined" ? window.localStorage : null) {
  try {
    const key = scriptLanguageKey(scriptLanguage);
    if (!language || language === scriptLanguage?.default) storage?.removeItem?.(key);
    else storage?.setItem?.(key, language);
    return true;
  } catch {
    return false;
  }
}
