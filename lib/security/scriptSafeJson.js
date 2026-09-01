// lib/security/scriptSafeJson.js
//
// `JSON.stringify` does not escape `<`, `>` or `&`. That is correct for JSON
// as a data format and wrong the instant the result is dropped into an HTML
// `<script>` tag: a string value containing `</script>` closes the tag early
// and whatever follows — attacker-controlled or not — runs as markup/script
// in the page. This has nothing to do with the JSON being well-formed; the
// browser's HTML parser sees the closing tag before it ever hands the
// contents to a JSON parser.
//
// Verified directly: `JSON.stringify({ name: "Acme</script><script>alert(1)" })`
// returns the closing tag intact, character for character.
//
// The fix is the standard one (the same technique React itself, Rails'
// `escape_html_entities_in_json`, and `serialize-javascript` all use):
// replace `<`, `>` and `&` with their `\uXXXX` escapes AFTER JSON.stringify
// has already quoted and escaped the string content. `<` etc. are valid
// inside a JSON string literal — any spec-compliant JSON parser (a search
// engine's structured-data reader included) decodes them straight back to
// `<`/`>`/`&`, so this changes nothing about what the data means, only how
// it's allowed to be embedded.
//
// Use this — never a bare `JSON.stringify` — for every value handed to
// `dangerouslySetInnerHTML` inside a `<script>` tag, whether the source is
// JSON-LD, a hydration payload, or anything else. Sanitising the INPUT (a
// company name, say) is not a substitute: it protects one row from one
// column, this protects the sink through which every future field will flow.
export function scriptSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
