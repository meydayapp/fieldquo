// lib/security/rejectMarkupCharacters.js
//
// A business name has no legitimate reason to contain `<` or `>`. Every
// language this product ships — including Ukrainian and Punjabi — writes its
// punctuation without them; the characters that DO belong in a company name
// (&, apostrophes, accents, em dashes, digits) all pass through untouched.
//
// This is a second layer behind lib/security/scriptSafeJson.js, not a
// replacement for it. The sink fix is what actually stops the attack — it
// protects every row already in the database, and every future place a
// company field gets rendered, including ones nobody has written yet. This
// check only stops a NEW `<script>` from being typed into the one field that
// is known to reach a `<script>` tag today; it does nothing for a row planted
// before this shipped, or for a field added tomorrow that forgets to call it.
export function containsMarkupCharacters(value) {
  return typeof value === "string" && /[<>]/.test(value);
}
