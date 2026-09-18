// scripts/check-booking-language.mjs
//
//   npm run check:booking-language
//
// The booker's language on the public booking form: three pills, `?lang=`
// first, then what this browser chose here before, then the company's; the
// choice is posted with the booking, stored on the booking and on a client
// who had not stated one, and read by the confirmation letter and the
// manage page between the quote's fixed language and the company default.
// Judged by exit code; sources are read with comments stripped.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOOKING_LANGUAGES, bookingLanguage, bookingLangStorageKey } from "@/lib/i18n/bookingLanguages";
import { INSTANT_QUOTE_LANGUAGES } from "@/lib/i18n/instantQuoteCopy";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}

ok("the pills are the three the instant estimate offers", JSON.stringify(BOOKING_LANGUAGES) === JSON.stringify(INSTANT_QUOTE_LANGUAGES));
ok("…and every one has a hand-written letter", BOOKING_LANGUAGES.every((l) => CLIENT_DOC_COPY[l]?.visit));
ok("bookingLanguage accepts fr-CA, FR, es and refuses de, xx, null", bookingLanguage("fr-CA") === "fr" && bookingLanguage("FR") === "fr" && bookingLanguage("es") === "es" && bookingLanguage("de") === null && bookingLanguage("xx") === null && bookingLanguage(null) === null);
ok("the storage key is per company", bookingLangStorageKey("acme") !== bookingLangStorageKey("zed"));

// The resolution the letter and the manage page use.
const company = { defaultLanguage: "en" };
ok("no quote, a booker who chose French → French", resolveClientLanguage({ document: null, client: { language: "fr" }, company }) === "fr");
ok("a French quote behind the visit wins over a Spanish pill (non-negotiable 6)", resolveClientLanguage({ document: { language: "fr" }, client: { language: "es" }, company }) === "fr");
ok("nothing chosen → the company's", resolveClientLanguage({ document: null, client: null, company: { defaultLanguage: "es" } }) === "es");

const flow = decomment(read("app/book/[companySlug]/BookingFlow.js"));
ok("the form draws the three pills from the one table", /BOOKING_LANGUAGES\.map\(/.test(flow) && /BOOKING_LANGUAGE_NAMES\[code\]/.test(flow));
ok("…reads ?lang= first, then the stored pick", flow.indexOf('get("lang")') > 0 && /bookingLangStorageKey\(companySlug\)/.test(flow) && /const first = fromQuery \|\| stored/.test(flow));
ok("…falls back to the company's language from the payload only when nothing was chosen", /if \(!languageChosen && !bookingLanguage\(language\)\)/.test(flow) && /bookingLanguage\(data\?\.defaultLanguage\)/.test(flow));
ok("…stores a pick per company and changes the shell's language", /localStorage\.setItem\(bookingLangStorageKey\(companySlug\), lang\)/.test(flow) && /changeLanguage\(lang\)/.test(flow));
ok("…and still posts `language` with the booking", /\n\s+language,\n/.test(flow));
ok("the header is mounted with the pills on every step", (flow.match(/onLanguage=\{chooseLanguage\}/g) || []).length === 3);

const route = decomment(read("app/api/booking/[companySlug]/confirm/route.js"));
ok("the route judges the posted language by bookingLanguage", /const bookerLanguage = bookingLanguage\(postedLanguage\)/.test(route));
ok("…stores it on both booking creates", (route.match(/language: bookerLanguage,/g) || []).length === 2);
ok("…writes it onto a new client", /\.\.\.\(bookerLanguage \? \{ language: bookerLanguage \} : \{\}\)/.test(route));
ok("…and onto a client who had not stated one, never over a stated one", /if \(client && bookerLanguage && !client\.language\)/.test(route));
const finalize = decomment(read("lib/booking/finalizeBooking.js"));
ok("the letter reads the booking's language between the quote and the company", /client: booking\.language \? \{ language: booking\.language \} : client/.test(finalize));
const manage = decomment(read("lib/booking/manageVisit.js"));
ok("the manage page reads it too, and selects it", /client: booking\.language \? \{ language: booking\.language \} : null/.test(manage) && /language: true,\s*quote: \{ select/.test(manage));
const schema = read("prisma/schema.prisma");
ok("Booking.language exists, nullable", /model Booking \{[\s\S]*?\n  language\s+String\?/.test(schema));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
