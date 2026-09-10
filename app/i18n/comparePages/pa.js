// app/i18n/comparePages/pa.js
//
// Punjabi (Gurmukhi). DRAFTED, not natively authored — see the note in
// ./index.js. Put it in front of a native speaker before /compare becomes an
// acquisition channel for Punjabi-speaking contractors.
//
// Register follows the `pa` block of app/i18n/messages.js: plain spoken
// Punjabi, ਤੁਸੀਂ throughout, no Urdu- or Hindi-leaning formal register. Trade
// vocabulary is transliterated exactly as that block already transliterates it
// — ਕੋਟ, ਇਨਵੌਇਸ, ਪਲਾਨ, ਕਰੂ, ਸੀਟ, ਯੂਜ਼ਰ, ਐਡ-ਆਨ, ਕ੍ਰੈਡਿਟ — because that is the
// English a Surrey drywaller actually says, and a coined Punjabi word for
// "quote" would read as a different product than the one in the app.
//
// Two decisions a reviewer should push back on if they disagree. "tier" is
// ਪੱਧਰ rather than a transliteration, since the competitor's own tier NAMES
// stay Latin beside it and two transliterations in one line read as one word.
// And Jobber's "marketing suite" is left in English inside compare.lede.jobber
// even though the English sentence lower-cases it: it is close enough to their
// Marketing Suite product name that translating it would be translating a
// quotation.
//
// The concessions and hedges — unverifiedConcessionNote, staleClaimNote,
// matchUnknownIntro, theirTiersNoMatchNote, aiMeteringOurs, entryGapAdvice —
// were translated last and deliberately narrow. "ਅਸੀਂ ਜਾਂਚ ਨਹੀਂ ਕੀਤੀ" is not
// "ਉਹਨਾਂ ਕੋਲ ਨਹੀਂ ਹੈ", and nothing here may drift toward the second.

