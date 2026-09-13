// Harness stub: the real hook needs LanguageProvider. Same resolution and
// interpolation, English catalogue, so the rendered words are the shipped ones.
import { APP_MESSAGES } from "@/app/i18n/appMessages";
const lang = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("lang")) || "en";
// One stable t, like the real hook's useCallback([language]) — a fresh
// function per render would re-run every effect that lists t as a dep.
const t = (key, fallbackOrValues, maybeValues) => {
    const isValues = fallbackOrValues && typeof fallbackOrValues === "object" && !Array.isArray(fallbackOrValues);
    const fallback = isValues ? undefined : fallbackOrValues;
    const values = isValues ? fallbackOrValues : maybeValues;
    let raw = APP_MESSAGES[lang]?.[key] ?? APP_MESSAGES.en?.[key] ?? fallback ?? key;
    if (typeof raw === "function") return raw(values ?? {});
    if (values) for (const [k, v] of Object.entries(values)) raw = String(raw).split(`{${k}}`).join(String(v));
    return raw;
};
export function useTranslation() {
  return { t, language: lang, changeLanguage: () => {} };
}
