// lib/help/lang.js
//
// Which of the three WRITTEN languages a browser asked for. Pure, executed by
// scripts/check-help-centre.mjs against the Accept-Language shapes browsers
// actually send (q-values, region subtags, junk).
import { HELP_LANGS } from "./tree";

/** Pure — the first Accept-Language tag whose primary subtag we write in. */
export function pickHelpLang(acceptLanguage) {
  const tags = String(acceptLanguage || "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((x) => x.tag && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const primary = tag.split("-")[0];
    if (HELP_LANGS.includes(primary)) return primary;
  }
  return "en";
}

