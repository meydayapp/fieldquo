// lib/i18n/aiSummaryCopy.js
//
// The rule-based lines that sit BESIDE an AI summary.
//
// ── Why these are not generated ────────────────────────────────────────────
//
// lib/ai/expenseSummary.js computes its flags in code precisely so they cannot
// be wrong: the arithmetic happens in JavaScript and the model only writes
// prose around numbers it was handed. Asking the model to restate them in the
// reader's language would hand that arithmetic back to it, one sentence at a
// time, which is the trade that file's own comment refuses.
//
// So they are templates. Four of them, and the interpolated values are numbers
// and a category name the company typed — nothing here reorders a sentence
// around grammatical gender or plural class, which is what would make a table
// this shape a bad idea.
//
// ── Why they had to be translated at all ───────────────────────────────────
//
// The alternative was leaving them English under a Spanish summary, and
// AGENTS.md is explicit that half-translated reads as broken where fully
// untranslated reads as unsupported. Fixing the model's paragraph and leaving
// the bullets beneath it in English would have manufactured exactly that.
//
// The six languages beyond English and French are DRAFTED, not reviewed by a
// speaker — the same standing as app/i18n/appMessages.js's APP_REVIEW_PENDING
// set, and recorded here for the same reason: so nobody later mistakes them
// for checked copy.

import { DEFAULT_LANGUAGE, isSupported } from "@/app/i18n/languages";

const COPY = {
  en: {
    runway: "At the current burn rate, cash on hand covers about {months} months.",
    share: "{category} alone is {pct}% of this month's tracked expenses.",
    rose: "Total expenses rose {pct}% vs last month.",
    fell: "Total expenses fell {pct}% vs last month.",
  },
  fr: {
    runway: "Au rythme de dépenses actuel, la trésorerie disponible couvre environ {months} mois.",
    share: "{category} représente à elle seule {pct} % des dépenses suivies ce mois-ci.",
    rose: "Les dépenses totales ont augmenté de {pct} % par rapport au mois dernier.",
    fell: "Les dépenses totales ont baissé de {pct} % par rapport au mois dernier.",
  },
  es: {
    runway: "Al ritmo de gasto actual, el efectivo disponible alcanza para unos {months} meses.",
    share: "{category} representa por sí sola el {pct} % de los gastos registrados este mes.",
    rose: "Los gastos totales subieron un {pct} % frente al mes pasado.",
    fell: "Los gastos totales bajaron un {pct} % frente al mes pasado.",
  },
  uk: {
    runway: "За поточного темпу витрат наявних коштів вистачить приблизно на {months} місяців.",
    share: "Лише на {category} припадає {pct} % облікованих витрат цього місяця.",
    rose: "Загальні витрати зросли на {pct} % порівняно з минулим місяцем.",
    fell: "Загальні витрати зменшилися на {pct} % порівняно з минулим місяцем.",
  },
  pa: {
    runway: "ਮੌਜੂਦਾ ਖਰਚ ਦੀ ਰਫ਼ਤਾਰ ਨਾਲ, ਹੱਥ ਵਿੱਚ ਮੌਜੂਦ ਨਕਦੀ ਤਕਰੀਬਨ {months} ਮਹੀਨੇ ਚੱਲੇਗੀ।",
    share: "ਇਕੱਲੇ {category} ਉੱਤੇ ਇਸ ਮਹੀਨੇ ਦੇ ਦਰਜ ਕੀਤੇ ਖਰਚਿਆਂ ਦਾ {pct} % ਹੈ।",
    rose: "ਪਿਛਲੇ ਮਹੀਨੇ ਦੇ ਮੁਕਾਬਲੇ ਕੁੱਲ ਖਰਚੇ {pct} % ਵਧੇ ਹਨ।",
    fell: "ਪਿਛਲੇ ਮਹੀਨੇ ਦੇ ਮੁਕਾਬਲੇ ਕੁੱਲ ਖਰਚੇ {pct} % ਘਟੇ ਹਨ।",
  },
  tl: {
    runway: "Sa kasalukuyang bilis ng paggastos, aabot ng humigit-kumulang {months} buwan ang perang nasa kamay mo.",
    share: "Ang {category} lang ay {pct} % na ng mga naitalang gastos ngayong buwan.",
    rose: "Tumaas ng {pct} % ang kabuuang gastos kumpara noong nakaraang buwan.",
    fell: "Bumaba ng {pct} % ang kabuuang gastos kumpara noong nakaraang buwan.",
  },
  de: {
    runway: "Beim derzeitigen Ausgabentempo reicht das vorhandene Geld noch etwa {months} Monate.",
    share: "Allein {category} macht {pct} % der in diesem Monat erfassten Ausgaben aus.",
    rose: "Die Gesamtausgaben sind gegenüber dem Vormonat um {pct} % gestiegen.",
    fell: "Die Gesamtausgaben sind gegenüber dem Vormonat um {pct} % gesunken.",
  },
  zh: {
    runway: "按目前的花钱速度，手上的现金大约还能撑 {months} 个月。",
    share: "光是{category}就占了本月已记录支出的 {pct} %。",
    rose: "总支出比上个月上涨了 {pct} %。",
    fell: "总支出比上个月下降了 {pct} %。",
  },
  it: {
    runway: "Al ritmo di spesa attuale, la liquidità disponibile copre circa {months} mesi.",
    share: "Solo {category} rappresenta il {pct} % delle spese registrate questo mese.",
    rose: "Le spese totali sono aumentate del {pct} % rispetto al mese scorso.",
    fell: "Le spese totali sono diminuite del {pct} % rispetto al mese scorso.",
  },
};

export const EXPENSE_FLAG_KEYS = Object.keys(COPY.en);
export const EXPENSE_FLAG_LANGUAGES = Object.keys(COPY);

/**
 * One flag line, in one language.
 *
 * Falls back to English per-KEY rather than per-language, so a table that
 * gains a fifth flag tomorrow degrades to one English sentence rather than to
 * a whole English list.
 */
export function expenseFlag(language, key, values = {}) {
  const code = isSupported(language) ? String(language).toLowerCase() : DEFAULT_LANGUAGE;
  const template = COPY[code]?.[key] ?? COPY[DEFAULT_LANGUAGE][key];
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    values[name] === undefined || values[name] === null ? match : String(values[name]),
  );
}

/**
 * @param facts  [{ key, values }] as computed by the caller, in order
 * @returns the same list rendered in `language`
 */
export function expenseFlagLines(language, facts = []) {
  return facts.map((f) => expenseFlag(language, f.key, f.values)).filter(Boolean);
}
