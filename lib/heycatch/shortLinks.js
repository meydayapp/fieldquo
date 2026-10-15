// lib/heycatch/shortLinks.js
//
// HeyCatch's channel short links — fieldquo.com/a → /?utm_source=heycatch&utm_campaign=a
// — as next.config.mjs redirect rules. Plain ESM with no `@/` imports, because
// next.config.mjs loads it under bare Node before any bundler runs.
//
// ══ Which characters ══════════════════════════════════════════════════════
//
// HeyCatch reserves the 36 single-character paths /a–/z and /0–/9. Seven of
// those letters are already FieldQuo route prefixes a homeowner reaches —
// /c/<slug> (business card), /f/<company>/<funnel>, /i/<token>, /l/<company>,
// /q/<token>, /r/<token>, /w/<token> — and they are left out of the rule
// entirely. A bare /q is not a page today, but a rule that sends it to our
// homepage would be one more thing standing between a tenant's link and its
// document; the owner's instruction is to exclude every letter already used.
// check:heycatch fails if a new one-letter route appears under app/ and is not
// listed here.
//
// ══ Which hosts ═══════════════════════════════════════════════════════════
//
// next.config redirects run BEFORE middleware.js, so without a host condition
// this rule would fire on sunset.fieldquo.com/a — bouncing a homeowner on a
// contractor's own website to a FieldQuo URL tagged "heycatch". The `has`
// condition restricts it to FieldQuo's own hosts. Next matches it as
// ^(value)$ against the hostname with the port removed.
//
// ══ Why the SDK's own forwarder does not do this ═══════════════════════════
//
// The SDK forwards reserved paths itself the moment its module evaluates. On
// FieldQuo it is only ever loaded on FieldQuo's own pages (lib/heycatch/client.js),
// so the host rule is what makes the links work — and it answers before any
// HTML is sent, which is HeyCatch's preferred shape anyway.

export const USED_SINGLE_LETTER_ROUTES = Object.freeze(["c", "f", "i", "l", "q", "r", "w"]);

const ALL = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

export const SHORT_LINK_CHARS = Object.freeze(ALL.filter((ch) => !USED_SINGLE_LETTER_ROUTES.includes(ch)));

export const SHORT_LINK_HOST_PATTERN = "(?:(?:www\\.)?fieldquo\\.com|localhost)";

export function shortLinkRedirects() {
  return [
    {
      source: `/:l(${SHORT_LINK_CHARS.join("|")})`,
      has: [{ type: "host", value: SHORT_LINK_HOST_PATTERN }],
      destination: "/?utm_source=heycatch&utm_campaign=:l",
      // 302 exactly, as HeyCatch specifies — `permanent: false` would be a 307.
      statusCode: 302,
    },
  ];
}