const pa = {
  "compare.eyebrow": "ਤੁਲਨਾ",
  "compare.indexTitle": "FieldQuo ਦੀ ਤੁਲਨਾ ਕਰੋ",
  "compare.indexLede": "ਪੰਜ ਤੁਲਨਾਵਾਂ, ਹਰ ਇੱਕ ਉਸ ਗੱਲ ਤੋਂ ਬਣੀ ਜੋ ਦੂਜੀ ਕੰਪਨੀ ਆਪਣੀ ਵੈੱਬਸਾਈਟ ਉੱਤੇ ਆਪ ਛਾਪਦੀ ਹੈ। ਇੱਥੇ ਕੋਈ ਰਕਮ ਇੱਕ ਮੁਦਰਾ ਤੋਂ ਦੂਜੀ ਵਿੱਚ ਨਹੀਂ ਬਦਲੀ ਗਈ, ਕੋਈ ਵੀ ਭਾਅ ਛੋਟ ਵਾਲਾ ਨਹੀਂ ਹੈ, ਅਤੇ ਜਿਹੜੀ ਗੱਲ ਅਸੀਂ ਪੱਕੀ ਨਾ ਕਰ ਸਕੇ ਉਹ ਅੰਦਾਜ਼ੇ ਨਾਲ ਭਰਨ ਦੀ ਥਾਂ ਸਾਫ਼ ਲਿਖ ਦਿੱਤੀ ਗਈ ਹੈ। ਪੰਜਾਂ ਵਿੱਚੋਂ ਇੱਕ ਸਾਡੇ ਨਾਲੋਂ ਸਸਤੇ ਤੋਂ ਸ਼ੁਰੂ ਹੁੰਦੀ ਹੈ, ਅਤੇ ਉਹ ਪੰਨਾ ਹੋਰ ਕੁਝ ਕਹਿਣ ਤੋਂ ਪਹਿਲਾਂ ਇਹੀ ਕਹਿੰਦਾ ਹੈ।",
  "compare.rulesTitle": "ਇਹ ਪੰਨੇ ਕਿਵੇਂ ਬਣਾਏ ਗਏ ਹਨ",
  "compare.entryGapTitle": "ਉਹ ਸਾਡੇ ਨਾਲੋਂ ਸਸਤੇ ਤੋਂ ਸ਼ੁਰੂ ਹੁੰਦੇ ਹਨ",
  "compare.entryGapIntro": "ਇਸ ਸਾਈਟ ਦੀ ਹਰ ਤੁਲਨਾ ਸਾਡੇ ਹੱਕ ਵਿੱਚ ਨਹੀਂ ਜਾਂਦੀ, ਅਤੇ ਇਹ ਵਾਲੀ ਨਹੀਂ ਜਾਂਦੀ। ਹੇਠਾਂ ਦਿੱਤੀਆਂ ਦੋ ਕੀਮਤਾਂ ਉਹਨਾਂ ਦਾ ਛਾਪਿਆ ਹੋਇਆ ਅੰਕੜਾ ਅਤੇ ਸਾਡਾ ਆਪਣਾ ਸਭ ਤੋਂ ਸਸਤਾ ਪੜਾਅ ਹਨ, ਦੋਵੇਂ ਉਹਨਾਂ ਹੀ ਰਿਕਾਰਡਾਂ ਵਿੱਚੋਂ ਪੜ੍ਹੀਆਂ ਗਈਆਂ ਜੋ ਇਸ ਪੰਨੇ ਦਾ ਬਾਕੀ ਹਿੱਸਾ ਵਰਤਦਾ ਹੈ।",
  "compare.entryGapTheirListIntro": "ਉਸ ਪਲਾਨ ਉੱਤੇ ਉਹਨਾਂ ਦਾ ਆਪਣਾ ਪੰਨਾ ਕੀ ਗਿਣਾਉਂਦਾ ਹੈ, ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ:",
  "compare.entryGapAdvice": "ਜੇ ਤੁਹਾਨੂੰ ਓਹੀ ਕੰਮ ਕਰਵਾਉਣਾ ਹੈ, ਤਾਂ ਉਹਨਾਂ ਦਾ ਹੀ ਲਵੋ। ਅਸੀਂ ਇਹ ਗੱਲ ਇੱਥੇ ਲਿਖਣੀ ਚੰਗੀ ਸਮਝਦੇ ਹਾਂ, ਨਾ ਕਿ ਕਿਸੇ ਨੂੰ ਉਸ ਦੀ ਵਰਤੋਂ ਤੋਂ ਵੱਧ ਸਾਫ਼ਟਵੇਅਰ ਵੇਚ ਕੇ ਬਾਅਦ ਵਿੱਚ ਪੈਸੇ ਵਾਪਸ ਕਰਨ ਵੇਲੇ ਉਸੇ ਨੂੰ ਮਿਲਣਾ। ਜਵਾਬ ਉਦੋਂ ਬਦਲਦਾ ਹੈ ਜਦੋਂ ਨਾਲ ਕਰੂ ਹੋਵੇ: ਉਹਨਾਂ ਦੇ ਪਲਾਨ ਹਰ ਲੌਗਇਨ ਨੂੰ ਪੈਸੇ ਵਾਲਾ ਯੂਜ਼ਰ ਗਿਣਦੇ ਹਨ, ਸਾਡੇ ਨਹੀਂ ਗਿਣਦੇ।",
  "compare.theirTiersTitle": "ਉਹਨਾਂ ਦਾ ਹਰ ਪਲਾਨ ਕੀ ਵਾਧਾ ਕਰਦਾ ਹੈ, ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ",
  "compare.theirTiersIntro": "ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਪੱਧਰਾਂ ਬਾਰੇ ਉਹਨਾਂ ਦਾ ਆਪਣਾ ਵੇਰਵਾ, ਜਿਵੇਂ ਉਹਨਾਂ ਦਾ ਪੰਨਾ ਪੇਸ਼ ਕਰਦਾ ਹੈ ਓਵੇਂ ਹੀ ਹਵਾਲੇ ਵਜੋਂ, ਨਾਲ ਉਹ ਕੀਮਤ ਜਿਸ ਉੱਤੇ ਹਰ ਪੱਧਰ ਪਹੁੰਚਦਾ ਹੈ। ਅਸੀਂ ਇਸ ਵਿੱਚੋਂ ਕੁਝ ਵੀ ਆਪਣੀ ਸ਼ਬਦਾਵਲੀ ਵਿੱਚ ਨਹੀਂ ਢਾਲਿਆ: ਮੁਕਾਬਲੇ ਵਾਲੀ ਕੰਪਨੀ ਦੀ ਸਹੂਲਤ ਨੂੰ ਆਪਣੀ ਸਹੂਲਤ ਵਰਗਾ ਨਾਂ ਦੇ ਦੇਣਾ ਹੀ ਉਹ ਤਰੀਕਾ ਹੈ ਜਿਸ ਨਾਲ ਤੁਲਨਾ ਚੁੱਪ-ਚਾਪ ਬਣਾਵਟੀ ਬਣ ਜਾਂਦੀ ਹੈ। ਸੋ ਹੇਠਲੇ ਸ਼ਬਦ ਉਹਨਾਂ ਦੇ ਹਨ, ਅਤੇ ਸਾਡੀ ਸੂਚੀ ਇਸ ਪੰਨੇ ਵਿੱਚ ਹੋਰ ਹੇਠਾਂ, ਵੱਖਰੀ ਹੈ।",
  "compare.theirTiersNoMatchNote": "ਕਿਸੇ ਨੇ ਸਹੂਲਤ-ਦਰ-ਸਹੂਲਤ ਇਹ ਤੈਅ ਨਹੀਂ ਕੀਤਾ ਕਿ ਉਹਨਾਂ ਦਾ ਕਿਹੜਾ ਪੱਧਰ ਸਾਡੀਆਂ ਵੇਚੀਆਂ ਜਾਂਦੀਆਂ ਸਹੂਲਤਾਂ ਵਿੱਚੋਂ ਕਿਹੜੀ ਚੁੱਕਦਾ ਹੈ। ਉਹਨਾਂ ਦਾ ਪੰਨਾ ਆਪਣੇ ਪਲਾਨ ਲਿਖਤੀ ਵੇਰਵੇ ਵਿੱਚ ਦੱਸਦਾ ਹੈ ਅਤੇ ਸਾਡੀ ਖੋਜ ਵਿੱਚ ਪੱਧਰ-ਦਰ-ਪੱਧਰ ਕੋਈ ਜਵਾਬ ਦਰਜ ਨਹੀਂ ਹੈ, ਇਸ ਲਈ ਇਹ ਪੰਨਾ ਕਿਸੇ ਵੀ ਪਾਸੇ ਕੋਈ ਮਿਲਾਨ ਵਾਲਾ ਦਾਅਵਾ ਨਹੀਂ ਕਰਦਾ — ਉਹਨਾਂ ਦੀ ਸੂਚੀ ਪੜ੍ਹੋ, ਸਾਡੀ ਪੜ੍ਹੋ, ਅਤੇ ਆਪ ਫ਼ੈਸਲਾ ਕਰੋ।",
  "compare.matchUnknownIntro": "ਕਿਸੇ ਨੇ ਇਹ ਤੈਅ ਨਹੀਂ ਕੀਤਾ ਕਿ ਉਹਨਾਂ ਦਾ ਕਿਹੜਾ ਪੱਧਰ ਇਹ ਚੁੱਕਦਾ ਹੈ, ਇਸ ਲਈ ਇਹ ਪੰਨਾ ਕਿਸੇ ਪੱਧਰ ਦਾ ਨਾਂ ਨਹੀਂ ਲੈਂਦਾ। ਇਹ ਇਹ ਦਾਅਵਾ ਨਹੀਂ ਹੈ ਕਿ ਉਹਨਾਂ ਕੋਲ ਇਹ ਨਹੀਂ ਹੈ — ਅਸੀਂ ਜਾਂਚ ਨਹੀਂ ਕੀਤੀ, ਅਤੇ ਜਿਹੜਾ ਪੰਨਾ ਬਿਨਾਂ ਜਾਂਚੇ ਕਿਸੇ ਗੱਲ ਨੂੰ ਗ਼ੈਰ-ਹਾਜ਼ਰੀ ਮੰਨ ਲਵੇ, ਉਹ ਪੰਨਾ ਗੱਲਾਂ ਘੜ ਰਿਹਾ ਹੁੰਦਾ ਹੈ।",
  "compare.aiMeteringTitle": "ਹਰ ਪਾਸਾ ਆਪਣੇ AI ਦਾ ਹਿਸਾਬ ਕਿਵੇਂ ਲਾਉਂਦਾ ਹੈ",
  "compare.aiMeteringIntro": "ਉਹਨਾਂ ਦਾ AI ਮਹੀਨਾਵਾਰ ਹੱਦ ਵਜੋਂ ਵਿਕਦਾ ਹੈ ਜੋ ਪੱਧਰ ਨਾਲ ਬਦਲਦੀ ਹੈ, ਅਤੇ ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਪੰਨੇ ਉੱਤੇ ਛਪੀ ਹੋਈ ਹੈ। ਸਾਡਾ ਇਸ ਤਰ੍ਹਾਂ ਨਹੀਂ ਵਿਕਦਾ, ਅਤੇ ਇਸ ਗੱਲ ਦੇ ਇਮਾਨਦਾਰ ਰੂਪ ਦੇ ਦੋ ਹਿੱਸੇ ਹਨ।",
  "compare.aiMeteringOurs": "FieldQuo AI ਨੂੰ ਕ੍ਰੈਡਿਟ ਦੇ ਹਿਸਾਬ ਨਾਲ ਨਹੀਂ ਵੇਚਦਾ: ਸਾਡੇ ਕੀਮਤਾਂ ਵਾਲੇ ਪੰਨੇ ਉੱਤੇ ਹਰ ਪਲਾਨ ਲਈ ਕੋਈ ਅਜਿਹੀ ਹੱਦ ਨਹੀਂ ਜੋ ਮੁੱਕ ਜਾਵੇ, ਅਤੇ ਨਾ ਹੀ ਕੋਈ ਵੱਡਾ ਬੰਡਲ ਹੈ ਜਿਸ ਲਈ ਉੱਪਰ ਜਾਣਾ ਪਵੇ। ਰਿਸੈਪਸ਼ਨਿਸਟ ਹਰ ਪਲਾਨ ਵਿੱਚ ਹੈ, ਗੱਲ ਕਰਨ ਦਾ ਸਮਾਂ ਵੱਖਰੇ ਤੌਰ 'ਤੇ ਪਹਿਲਾਂ ਭਰੇ ਕ੍ਰੈਡਿਟ ਵਜੋਂ ਖਰੀਦਿਆ ਜਾਂਦਾ ਹੈ ਅਤੇ ਕੋਈ ਮਹੀਨਾਵਾਰ ਘੱਟੋ-ਘੱਟ ਨਹੀਂ, ਸੋ ਜਿਸ ਮਹੀਨੇ ਕੋਈ ਕਾਲ ਨਾ ਆਵੇ ਉਸ ਦਾ ਇਸ ਲਈ ਕੁਝ ਨਹੀਂ ਲੱਗਦਾ। ਦੂਜਾ ਹਿੱਸਾ, ਜੋ ਇੱਥੇ ਹੀ ਲਿਖਣਾ ਬਣਦਾ ਹੈ: ਮਾਡਲ ਦੀ ਵਰਤੋਂ ਹਰ ਕੰਪਨੀ ਲਈ ਇੱਕ ਹੱਦ ਦੇ ਮੁਕਾਬਲੇ ਮਾਪੀ ਜਾਂਦੀ ਹੈ ਜੋ ਅਸੀਂ ਅੰਦਰੂਨੀ ਤੌਰ 'ਤੇ ਤੈਅ ਕਰਦੇ ਹਾਂ, ਸੋ ਇਹ ਪੰਨਾ ਕਿਤੇ ਵੀ ਇਹ ਦਾਅਵਾ ਨਹੀਂ ਕਰ ਰਿਹਾ ਕਿ ਇਹ ਅਸੀਮਤ ਹੈ।",
  "compare.concessionTitle": "FieldQuo ਕੀ ਨਹੀਂ ਕਰਦਾ",
  "compare.concessionIntro": "ਇਹ ਹਿੱਸਾ ਇਹਨਾਂ ਸਾਰੇ ਪੰਨਿਆਂ ਉੱਤੇ ਹੈ, ਉਸੇ ਥਾਂ, ਉਸ ਹਿੱਸੇ ਤੋਂ ਉੱਪਰ ਜਿੱਥੇ ਅਸੀਂ ਚੰਗੇ ਲੱਗਦੇ ਹਾਂ। ਸਿਰਫ਼ ਆਪਣੀਆਂ ਜਿੱਤਾਂ ਨਾਲ ਬਣੀ ਤੁਲਨਾ ਕਿਸੇ ਨੂੰ ਅਜਿਹੀ ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਵੇਚ ਦਿੰਦੀ ਹੈ ਜਿਸ ਦੇ ਪੈਸੇ ਉਹ ਵਾਪਸ ਮੰਗਦਾ ਹੈ।",
  "compare.unverifiedConcessionNote": "ਅਸੀਂ ਇਹ ਨਹੀਂ ਜਾਂਚਿਆ ਕਿ ਇਹ ਕੰਪਨੀ ਇਹ ਦਿੰਦੀ ਹੈ ਜਾਂ ਨਹੀਂ, ਇਸ ਲਈ ਅਸੀਂ ਇਹ ਨਹੀਂ ਕਹਿ ਰਹੇ ਕਿ ਉਹ ਦਿੰਦੀ ਹੈ।",
  "compare.staleClaimNote": "ਉਹ ਰੀਡਿੰਗ ਤਿੰਨ ਮਹੀਨਿਆਂ ਤੋਂ ਵੱਧ ਪੁਰਾਣੀ ਹੈ, ਇਸ ਲਈ ਉਸ ਵਿਚਲੀ ਕੋਈ ਵੀ ਰਕਮ ਉਦੋਂ ਤੱਕ ਰੋਕ ਕੇ ਰੱਖੀ ਗਈ ਹੈ ਜਦੋਂ ਤੱਕ ਕੋਈ ਉਹਨਾਂ ਦਾ ਪੰਨਾ ਦੁਬਾਰਾ ਨਾ ਵੇਖ ਲਵੇ। ਲਿੰਕ ਖੋਲ੍ਹੋ ਅਤੇ ਵੇਖੋ ਕਿ ਅੱਜ ਉਸ ਉੱਤੇ ਕੀ ਲਿਖਿਆ ਹੈ।",
  "compare.advantageTitle": "FieldQuo ਕਿੱਥੇ ਅੱਗੇ ਹੈ",
  "compare.advantageIntro": "ਇਹਨਾਂ ਵਿੱਚੋਂ ਹਰ ਇੱਕ ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਪੰਨੇ ਤੋਂ ਦਿਖਾਈ ਗਈ ਤਾਰੀਖ਼ ਨੂੰ ਪੜ੍ਹਿਆ ਗਿਆ ਸੀ। ਲਿੰਕ ਖੋਲ੍ਹੋ ਅਤੇ ਆਪ ਜਾਂਚ ਲਵੋ — ਲਿੰਕ ਇਸੇ ਲਈ ਹੈ।",
  "compare.priceTitle": "ਕੀਮਤ, ਜਿਵੇਂ ਹਰ ਕੰਪਨੀ ਆਪ ਛਾਪਦੀ ਹੈ",
  "compare.featuresTitle": "FieldQuo ਨਾਲ ਤੁਹਾਨੂੰ ਕੀ ਮਿਲਦਾ ਹੈ",
  "compare.featuresIntro": "ਹੇਠਲੀ ਹਰ ਸਤਰ ਇੱਕ ਅਜਿਹੀ ਸਹੂਲਤ ਹੈ ਜਿਸ ਪਿੱਛੇ ਬਣਿਆ ਹੋਇਆ ਕੰਮ ਹੈ। ਇਹ ਸੂਚੀ ਉਸੇ ਰਿਕਾਰਡ ਤੋਂ ਬਣਦੀ ਹੈ ਜਿਸ ਦੇ ਮੁਕਾਬਲੇ ਇੰਜੀਨੀਅਰਿੰਗ ਦੀਆਂ ਜਾਂਚਾਂ ਚੱਲਦੀਆਂ ਹਨ, ਸੋ ਜਿਹੜੀ ਸਹੂਲਤ ਕੰਮ ਕਰਨਾ ਬੰਦ ਕਰ ਦੇਵੇ, ਉਸ ਦਾ ਇਸ਼ਤਿਹਾਰ ਵੀ ਬੰਦ ਹੋ ਜਾਂਦਾ ਹੈ।",
  "compare.ctaTitle": "ਕਾਰਡ ਦਰਜ ਕਰਵਾਉਣ ਨਾਲ ਪਹਿਲਾ ਮਹੀਨਾ ਮੁਫ਼ਤ, ਅਤੇ ਸ਼ੁਰੂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਤੁਸੀਂ ਕੀਮਤ ਪੜ੍ਹ ਸਕਦੇ ਹੋ",
  "compare.ctaBody": "ਕੋਈ ਕਾਲ ਬੁੱਕ ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ, ਅਤੇ ਕੀਮਤ ਕਿਸੇ ਫ਼ਾਰਮ ਦੇ ਪਿੱਛੇ ਨਹੀਂ, ਕੀਮਤਾਂ ਵਾਲੇ ਪੰਨੇ ਉੱਤੇ ਹੀ ਹੈ। ਤੁਹਾਡਾ ਕਾਰਡ ਸਾਈਨ ਅੱਪ ਵੇਲੇ ਲਿਆ ਜਾਂਦਾ ਹੈ ਅਤੇ ਮੁਫ਼ਤ ਮਹੀਨਾ ਮੁੱਕਣ ਤੱਕ ਉਸ ਤੋਂ ਪੈਸੇ ਨਹੀਂ ਕੱਟੇ ਜਾਂਦੇ।",
  "compare.ctaButton": "ਆਪਣਾ ਮੁਫ਼ਤ ਮਹੀਨਾ ਸ਼ੁਰੂ ਕਰੋ",
  "compare.ctaSecondary": "ਕੀਮਤਾਂ ਵੇਖੋ",
  "compare.otherPagesTitle": "ਬਾਕੀ ਤੁਲਨਾਵਾਂ",
  "compare.rule.1": "ਹਰ ਕੀਮਤ ਉਹ ਆਮ ਕੀਮਤ ਹੈ ਜੋ ਕੰਪਨੀ ਆਪਣੇ ਕੀਮਤਾਂ ਵਾਲੇ ਪੰਨੇ ਉੱਤੇ ਛਾਪਦੀ ਹੈ। ਛੋਟ ਵਾਲੀਆਂ ਕੀਮਤਾਂ ਛੱਡ ਦਿੱਤੀਆਂ ਗਈਆਂ ਹਨ: ਇਸ ਵਰਗਾ ਪੰਨਾ ਇੱਕ ਵਾਰ ਬਣਦਾ ਹੈ ਅਤੇ ਮਹੀਨਿਆਂ ਤੱਕ ਦਿਖਾਇਆ ਜਾਂਦਾ ਹੈ, ਅਤੇ ਇਸ ਨੂੰ ਪਤਾ ਨਹੀਂ ਲੱਗ ਸਕਦਾ ਕਿ ਕੋਈ ਪੇਸ਼ਕਸ਼ ਖ਼ਤਮ ਹੋ ਗਈ ਹੈ।",
  "compare.rule.2": "ਰਕਮ ਉਸੇ ਮੁਦਰਾ ਵਿੱਚ ਰਹਿੰਦੀ ਹੈ ਜਿਸ ਵਿੱਚ ਛਾਪੀ ਗਈ ਸੀ। ਅਸੀਂ ਕਦੇ ਬਦਲੀ ਨਹੀਂ ਕਰਦੇ। ਬਦਲੀ ਦਾ ਭਾਅ ਜਿਸ ਦਿਨ ਵੇਖੋ ਉਸ ਦਿਨ ਸਹੀ ਹੁੰਦਾ ਹੈ ਅਤੇ ਅਗਲੇ ਦਿਨ ਗ਼ਲਤ, ਅਤੇ ਸਥਿਰ ਪੰਨੇ ਉੱਤੇ ਪਿਆ ਬਦਲਿਆ ਹੋਇਆ ਅੰਕੜਾ ਉਹ ਹਿਸਾਬ ਹੈ ਜਿਸ ਨੂੰ ਕੋਈ ਨਹੀਂ ਜਾਂਚ ਰਿਹਾ।",
  "compare.rule.3": "ਜਿੱਥੇ ਅਸੀਂ ਪੱਕਾ ਨਾ ਕਰ ਸਕੇ ਕਿ ਕਿਸੇ ਅੰਕੜੇ ਦਾ ਕੀ ਮਤਲਬ ਸੀ, ਉੱਥੇ ਸਤਰ ਇਹੀ ਦੱਸਦੀ ਹੈ ਅਤੇ ਕੋਈ ਨੰਬਰ ਨਹੀਂ ਦਿਖਾਉਂਦੀ। ਇਹ ਤੁਹਾਡੀ ਸੋਚ ਨਾਲੋਂ ਵੱਧ ਵਾਰ ਹੁੰਦਾ ਹੈ, ਅਤੇ ਇਹੀ ਪੰਨੇ ਦਾ ਉਹ ਹਿੱਸਾ ਹੈ ਜਿਸ ਉੱਤੇ ਸਾਨੂੰ ਸਭ ਤੋਂ ਵੱਧ ਭਰੋਸਾ ਹੈ।",
  "compare.rule.4": "ਹਰ ਅੰਕੜੇ ਨਾਲ ਉਹ ਤਾਰੀਖ਼ ਅਤੇ ਉਹ ਦੇਸ਼ ਲੱਗਾ ਹੋਇਆ ਹੈ ਜਿਸ ਦਿਨ ਅਤੇ ਜਿੱਥੋਂ ਇਹ ਪੜ੍ਹਿਆ ਗਿਆ, ਕਿਉਂਕਿ ਕੀਮਤ ਦੋਵਾਂ ਨਾਲ ਵੱਖਰੀ ਹੋ ਸਕਦੀ ਹੈ।",

  "compare.lede.jobber": "Jobber ਆਪਣੀ marketing suite, ਆਪਣਾ AI ਰਿਸੈਪਸ਼ਨਿਸਟ ਅਤੇ ਆਪਣੀ ਸੇਲਜ਼ ਪਾਈਪਲਾਈਨ ਵੱਖਰੇ ਮਹੀਨਾਵਾਰ ਐਡ-ਆਨ ਵਜੋਂ ਵੇਚਦਾ ਹੈ — ਉਸ ਪਲਾਨ ਦੇ ਉੱਤੇ $177 ਮਹੀਨਾ, ਜਿਸ ਦੀ ਕੀਮਤ ਪਹਿਲਾਂ ਹੀ ਤੁਹਾਡੀ ਟੀਮ ਦੇ ਆਕਾਰ ਨਾਲ ਬਦਲਦੀ ਹੈ। FieldQuo ਇਹ ਤਿੰਨੇ ਹਰ ਪਲਾਨ ਵਿੱਚ, ਹਰ ਕੀਮਤ ਉੱਤੇ ਰੱਖਦਾ ਹੈ, ਅਤੇ ਵੈਨ ਵਿੱਚ ਬੈਠਾ ਹਰ ਬੰਦਾ ਮੁਫ਼ਤ ਹੈ।",
  "compare.concession.jobber": "ਪਹਿਲਾਂ ਉਸ ਗੱਲ ਤੋਂ ਸ਼ੁਰੂ ਕਰੀਏ ਜੋ ਸਾਡੇ ਕੋਲ ਨਹੀਂ ਹੈ। FieldQuo ਇੱਕ ਵੈੱਬ ਐਪਲੀਕੇਸ਼ਨ ਹੈ: ਐਪ ਸਟੋਰ ਤੋਂ ਇੰਸਟਾਲ ਕਰਨ ਲਈ ਕੁਝ ਨਹੀਂ, ਸਿਗਨਲ ਤੋਂ ਬਿਨਾਂ ਕੁਝ ਨਹੀਂ ਚੱਲਦਾ, ਅਤੇ ਤੁਹਾਨੂੰ ਸਮਝਾਉਣ ਲਈ ਕੋਈ ਸੇਲਜ਼ਮੈਨ ਨਹੀਂ ਹੈ।",
  "compare.lede.housecall_pro": "Housecall Pro ਹਰ ਵਾਧੂ ਯੂਜ਼ਰ ਦੇ ਪੈਸੇ ਲੈਂਦਾ ਹੈ, ਸੋ ਪਲਾਨ ਦੀ ਕੀਮਤ ਸਿਰਫ਼ ਉਹ ਥਾਂ ਹੈ ਜਿੱਥੋਂ ਤੁਹਾਡਾ ਬਿੱਲ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ। FieldQuo ਉਹਨਾਂ ਲੋਕਾਂ ਦਾ ਬਿੱਲ ਲਾਉਂਦਾ ਹੈ ਜੋ ਅਸਲ ਵਿੱਚ ਕੰਮ ਦੀ ਕੀਮਤ ਲਾਉਂਦੇ ਹਨ — ਕੋਟ, ਜੌਬਾਂ, ਇਨਵੌਇਸ — ਅਤੇ ਵੈਨ ਵਿੱਚ ਬੈਠਾ ਹਰ ਬੰਦਾ ਕਰੂ ਹੈ, ਬਿਨਾਂ ਕਿਸੇ ਖ਼ਰਚੇ ਦੇ। ਹਰ ਸਹੂਲਤ ਹਰ ਪਲਾਨ ਵਿੱਚ ਹੈ, $99 ਤੋਂ ਸ਼ੁਰੂ।",
  "compare.concession.housecall_pro": "ਪਹਿਲਾਂ ਇਮਾਨਦਾਰ ਗੱਲ। Housecall Pro ਦਾ ਪੰਨਾ ਫ਼ੋਨ ਐਪ, ਬਿਨਾਂ ਇੰਟਰਨੈੱਟ ਪਹੁੰਚ ਅਤੇ ਕਿਸੇ ਵੱਲੋਂ ਦਿਖਾਈ ਜਾਣ ਵਾਲੀ ਡੈਮੋ ਨੂੰ ਆਮ ਸਹੂਲਤਾਂ ਵਜੋਂ ਗਿਣਾਉਂਦਾ ਹੈ। FieldQuo ਕੋਲ ਇਹਨਾਂ ਤਿੰਨਾਂ ਵਿੱਚੋਂ ਕੋਈ ਨਹੀਂ, ਅਤੇ ਜੇ ਇਹਨਾਂ ਵਿੱਚੋਂ ਕੋਈ ਵੀ ਤੁਹਾਡਾ ਫ਼ੈਸਲਾ ਤੈਅ ਕਰਦਾ ਹੈ, ਤਾਂ ਉਹਨਾਂ ਦਾ ਸੌਦਾ ਹੀ ਵਧੀਆ ਹੈ।",
  "compare.lede.servicetitan": "ServiceTitan ਦੇ ਕੀਮਤਾਂ ਵਾਲੇ ਪੰਨੇ ਉੱਤੇ ਕਿਤੇ ਵੀ ਕੋਈ ਡਾਲਰ ਦੀ ਰਕਮ ਨਹੀਂ ਹੈ — ਤੁਸੀਂ ਡੈਮੋ ਬੁੱਕ ਕਰਦੇ ਹੋ ਅਤੇ ਨੰਬਰ ਤੁਹਾਡੀ ਆਮਦਨ ਅਤੇ ਤੁਹਾਡੇ ਬੰਦਿਆਂ ਦੀ ਗਿਣਤੀ ਦੇ ਹਿਸਾਬ ਨਾਲ ਗੱਲਬਾਤ ਵਿੱਚ ਤੈਅ ਹੁੰਦਾ ਹੈ। ਠੇਕੇਦਾਰ ਦੱਸਦੇ ਹਨ ਕਿ ਪੰਜ ਅੰਕਾਂ ਦੇ ਸ਼ੁਰੂਆਤੀ ਖ਼ਰਚੇ ਅਤੇ ਕਈ ਸਾਲਾਂ ਦੇ ਇਕਰਾਰਨਾਮੇ ਦੇ ਉੱਤੇ ਹਰ ਟੈਕਨੀਸ਼ੀਅਨ ਦੀ ਮਹੀਨਾਵਾਰ ਫ਼ੀਸ ਵੀ ਲੱਗਦੀ ਹੈ। FieldQuo ਦੀ ਹਰ ਕੀਮਤ ਇਸੇ ਪੰਨੇ ਉੱਤੇ ਹੈ, ਕੋਈ ਸੈੱਟਅੱਪ ਫ਼ੀਸ ਨਹੀਂ, ਅਤੇ ਤੁਸੀਂ ਕਿਸੇ ਨਾਲ ਗੱਲ ਕੀਤੇ ਬਿਨਾਂ ਅੱਜ ਰਾਤ ਹੀ ਸ਼ੁਰੂ ਕਰ ਸਕਦੇ ਹੋ।",
  "compare.concession.servicetitan": "ਜੋ ਅਸੀਂ ਨਹੀਂ ਦੇ ਸਕਦੇ, ਉਹ ਪਹਿਲਾਂ: ਕੋਈ ਫ਼ੋਨ ਐਪ ਨਹੀਂ, ਨੈੱਟਵਰਕ ਤੋਂ ਬਾਹਰ ਕੁਝ ਵੀ ਨਹੀਂ ਚੱਲਦਾ, ਅਤੇ ਫ਼ੈਸਲਾ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਤੁਹਾਨੂੰ ਘੁੰਮਾ ਕੇ ਦਿਖਾਉਣ ਵਾਲਾ ਕੋਈ ਨਹੀਂ।",
  "compare.lede.projul": "Projul ਪਹਿਲਾਂ ਹੀ ਪੂਰੇ ਸਾਲ ਦੀ ਇੱਕੋ ਜਿਹੀ ਵਚਨਬੱਧਤਾ ਮੰਗਦਾ ਹੈ। FieldQuo ਇੱਕ ਸੀਟ ਅਤੇ ਪੰਜ ਕਰੂ ਲਈ $99 ਮਹੀਨਾ ਹੈ, ਹਰ ਸਹੂਲਤ ਸ਼ਾਮਲ, ਅਤੇ ਤੁਸੀਂ ਕਿਸੇ ਵੀ ਮਹੀਨੇ ਦੇ ਅੰਤ 'ਤੇ ਛੱਡ ਸਕਦੇ ਹੋ — ਇਹ ਜਾਣਨ ਲਈ ਕਿ ਇਹ ਤੁਹਾਡੇ ਲਈ ਠੀਕ ਹੈ ਜਾਂ ਨਹੀਂ, ਤੁਹਾਨੂੰ ਪੂਰਾ ਸਾਲ ਖਰੀਦਣ ਦੀ ਲੋੜ ਨਹੀਂ।",
  "compare.concession.projul": "ਬਾਕੀ ਸਭ ਤੋਂ ਪਹਿਲਾਂ: FieldQuo ਕੋਲ ਕੋਈ ਫ਼ੋਨ ਐਪ ਨਹੀਂ, ਇਹ ਸਿਗਨਲ ਤੋਂ ਬਿਨਾਂ ਨਹੀਂ ਚੱਲਦਾ, ਅਤੇ ਤੁਹਾਨੂੰ ਇਹ ਕਰ ਕੇ ਦਿਖਾਉਣ ਵਾਲਾ ਕੋਈ ਨਹੀਂ। Projul ਤੁਹਾਡੇ ਲਈ ਡੈਮੋ ਬੁੱਕ ਕਰ ਦੇਵੇਗਾ।",
  "compare.lede.quoteiq": "QuoteIQ $29.99 ਤੋਂ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ, ਅਤੇ ਉਹ ਪਲਾਨ ਤੁਹਾਡੇ ਲਈ ਵੈੱਬਸਾਈਟ ਨਹੀਂ ਬਣਾ ਸਕਦਾ, ਬੁਕਿੰਗ ਨਹੀਂ ਲੈ ਸਕਦਾ, ਅਤੇ ਨਾ ਹੀ ਘਰ ਵਾਲੇ ਨੂੰ ਆਪਣੇ ਕੰਮ ਦੀ ਕੀਮਤ ਆਪ ਕੱਢਣ ਦਿੰਦਾ ਹੈ। QuoteIQ ਦਾ ਉਹ ਪਲਾਨ ਜਿਸ ਵਿੱਚ ਉਹ ਸਭ ਹੈ ਜੋ FieldQuo ਹਰ ਪਲਾਨ ਵਿੱਚ ਪਾਉਂਦਾ ਹੈ, ਉਹਨਾਂ ਦਾ Max ਪੱਧਰ ਹੈ, $699 ਮਹੀਨਾ। ਸਾਡਾ $99 ਹੈ — ਅਤੇ ਸਾਡੀ ਸੂਚੀ ਦੀਆਂ ਇਕਤਾਲੀ ਚੀਜ਼ਾਂ ਉਹਨਾਂ ਦੀ ਲਾਈਨ-ਅੱਪ ਵਿੱਚ ਕਿਸੇ ਵੀ ਕੀਮਤ ਉੱਤੇ ਨਹੀਂ ਹਨ।",
  "compare.concession.quoteiq": "ਪਹਿਲਾਂ ਕੀਮਤ, ਕਿਉਂਕਿ ਤੁਸੀਂ ਵੇਖਣ ਇਹੀ ਆਏ ਹੋ। QuoteIQ ਸਾਡੇ ਸਭ ਤੋਂ ਸਸਤੇ ਪਲਾਨ ਤੋਂ ਵੀ ਹੇਠਾਂ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ, ਉਹ ਫ਼ੋਨ ਐਪ ਦਿੰਦਾ ਹੈ ਜੋ ਸਾਡੇ ਕੋਲ ਨਹੀਂ, ਅਤੇ ਤੁਹਾਡੇ ਲਈ ਦਿਖਾਵੇ ਦੀ ਮੁਲਾਕਾਤ ਬੁੱਕ ਕਰ ਦੇਵੇਗਾ। FieldQuo ਇੱਕ ਵੈੱਬ ਐਪਲੀਕੇਸ਼ਨ ਹੈ, ਨਾਲ ਕੋਈ ਸੇਲਜ਼ਮੈਨ ਨਹੀਂ ਲੱਗਾ ਹੋਇਆ।",

  "compare.counterpoint.projul.monthly_billing": "ਉਹਨਾਂ ਦਾ ਪੰਨਾ ਸਾਲਾਨਾ ਪਲਾਨ ਦੇ ਹੱਕ ਵਿੱਚ ਦਲੀਲ ਦਿੰਦਾ ਹੈ, ਅਤੇ ਦਲੀਲ ਵਾਜਬ ਹੈ: Projul ਕਹਿੰਦਾ ਹੈ ਕਿ ਉਸ ਦੀ ਕੀਮਤ ਵਿੱਚ ਹਰ ਯੂਜ਼ਰ ਦੀ ਕੋਈ ਵੱਖਰੀ ਫ਼ੀਸ ਨਹੀਂ ਅਤੇ ਪ੍ਰੋਜੈਕਟਾਂ ਦੀ ਗਿਣਤੀ ਉੱਤੇ ਕੋਈ ਹੱਦ ਨਹੀਂ। ਜਿਹੜੀ ਦੁਕਾਨ ਅਕਸਰ ਬੰਦੇ ਜੋੜਦੀ ਰਹਿੰਦੀ ਹੈ, ਉਸ ਲਈ ਉੱਥੇ ਬਿਹਤਰ ਹੋ ਸਕਦਾ ਹੈ।",

  "compare.capability.mobile_app": "ਨੇਟਿਵ ਮੋਬਾਈਲ ਐਪ (iOS / Android)",
  "compare.capability.offline_use": "ਬਿਨਾਂ ਇੰਟਰਨੈੱਟ ਚੱਲਦਾ ਹੈ",
  "compare.capability.self_serve_demo": "ਸੇਲਜ਼ਮੈਨ ਨਾਲ ਦਿਖਾਈ ਜਾਣ ਵਾਲੀ ਡੈਮੋ ਬੁੱਕ ਕਰੋ",
  "compare.capability.accounting_sync": "QuickBooks ਜਾਂ Xero ਨਾਲ ਦੋ-ਪਾਸੀ ਸਿੰਕ",
  "compare.capability.gantt_charts": "ਗੈਂਟ ਚਾਰਟ ਅਤੇ ਆਪਸ ਵਿੱਚ ਜੁੜੀਆਂ ਪ੍ਰੋਜੈਕਟ ਸਮਾਂ-ਸੂਚੀਆਂ",
  "compare.capability.purchase_orders": "ਸਪਲਾਇਰਾਂ ਨੂੰ ਖਰੀਦ ਆਰਡਰ",
  "compare.capability.daily_logs": "ਰੋਜ਼ਾਨਾ ਸਾਈਟ ਲੌਗ",
  "compare.capability.geofencing": "ਟਿਕਾਣੇ ਦੀ ਪਛਾਣ ਅਤੇ ਜੀਓਫ਼ੈਂਸ ਵਾਲੀ ਹਾਜ਼ਰੀ",
  "compare.capability.field_worker_quotes": "ਫ਼ੀਲਡ ਕਰੂ ਵੈਨ ਵਿੱਚੋਂ ਹੀ ਕੋਟ ਦੀ ਕੀਮਤ ਲਾ ਕੇ ਭੇਜ ਸਕਦਾ ਹੈ",
  "compare.capability.entry_price_below_our_floor": "FieldQuo ਦੇ ਸਭ ਤੋਂ ਸਸਤੇ ਪੜਾਅ ਤੋਂ ਹੇਠਾਂ ਕੋਈ ਪੈਸੇ ਵਾਲਾ ਪਲਾਨ",
  "compare.capability.ai_receptionist_no_monthly_floor": "ਹਰ ਪਲਾਨ ਵਿੱਚ AI ਫ਼ੋਨ ਰਿਸੈਪਸ਼ਨਿਸਟ, ਕੋਈ ਮਹੀਨਾਵਾਰ ਘੱਟੋ-ਘੱਟ ਨਹੀਂ",
  "compare.capability.self_serve_signup": "ਕਿਸੇ ਨਾਲ ਗੱਲ ਕੀਤੇ ਬਿਨਾਂ ਸਾਈਨ ਅੱਪ ਕਰੋ ਅਤੇ ਸ਼ੁਰੂ ਕਰੋ",
  "compare.capability.published_price": "ਕੀਮਤ ਖੁੱਲ੍ਹੇਆਮ ਛਪੀ ਹੋਈ, ਕੋਈ ਸੇਲਜ਼ ਕਾਲ ਨਹੀਂ",
  "compare.capability.monthly_billing": "ਮਹੀਨਾਵਾਰ ਭਰੋ, ਸਾਲਾਨਾ ਵਚਨਬੱਧਤਾ ਦੀ ਲੋੜ ਨਹੀਂ",
  "compare.capability.free_crew_seats": "ਫ਼ੀਲਡ ਕਰੂ ਮੁਫ਼ਤ ਸ਼ਾਮਲ — ਬਿੱਲ ਸਿਰਫ਼ ਉਹਨਾਂ ਦਾ ਲੱਗਦਾ ਹੈ ਜੋ ਪੈਸਾ ਪੈਦਾ ਕਰਦੇ ਹਨ",

  "compare.teamSize.solo": "ਸਿਰਫ਼ ਮੈਂ",
  "compare.teamSize.2-5": "2-5 ਬੰਦੇ",
  "compare.teamSize.6-10": "6-10 ਬੰਦੇ",
  "compare.teamSize.11-15": "11-15 ਬੰਦੇ",
  "compare.teamSize.16-plus": "16 ਜਾਂ ਵੱਧ",
  "compare.billing.annual_prepaid": "ਸਾਲਾਨਾ, ਪਹਿਲਾਂ ਭੁਗਤਾਨ",
  "compare.billing.monthly_1yr": "ਮਹੀਨਾਵਾਰ, 1 ਸਾਲ ਦੀ ਵਚਨਬੱਧਤਾ",
  "compare.billing.monthly_none": "ਮਹੀਨਾਵਾਰ, ਕੋਈ ਵਚਨਬੱਧਤਾ ਨਹੀਂ",

  "compare.comparableFeature.ai_receptionist": "AI ਫ਼ੋਨ ਰਿਸੈਪਸ਼ਨਿਸਟ",

  // ── The index page ──────────────────────────────────────────────────────
  "compare.vs": "FieldQuo ਬਨਾਮ {competitor}",
  "compare.preparedAsOf": "{date} ਤੱਕ ਤਿਆਰ ਕੀਤਾ ਗਿਆ।",
  "compare.preparedAsOfLong": "{date} ਤੱਕ ਤਿਆਰ ਕੀਤਾ ਗਿਆ। ਹੇਠਲੇ ਹਰ ਅੰਕੜੇ ਨਾਲ ਉਹ ਦਿਨ ਅਤੇ ਉਹ ਦੇਸ਼ ਵੀ ਲੱਗਾ ਹੋਇਆ ਹੈ ਜਿਸ ਦਿਨ ਅਤੇ ਜਿੱਥੋਂ ਇਹ ਪੜ੍ਹਿਆ ਗਿਆ ਸੀ।",
  "compare.readComparison": "ਤੁਲਨਾ ਪੜ੍ਹੋ",

  // What one card may claim, assembled in ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "ਉਹਨਾਂ ਦੀਆਂ ਛਪੀਆਂ ਕੀਮਤਾਂ ਵਿੱਚੋਂ {count} ਸਾਡੀਆਂ ਦੇ ਨਾਲ ਰੱਖੀਆਂ ਜਾ ਸਕਦੀਆਂ ਹਨ, ਉਸੇ ਮੁਦਰਾ ਵਿੱਚ ਜਿਸ ਵਿੱਚ ਉਹ ਛਾਪਦੇ ਹਨ।",
  "compare.summary.amounts": "ਉਹਨਾਂ ਦੀਆਂ ਛਪੀਆਂ ਕੀਮਤਾਂ ਵਿੱਚੋਂ {count} ਸਾਡੀਆਂ ਦੇ ਨਾਲ ਰੱਖੀਆਂ ਜਾ ਸਕਦੀਆਂ ਹਨ।",
  "compare.summary.asserted": "ਇਹਨਾਂ ਵਿੱਚੋਂ {count} ਉੱਤੇ ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਪੰਨੇ ਉੱਤੇ ਕੋਈ ਮੁਦਰਾ ਨਹੀਂ ਲਿਖੀ, ਇਸ ਲਈ ਤੁਲਨਾ ਮੁਦਰਾ ਨੂੰ ਉਹਨਾਂ ਦੀ ਦੱਸ ਕੇ ਛਾਪਣ ਦੀ ਥਾਂ ਇਹ ਦੱਸਦੀ ਹੈ ਕਿ ਇਹ ਕਿਸ ਦਾ ਅੰਦਾਜ਼ਾ ਹੈ।",
  "compare.summary.onRequest": "ਉਹਨਾਂ ਦੇ {count} ਪੱਧਰ ਕੋਈ ਰਕਮ ਬਿਲਕੁਲ ਨਹੀਂ ਛਾਪਦੇ ਅਤੇ ਤੁਹਾਨੂੰ ਮੰਗਣ ਲਈ ਕਹਿੰਦੇ ਹਨ।",
  "compare.summary.none": "ਉਹ ਜੋ ਕੁਝ ਛਾਪਦੇ ਹਨ, ਉਸ ਵਿੱਚੋਂ ਕਿਸੇ ਦੀ ਵੀ FieldQuo ਦੀ ਕੀਮਤ ਨਾਲ ਤੁਲਨਾ ਨਹੀਂ ਕੀਤੀ ਜਾ ਸਕਦੀ।",
  "compare.summary.withheldOne": "{count} ਹੋਰ ਅੰਕੜਾ ਰੋਕ ਕੇ ਰੱਖਿਆ ਗਿਆ ਹੈ, ਕਾਰਨ ਸਮੇਤ ਦਿਖਾਇਆ ਗਿਆ।",
  "compare.summary.withheld": "{count} ਹੋਰ ਅੰਕੜੇ ਰੋਕ ਕੇ ਰੱਖੇ ਗਏ ਹਨ, ਹਰ ਇੱਕ ਆਪਣੇ ਕਾਰਨ ਸਮੇਤ ਦਿਖਾਇਆ ਗਿਆ।",

  // ── How a price reads ───────────────────────────────────────────────────
  //
  // {currency} is a code and {ask} is their button's own words: both arrive
  // already decided and neither is translated. {per} is resolved through
  // compare.per.* below.
  "compare.price.amount": "${amount} {currency} ਪ੍ਰਤੀ {per}",
  "compare.price.free": "ਮੁਫ਼ਤ ({currency})",
  "compare.price.onRequest": "ਕੋਈ ਕੀਮਤ ਨਹੀਂ ਛਾਪੀ — ਉਹਨਾਂ ਦਾ ਪੰਨਾ ਕਹਿੰਦਾ ਹੈ “{ask}”",
  "compare.price.notOffered": "ਇਸ ਆਕਾਰ ਲਈ ਨਹੀਂ ਵਿਕਦਾ",
  "compare.per.month": "ਮਹੀਨਾ",
  "compare.per.year": "ਸਾਲ",
  "compare.pricePerMonth": "${amount} ਪ੍ਰਤੀ ਮਹੀਨਾ",
  "compare.and": " ਅਤੇ ",

  // ── How a feature's availability reads ──────────────────────────────────
  //
  // included and includedUsageExtra must NEVER collapse into one sentence.
  // Ours is the second: saying only "ਪਲਾਨ ਦੀ ਕੀਮਤ ਵਿੱਚ" beside our price would
  // be a false claim to somebody who meets a top-up on their first call.
  "compare.availability.included": "ਪਲਾਨ ਦੀ ਕੀਮਤ ਵਿੱਚ",
  "compare.availability.includedUsageExtra": "ਹਰ ਪਲਾਨ ਵਿੱਚ, ਗੱਲ ਕਰਨ ਦਾ ਸਮਾਂ ਵੱਖਰੇ ਤੌਰ 'ਤੇ ਪਹਿਲਾਂ ਭਰੇ ਕ੍ਰੈਡਿਟ ਵਜੋਂ ਖਰੀਦਿਆ ਜਾਂਦਾ ਹੈ",
  "compare.availability.addOn": "ਪਲਾਨ ਦੇ ਉੱਤੇ ਪੈਸੇ ਵਾਲਾ ਐਡ-ਆਨ",
  "compare.availability.absent": "ਉਸ ਪੱਧਰ ਉੱਤੇ ਨਹੀਂ",
  "compare.availability.unknown": "ਤੈਅ ਨਹੀਂ ਹੋਇਆ",

  // ── The price section ───────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} ਸੀਟ, ਨਾਲ {crew} ਕਰੂ ਬਿਨਾਂ ਕਿਸੇ ਖ਼ਰਚੇ ਦੇ",
  "compare.tierSeats": "{seats} ਸੀਟਾਂ, ਨਾਲ {crew} ਕਰੂ ਬਿਨਾਂ ਕਿਸੇ ਖ਼ਰਚੇ ਦੇ",
  "compare.sameNumberBothCurrencies": "ਜਿਨ੍ਹਾਂ ਮੁਦਰਾਵਾਂ ਵਿੱਚ ਅਸੀਂ ਵੇਚਦੇ ਹਾਂ ({currencies}), ਉਹਨਾਂ ਹਰ ਇੱਕ ਵਿੱਚ ਓਹੀ ਅੰਕੜਾ — ਹਰ ਇੱਕ ਵਿੱਚ ${price} ਇੱਕ ਅਸਲੀ FieldQuo ਕੀਮਤ ਹੈ, ਸੋ ਇਹਨਾਂ ਨੂੰ ਬਰਾਬਰ ਕਰਨ ਲਈ ਇਸ ਪੰਨੇ ਉੱਤੇ ਕੁਝ ਵੀ ਬਦਲਣਾ ਨਹੀਂ ਪੈਂਦਾ। ਤੁਹਾਨੂੰ ਕਿਸ ਮੁਦਰਾ ਵਿੱਚ ਬਿੱਲ ਆਵੇਗਾ, ਇਹ ਸਾਈਨ ਅੱਪ ਵੇਲੇ ਦਿੱਤੇ ਕਾਰੋਬਾਰੀ ਪਤੇ ਤੋਂ ਤੈਅ ਹੁੰਦਾ ਹੈ।",
  "compare.soldIn": "{currencies} ਵਿੱਚ ਵਿਕਦਾ ਹੈ।",
  "compare.nothingPublishable": "{competitor} ਦੇ ਕੀਮਤਾਂ ਵਾਲੇ ਪੰਨੇ ਉੱਤੇ ਅਜਿਹਾ ਕੁਝ ਨਹੀਂ ਜਿਸ ਨੂੰ ਅਸੀਂ ਕੀਮਤ ਵਜੋਂ ਛਾਪ ਸਕੀਏ। ਸਾਡੇ ਕੋਲ ਪਏ ਹਰ ਅੰਕੜੇ ਨੂੰ ਹੇਠਾਂ ਉਸ ਕਾਰਨ ਸਮੇਤ ਗਿਣਾਇਆ ਗਿਆ ਹੈ ਕਿ ਉਹ ਕਿਉਂ ਰੋਕਿਆ ਜਾ ਰਿਹਾ ਹੈ।",
  "compare.usersIncludedOne": "{count} ਯੂਜ਼ਰ ਸ਼ਾਮਲ",
  "compare.usersIncluded": "{count} ਯੂਜ਼ਰ ਸ਼ਾਮਲ",
  "compare.unlimitedUsers": "ਅਸੀਮਤ ਯੂਜ਼ਰ, ਸੋ ਤੁਲਨਾ ਕਰਨ ਲਈ ਕੋਈ ਸੀਟਾਂ ਦੀ ਗਿਣਤੀ ਹੀ ਨਹੀਂ",
  "compare.currencyNotTheirs": "ਰਕਮ ਉਹਨਾਂ ਦੀ ਹੈ, ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਪੰਨੇ ਤੋਂ। ਮੁਦਰਾ ਉਹਨਾਂ ਦੀ ਨਹੀਂ: {provenance}",
  "compare.withheldCountOne": "{competitor} ਦੀ {count} ਹੋਰ ਕੀਮਤ ਇੱਥੇ ਨਹੀਂ ਦਿਖਾਈ ਗਈ — ਜਾਂ ਤਾਂ ਉਹ ਰੀਡਿੰਗ ਪੁਰਾਣੀ ਪੈ ਚੁੱਕੀ ਹੈ, ਜਾਂ ਅਸੀਂ ਪੱਕਾ ਨਾ ਕਰ ਸਕੇ ਕਿ ਛਪੇ ਅੰਕੜੇ ਦਾ ਕੀ ਮਤਲਬ ਸੀ। ਜਿਸ ਨੰਬਰ ਉੱਤੇ ਅਸੀਂ ਖੜ੍ਹ ਨਹੀਂ ਸਕਦੇ, ਉਸ ਨੂੰ ਛਾਪਣ ਨਾਲੋਂ ਅਸੀਂ ਸਤਰ ਛੱਡ ਦੇਣੀ ਬਿਹਤਰ ਸਮਝਦੇ ਹਾਂ।",
  "compare.withheldCount": "{competitor} ਦੀਆਂ {count} ਹੋਰ ਕੀਮਤਾਂ ਇੱਥੇ ਨਹੀਂ ਦਿਖਾਈਆਂ ਗਈਆਂ — ਜਾਂ ਤਾਂ ਉਹ ਰੀਡਿੰਗ ਪੁਰਾਣੀ ਪੈ ਚੁੱਕੀ ਹੈ, ਜਾਂ ਅਸੀਂ ਪੱਕਾ ਨਾ ਕਰ ਸਕੇ ਕਿ ਛਪੇ ਅੰਕੜੇ ਦਾ ਕੀ ਮਤਲਬ ਸੀ। ਜਿਸ ਨੰਬਰ ਉੱਤੇ ਅਸੀਂ ਖੜ੍ਹ ਨਹੀਂ ਸਕਦੇ, ਉਸ ਨੂੰ ਛਾਪਣ ਨਾਲੋਂ ਅਸੀਂ ਸਤਰ ਛੱਡ ਦੇਣੀ ਬਿਹਤਰ ਸਮਝਦੇ ਹਾਂ।",

  // ── Their ladder, in their own words ────────────────────────────────────
  "compare.addsOverTier": "ਇਸ ਤੋਂ ਹੇਠਲੇ ਪੱਧਰ ਦੇ ਮੁਕਾਬਲੇ ਇਹ ਵਾਧਾ ਕਰਦਾ ਹੈ:",
  "compare.onThisTier": "ਇਸ ਪੱਧਰ ਉੱਤੇ:",
  "compare.aiCreditsTier": "ਉਹਨਾਂ ਦਾ ਪੰਨਾ ਦੱਸਦਾ ਹੈ ਕਿ ਇਸ ਪੱਧਰ ਉੱਤੇ ਮਹੀਨੇ ਦੇ {count} AI ਕ੍ਰੈਡਿਟ ਹਨ।",
  "compare.thisListFrom": "ਇਹ ਸੂਚੀ {provenance}",
  "compare.creditsAMonth": "ਮਹੀਨੇ ਦੇ {count} ਕ੍ਰੈਡਿਟ",

  // ── The receptionist panel ──────────────────────────────────────────────
  "compare.receptionistTitle": "{feature}: ਹਰ ਪਾਸੇ ਇਸ ਦਾ ਕੀ ਖ਼ਰਚਾ ਹੈ",
  "compare.receptionistIntro": "ਪੱਧਰ ਇਸ ਹਿਸਾਬ ਨਾਲ ਮਿਲਾਏ ਗਏ ਹਨ ਕਿ ਉਹਨਾਂ ਵਿੱਚ ਕੀ ਹੈ, ਨਾ ਕਿ ਉਹ ਸਾਰਣੀ ਵਿੱਚ ਕਿੱਥੇ ਬੈਠੇ ਹਨ। ਇਹ {competitor} ਦਾ ਸਭ ਤੋਂ ਸਸਤਾ ਪੱਧਰ ਹੈ ਜਿਸ ਬਾਰੇ ਅਸੀਂ ਤਸਦੀਕ ਕੀਤਾ ਕਿ ਇਹ ਸੱਚਮੁੱਚ ਇਹ ਸਹੂਲਤ ਚੁੱਕਦਾ ਹੈ।",
  "compare.receptionistUnknownIntro": "{competitor} ਬਾਰੇ ਅਸੀਂ ਇਸ ਦਾ ਜਵਾਬ ਨਹੀਂ ਦੇ ਸਕਦੇ।",
  "compare.featureOnThisTier": "ਇਸ ਪੱਧਰ ਉੱਤੇ ਇਹ ਸਹੂਲਤ {availability} ਹੈ।",
  "compare.receptionistLowerDown": "ਉਹਨਾਂ ਦੀ ਸੂਚੀ ਵਿੱਚ ਹੇਠਾਂ ਇਹ {availability} ਹੈ: {price}{at}। ਇਹ ਉਹ ਘੱਟੋ-ਘੱਟ ਰਕਮ ਹੈ ਜੋ ਤੁਸੀਂ ਉਸ ਮਹੀਨੇ ਵੀ ਭਰਦੇ ਹੋ ਜਿਸ ਵਿੱਚ ਫ਼ੋਨ ਇੱਕ ਵਾਰ ਵੀ ਨਹੀਂ ਵੱਜਦਾ।",
  "compare.atCoordinates": " {coordinates} ਉੱਤੇ",
  "compare.ourAvailability": "ਇਹ {availability} ਹੈ। ਜਿਸ ਮਹੀਨੇ ਕੋਈ ਕਾਲ ਨਾ ਆਵੇ, ਉਸ ਦਾ ਇਸ ਲਈ ਕੁਝ ਨਹੀਂ ਲੱਗਦਾ।",
  "compare.theirWordsNotOurs": "ਉਹਨਾਂ ਦੇ ਪਲਾਨ ਉਹਨਾਂ ਦੇ ਪੰਨੇ ਉੱਤੇ ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਦੱਸੇ ਗਏ ਹਨ, ਅਤੇ ਇਹ ਤੁਲਨਾ ਉਹਨਾਂ ਸ਼ਬਦਾਂ ਨੂੰ ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਾਂਗ ਨਹੀਂ ਪੜ੍ਹੇਗੀ। ਉਹਨਾਂ ਦੀ ਸੂਚੀ ਉੱਪਰ ਹੈ, ਬਿਨਾਂ ਕਿਸੇ ਸੋਧ ਦੇ, ਅਤੇ ਉਹਨਾਂ ਦੀ ਆਪਣੀ ਸਾਈਟ ਉੱਤੇ ਜਾਂਚਣ ਵਾਲੀ ਚੀਜ਼ ਇਹੀ ਹੈ।",

  // ── Where we are ahead, and where we are not ────────────────────────────
  "compare.readOnTheirSite": "ਉਹਨਾਂ ਦੀ ਸਾਈਟ ਉੱਤੇ {checked} ਨੂੰ ਪੜ੍ਹਿਆ ਗਿਆ",
  "compare.theySay": "{competitor} ਕਹਿੰਦਾ ਹੈ: “{claim}”।",
  "compare.entryOursNothingBelowOne": "{seats} ਸੀਟ, ਨਾਲ {crew} ਕਰੂ ਬਿਨਾਂ ਕਿਸੇ ਖ਼ਰਚੇ ਦੇ। ਇਸ ਤੋਂ ਹੇਠਾਂ ਕੁਝ ਨਹੀਂ ਹੈ।",
  "compare.entryOursNothingBelow": "{seats} ਸੀਟਾਂ, ਨਾਲ {crew} ਕਰੂ ਬਿਨਾਂ ਕਿਸੇ ਖ਼ਰਚੇ ਦੇ। ਇਸ ਤੋਂ ਹੇਠਾਂ ਕੁਝ ਨਹੀਂ ਹੈ।",

  // ── The head-to-head ────────────────────────────────────────────────────
  "compare.case.eyebrow": "ਨਾਲੋ-ਨਾਲ",
  "compare.case.headlineOurs": "FieldQuo ਜੋ ਕੁਝ ਕਰਦਾ ਹੈ, ਉਹ ਸਭ {price} ਵਿੱਚ ਹੈ।",
  "compare.case.headlineTheirs": "{competitor} ਕੋਲ ਓਹੀ ਸੂਚੀ {price} ਦੀ ਹੈ।",
  "compare.case.headlineNoPricesOurs": "FieldQuo ਹਰ ਕੀਮਤ ਛਾਪਦਾ ਹੈ।",
  "compare.case.headlineNoPricesTheirs": "{competitor} ਇੱਕ ਵੀ ਨਹੀਂ ਛਾਪਦਾ।",
  "compare.case.sub": "ਅਸੀਂ ਸਹੂਲਤਾਂ ਪੱਧਰਾਂ ਦੇ ਹਿਸਾਬ ਨਾਲ ਨਹੀਂ ਵੇਚਦੇ। ਹਰ ਪਲਾਨ ਵਿੱਚ ਹਰ ਸਹੂਲਤ ਹੈ — ਪਲਾਨ ਸਿਰਫ਼ ਇਸ ਗੱਲ ਵਿੱਚ ਵੱਖਰੇ ਹਨ ਕਿ ਉਹਨਾਂ ਉੱਤੇ ਕਿੰਨੇ ਬੰਦੇ ਹਨ।",
  "compare.case.missingOne": "{count} ਹੋਰ ਚੀਜ਼ ਜੋ {competitor} ਕਿਸੇ ਵੀ ਕੀਮਤ ਉੱਤੇ ਨਹੀਂ ਦਿੰਦਾ।",
  "compare.case.missing": "{count} ਹੋਰ ਚੀਜ਼ਾਂ ਜੋ {competitor} ਕਿਸੇ ਵੀ ਕੀਮਤ ਉੱਤੇ ਨਹੀਂ ਦਿੰਦਾ।",
  "compare.case.missingBody": "ਇਹ ਸਾਰੀਆਂ {price} ਵਾਲੇ {plan} ਪਲਾਨ ਵਿੱਚ ਹਨ।",
  "compare.case.shopTitle": "ਤੁਹਾਡੇ ਵਰਗੀ ਦੁਕਾਨ ਲਈ ਕੀ ਖ਼ਰਚਾ ਪੈਂਦਾ ਹੈ",
  "compare.case.shopIntro": "{competitor} ਹਰ ਲੌਗਇਨ ਦਾ ਬਿੱਲ ਲਾਉਂਦਾ ਹੈ। ਅਸੀਂ ਉਹਨਾਂ ਦਾ ਬਿੱਲ ਲਾਉਂਦੇ ਹਾਂ ਜੋ ਕੰਮ ਦੀ ਕੀਮਤ ਲਾਉਂਦੇ ਹਨ; ਵੈਨ ਵਿੱਚ ਬੈਠਾ ਹਰ ਬੰਦਾ ਕਰੂ ਹੈ, ਬਿਨਾਂ ਕਿਸੇ ਖ਼ਰਚੇ ਦੇ। ਹਰ ਨਵੇਂ ਰੱਖੇ ਬੰਦੇ ਨਾਲ ਇਹ ਫ਼ਰਕ ਵਧਦਾ ਜਾਂਦਾ ਹੈ।",
  "compare.case.shop1": "ਤੁਸੀਂ ਅਤੇ ਵੈਨ ਵਿੱਚ ਦੋ ਹੋਰ",
  "compare.case.shop2": "ਦੋ ਅੰਦਾਜ਼ਾ ਲਾਉਣ ਵਾਲੇ, ਚਾਰ ਫ਼ੀਲਡ ਵਿੱਚ",
  "compare.case.shop3": "ਗਿਆਰਾਂ ਬੰਦਿਆਂ ਦੀ ਦੁਕਾਨ",
  "compare.case.shopSplit": "{estimators} ਕੀਮਤ ਲਾਉਂਦੇ ਹਨ · {crew} ਫ਼ੀਲਡ ਵਿੱਚ",
  "compare.case.youKeep": "ਤੁਹਾਡੇ ਕੋਲ ਬਚਦੇ ਹਨ",
  "compare.case.cheaperThere": "ਇਕੱਲੇ ਬੰਦੇ ਲਈ ਉੱਥੇ ਸਸਤਾ ਹੈ।",
  "compare.case.calcBefore": "ਆਪਣੇ ਅੰਕੜੇ ਇਸ",
  "compare.case.calcLink": "ਲਾਗਤ ਕੈਲਕੁਲੇਟਰ",
  "compare.case.calcAfter": "ਵਿੱਚ ਭਰੋ ਅਤੇ ਪੰਜੇ ਨਾਲੋ-ਨਾਲ ਵੇਖੋ।",
  "compare.case.wholeTitle": "ਜੋ ਕੁਝ ਮਿਲਦਾ ਹੈ, ਹਰ ਪਲਾਨ ਵਿੱਚ",
  "compare.case.wholeIntro": "ਚੋਣਵੀਆਂ ਗੱਲਾਂ ਨਹੀਂ — ਪੂਰਾ ਉਤਪਾਦ, ਅਤੇ ਇਹ ਵੀ ਕਿ ਉਹ {competitor} ਦੇ ਪਲਾਨਾਂ ਵਿੱਚ ਕਿਤੇ ਆਉਂਦਾ ਹੈ ਜਾਂ ਨਹੀਂ।",
  "compare.case.both": "ਦੋਵੇਂ",
  "compare.case.only": "ਸਿਰਫ਼ FieldQuo",

  // ── The head-to-head rows ───────────────────────────────────────────────
  "compare.rows.perMo": "{amount}/ਮਹੀਨਾ",
  "compare.rows.perYr": "{amount}/ਸਾਲ",
  "compare.rows.usersOne": "{count} ਯੂਜ਼ਰ",
  "compare.rows.users": "{count} ਯੂਜ਼ਰ",
  "compare.rows.unlimitedUsers": "ਅਸੀਮਤ ਯੂਜ਼ਰ",
  "compare.rows.cheapestPlan": "ਸਭ ਤੋਂ ਸਸਤਾ ਪਲਾਨ",
  "compare.rows.soloSub": "{plan} — 1 ਸੀਟ, {crew} ਕਰੂ ਮੁਫ਼ਤ",
  "compare.rows.annualEquivalent": "{plan} — ਬਰਾਬਰ {amount} ਮਹੀਨਾ, ਬਿੱਲ ਸਾਲ ਦਾ",
  "compare.rows.tierUsers": "{plan} — {users}",
  "compare.rows.parityLabel": "ਸਭ ਤੋਂ ਸਸਤਾ ਪਲਾਨ ਜਿਸ ਵਿੱਚ ਉਹ ਸਭ ਹੈ ਜੋ FieldQuo ਹਰ ਪਲਾਨ ਵਿੱਚ ਪਾਉਂਦਾ ਹੈ",
  "compare.rows.paritySub": "ਓਹੀ ਪਲਾਨ। ਅਸੀਂ ਸਹੂਲਤਾਂ ਨੂੰ ਪੱਧਰਾਂ ਪਿੱਛੇ ਬੰਦ ਨਹੀਂ ਕਰਦੇ।",
  "compare.rows.parityAnnual": "{plan} — ਬਰਾਬਰ {amount} ਮਹੀਨਾ",
  "compare.rows.parityTheirs": "{plan} — ਉਹਨਾਂ ਦੇ ਸਸਤੇ ਪਲਾਨਾਂ ਵਿੱਚ ਇਹ ਨਹੀਂ ਹੈ",
  "compare.rows.publishedPrice": "ਛਾਪੀ ਹੋਈ ਕੀਮਤ",
  "compare.rows.everyPlanOnThisPage": "ਹਰ ਪਲਾਨ, ਇਸੇ ਪੰਨੇ ਉੱਤੇ",
  "compare.rows.nonePublished": "ਕੋਈ ਨਹੀਂ ਛਾਪੀ",
  "compare.rows.bookDemo": "ਡੈਮੋ ਬੁੱਕ ਕਰੋ; ਨੰਬਰ ਕਾਲ ਉੱਤੇ ਹੀ ਤੈਅ ਹੁੰਦਾ ਹੈ",
  "compare.rows.whatItCosts": "ਕੀ ਖ਼ਰਚਾ ਪੈਂਦਾ ਹੈ",
  "compare.rows.oneToTwentyFive": "1 ਤੋਂ 25 ਬੰਦੇ",
  "compare.rows.reportedNotPublished": "ਠੇਕੇਦਾਰਾਂ ਵੱਲੋਂ ਦੱਸਿਆ ਗਿਆ, ਛਾਪਿਆ ਹੋਇਆ ਨਹੀਂ",
  "compare.rows.setupFee": "ਸੈੱਟਅੱਪ ਫ਼ੀਸ",
  "compare.rows.none": "ਕੋਈ ਨਹੀਂ",
  "compare.rows.reported": "ਦੱਸਿਆ ਗਿਆ",
  "compare.rows.howYouPay": "ਭੁਗਤਾਨ ਕਿਵੇਂ ਹੁੰਦਾ ਹੈ",
  "compare.rows.monthly": "ਮਹੀਨਾਵਾਰ",
  "compare.rows.leaveAnyMonth": "ਕਿਸੇ ਵੀ ਮਹੀਨੇ ਦੇ ਅੰਤ 'ਤੇ ਛੱਡੋ",
  "compare.rows.aYearUpFront": "{amount} ਸਾਲ ਦਾ, ਪਹਿਲਾਂ ਹੀ",
  "compare.rows.noMonthlyOption": "ਕੋਈ ਮਹੀਨਾਵਾਰ ਵਿਕਲਪ ਨਹੀਂ ਦਿੱਤਾ ਜਾਂਦਾ — ਉਹਨਾਂ ਦਾ FAQ ਇਹੀ ਕਹਿੰਦਾ ਹੈ",
  "compare.rows.paidAddOns": "ਪੈਸੇ ਵਾਲੇ ਐਡ-ਆਨ ਵਜੋਂ ਵਿਕਦੇ ਹਨ",
  "compare.rows.everyFeature": "ਹਰ ਸਹੂਲਤ ਹਰ ਪਲਾਨ ਵਿੱਚ ਹੈ, ਪਲਾਨ ਦੀ ਕੀਮਤ ਵਿੱਚ ਹੀ",
  "compare.rows.plusPerMo": "+{amount}/ਮਹੀਨਾ",
  "compare.rows.peopleInField": "ਫ਼ੀਲਡ ਵਿੱਚ ਕੰਮ ਕਰਦੇ ਬੰਦੇ",
  "compare.rows.free": "ਮੁਫ਼ਤ",
  "compare.rows.crewFreeSub": "ਕਰੂ ਸ਼ਡਿਊਲ ਅਤੇ ਜੌਬ ਬਿਨਾਂ ਕਿਸੇ ਖ਼ਰਚੇ ਦੇ ਵੇਖਦਾ ਹੈ",
  "compare.rows.billed": "ਬਿੱਲ ਲੱਗਦਾ ਹੈ",
  "compare.rows.everyLoginPaid": "{competitor} ਕੋਲ ਹਰ ਲੌਗਇਨ ਪੈਸੇ ਵਾਲਾ ਯੂਜ਼ਰ ਹੈ",
  "compare.rows.biggestPlan": "ਸਭ ਤੋਂ ਵੱਡਾ ਪਲਾਨ",
  "compare.rows.biggestSub": "{seats} ਸੀਟਾਂ ਨਾਲ {crew} ਕਰੂ — 25 ਬੰਦੇ",
  "compare.rows.onRequest": "ਮੰਗਣ ਉੱਤੇ",
  "compare.rows.everyPlan": "ਹਰ ਪਲਾਨ",
  "compare.rows.tierAtPrice": "{plan} — {amount}/ਮਹੀਨਾ",
  "compare.rows.theirCheapestWithIt": "ਉਹਨਾਂ ਦਾ ਸਭ ਤੋਂ ਸਸਤਾ ਪਲਾਨ ਜਿਸ ਵਿੱਚ ਇਹ ਸ਼ਾਮਲ ਹੈ",
  "compare.rows.notInTheirPlans": "ਉਹਨਾਂ ਦੇ ਪਲਾਨਾਂ ਵਿੱਚ ਨਹੀਂ",
  "compare.rows.freeTrial": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼",
  "compare.rows.firstMonthFree": "ਪਹਿਲਾ ਮਹੀਨਾ ਮੁਫ਼ਤ",
  "compare.rows.noCardCharged": "ਇਸ ਦੇ ਮੁੱਕਣ ਤੱਕ ਕਾਰਡ ਤੋਂ ਪੈਸੇ ਨਹੀਂ ਕੱਟੇ ਜਾਂਦੇ",
  "compare.rows.trialOffered": "ਅਜ਼ਮਾਇਸ਼ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ",
  "compare.rows.seeTheirSite": "ਮੌਜੂਦਾ ਸ਼ਰਤਾਂ ਲਈ ਉਹਨਾਂ ਦੀ ਸਾਈਟ ਵੇਖੋ",

  // ── The add-on stack ────────────────────────────────────────────────────
  //
  // Rendered on /compare/fieldquo-vs-jobber AND on /pricing.
  "addOns.title": "{count} ਚੀਜ਼ਾਂ ਜਿਨ੍ਹਾਂ ਦੇ {competitor} ਵਾਧੂ ਪੈਸੇ ਲੈਂਦਾ ਹੈ",
  "addOns.intro": "ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਕੀਮਤਾਂ ਵਾਲੇ ਪੰਨੇ ਉੱਤੇ ਇਹ ਪਲਾਨ ਦੇ ਉੱਤੇ ਲੱਗਦੀਆਂ ਹਨ, ਹਰ ਇੱਕ ਦੀ ਆਪਣੀ ਮਹੀਨਾਵਾਰ ਕੀਮਤ ਨਾਲ। ਇਹਨਾਂ ਵਿੱਚੋਂ ਹਰ ਇੱਕ ਉਹ ਕੰਮ ਹੈ ਜੋ FieldQuo ਉਸੇ ਪਲਾਨ ਦੇ ਅੰਦਰ ਕਰਦਾ ਹੈ ਜਿਸ ਦੇ ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਪੈਸੇ ਦੇ ਰਹੇ ਹੋ।",
  "addOns.scope": "ਅਸੀਂ ਉਹਨਾਂ ਦੇ ਕੀਮਤਾਂ ਵਾਲੇ ਪੰਨੇ ਤੋਂ ਸਿਰਫ਼ ਨਾਂ ਅਤੇ ਕੀਮਤ ਪੜ੍ਹੀ ਹੈ, ਹੋਰ ਕੁਝ ਨਹੀਂ। ਉਹਨਾਂ ਦੇ ਐਡ-ਆਨ ਦੇ ਅੰਦਰ ਕੀ ਹੈ, ਇਹ ਅਸੀਂ ਨਹੀਂ ਜਾਂਚਿਆ, ਇਸ ਲਈ ਹੇਠਾਂ ਕੁਝ ਵੀ ਉਸ ਦਾ ਵੇਰਵਾ ਨਹੀਂ ਦਿੰਦਾ।",
  "addOns.money": "${amount} {currency} ਪ੍ਰਤੀ {per}",
  "addOns.provenance": "{checked} ਨੂੰ {country} ਦੇ ਕਨੈਕਸ਼ਨ ਤੋਂ ਪੜ੍ਹਿਆ ਗਿਆ",
  "addOns.sourceLink": "ਉਹਨਾਂ ਦਾ ਕੀਮਤਾਂ ਵਾਲਾ ਪੰਨਾ",
  "addOns.oursTitle": "FieldQuo ਵਿੱਚ, ਹਰ ਪਲਾਨ ਉੱਤੇ:",
  "addOns.limits": "ਇਹ ਕਿੱਥੇ ਰੁਕਦਾ ਹੈ:",
  "addOns.total": "{total} {currency} ਮਹੀਨਾ, ਪਲਾਨ ਦੀ ਕੀਮਤ ਦੇ ਉੱਤੇ।",
  "addOns.totalBody": "ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਸਿਲੈਕਟਰਾਂ ਉੱਤੇ ਜਿਸ ਥਾਂ ਅਸੀਂ ਇਹ ਪੜ੍ਹੇ, ਉੱਥੇ ਇਹ ਤਿੰਨੇ ਮਿਲ ਕੇ ਇੰਨੇ ਦੇ ਪੈਂਦੇ ਹਨ। FieldQuo ਵਿੱਚ ਇਹੀ ਤਿੰਨੇ ਕੰਮ ਹਰ ਪਲਾਨ ਵਿੱਚ, ਹਰ ਆਕਾਰ ਉੱਤੇ ਹਨ, ਇਸ ਪੰਨੇ ਦੇ ਸਭ ਤੋਂ ਸਸਤੇ ਪਲਾਨ ਤੋਂ ਹੀ।",
  "addOns.receptionist": "ਉਹਨਾਂ ਦਾ ਰਿਸੈਪਸ਼ਨਿਸਟ ਐਡ-ਆਨ ਇੱਕ ਮਹੀਨਾਵਾਰ ਘੱਟੋ-ਘੱਟ ਰਕਮ ਹੈ: ਜਿਸ ਮਹੀਨੇ ਫ਼ੋਨ ਇੱਕ ਵਾਰ ਵੀ ਨਾ ਵੱਜੇ, ਉਸ ਮਹੀਨੇ ਵੀ ਇਸ ਦੇ ਪੈਸੇ ਲੱਗਦੇ ਹਨ। ਸਾਡੇ ਵਿੱਚ ਕੋਈ ਮਹੀਨਾਵਾਰ ਘੱਟੋ-ਘੱਟ ਨਹੀਂ ਹੈ। ਇਹ ਸਹੂਲਤ ਹਰ ਪਲਾਨ ਵਿੱਚ ਹੈ ਅਤੇ ਗੱਲ ਕਰਨ ਦਾ ਸਮਾਂ ਪਹਿਲਾਂ ਭਰਿਆ ਕ੍ਰੈਡਿਟ ਹੈ ਜੋ ਤੁਸੀਂ ਲੋੜ ਵੇਲੇ ਖਰੀਦਦੇ ਹੋ, ਸੋ ਖ਼ਾਲੀ ਲੰਘੇ ਫ਼ਰਵਰੀ ਦਾ ਕੁਝ ਨਹੀਂ ਲੱਗਦਾ।",

  // ── /pricing's own line under the add-on stack ──────────────────────────
  "pricing.addOnsCompare": "ਉੱਪਰਲਾ ਹਰ ਅੰਕੜਾ ਦਿਖਾਈ ਗਈ ਤਾਰੀਖ਼ ਨੂੰ ਉਹਨਾਂ ਦੇ ਆਪਣੇ ਕੀਮਤਾਂ ਵਾਲੇ ਪੰਨੇ ਤੋਂ ਪੜ੍ਹਿਆ ਗਿਆ ਸੀ। ਪੂਰੀ ਨਾਲੋ-ਨਾਲ ਤੁਲਨਾ, ਜਿਸ ਵਿੱਚ ਇਹ ਵੀ ਹੈ ਕਿ FieldQuo ਕੀ ਨਹੀਂ ਕਰਦਾ, ਇੱਥੇ ਹੈ →",
};

export default pa;
