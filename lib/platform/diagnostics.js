// lib/platform/diagnostics.js
//
// Turning a failure into a sentence the owner can act on.
//
// ══ The complaint this answers ═════════════════════════════════════════════
//
// Three screens in the platform console reported, respectively, "Couldn't read
// the voice numbers just now", "Couldn't check the agents just now", and six
// rows of "We couldn't check this one. Nothing is claimed either way." The
// owner's words: "i have no idea what to do with that information."
//
// Those messages were HALF right, and the half they got right is worth keeping:
// none of them claimed success, and none of them turned an unknown into a
// green tick. What they never did was say WHY, and a message that admits
// ignorance without naming its cause gives nobody a next step.
//
// The distinction that carries all the value is four-way, and it was being
// collapsed to one:
//
//   UNCONFIGURED  a variable isn't set. Nothing was sent anywhere. Fix is in
//                 Vercel, and no amount of pressing Refresh will help.
//   REJECTED      the vendor answered, and said no. The setting exists and is
//                 wrong — a different fix, in a different place.
//   UNREACHABLE   nobody answered. Usually transient. Refresh is the whole
//                 remedy, and telling somebody to check their configuration
//                 sends them to rewrite something that was never broken.
//   EMPTY         it worked and there is nothing there. Not a failure at all,
//                 and the one this codebase has historically been worst at —
//                 see scripts/check-empty-vs-error.mjs.
//
// ══ Why the sentences are built from a closed set ══════════════════════════
//
// Every message below is assembled from a fixed template plus two things that
// are safe by construction: an environment variable's NAME, and an HTTP status
// number. A vendor's own error text is never pasted in unscrubbed, because the
// natural thing for an API to echo on an auth failure is the credential it
// rejected — and this text is rendered in a browser. `scrubSecrets` is the
// belt; building from templates is the braces. scripts/check-platform-
// diagnostics.mjs plants a key value in every input and asserts no output
// carries it.
//
// ══ English only ═══════════════════════════════════════════════════════════
//
// The platform console is FieldQuo's own back office and no page in it is
// translated (0 of 30). These strings deliberately do not go through i18n; the
// tenant-facing equivalents live in lib/voice/readinessCopy.js and do.

/** Every failure this module can name. A caller may not invent a tenth. */
export const DIAGNOSIS_KINDS = [
  "not_configured",
  "rejected",
  "forbidden",
  "rate_limited",
  "not_found",
  "invalid_request",
  "provider_error",
  "timeout",
  "unreachable",
  "database_cold",
  "database_error",
  "unknown",
];

/**
 * Kinds where the honest advice is "press Refresh", and nothing else.
 *
 * Separated from the message so a screen can decide whether to OFFER a refresh
 * rather than only mention one — a Refresh button on an unset environment
 * variable is a control that cannot work.
 */
export const TRANSIENT_KINDS = ["timeout", "unreachable", "rate_limited", "database_cold"];

/** Is this kind worth retrying without changing anything? */
export function isTransient(kind) {
  return TRANSIENT_KINDS.includes(kind);
}

/**
 * Environment variables whose VALUES must never appear in a rendered message.
 *
 * Names are safe and are the whole point — "RETELL_API_KEY isn't set" is the
 * useful sentence. Values are not, and this is the list scrubSecrets consults
 * so a vendor that echoes a credential back at us cannot launder it through an
 * error message onto a screen.
 */
export const SECRET_ENV_VARS = [
  "RETELL_API_KEY",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_API_KEY_SECRET",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "DATABASE_URL",
];

/**
 * Anything that looks like a credential, removed from free text.
 *
 * Two passes, and both are needed. The first removes the actual values this
 * deployment holds, which catches a vendor echoing our key verbatim. The second
 * removes credential-SHAPED runs, which catches the case the first cannot: a
 * key belonging to something else, or one rotated since the process booted.
 *
 * Deliberately aggressive. A scrubbed diagnostic that reads "[redacted]" where
 * a token was is still actionable; a leaked key on a screen is not recoverable.
 */
export function scrubSecrets(text, { env = process.env } = {}) {
  let out = String(text ?? "");
  if (!out) return out;

  for (const name of SECRET_ENV_VARS) {
    const value = env?.[name];
    // Short values are not credentials and would carve holes in ordinary
    // prose — a two-character value would redact half the alphabet.
    if (typeof value === "string" && value.length >= 8) {
      out = out.split(value).join("[redacted]");
    }
  }

  // Bearer tokens and vendor-prefixed keys, whoever they belong to.
  out = out.replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
  out = out.replace(/\b(?:sk|pk|rk|key|token)[-_][A-Za-z0-9_-]{12,}/gi, "[redacted]");
  // A bare long run of key-ish characters. 24 is above any status word or URL
  // path segment this console renders and below every real key we issue.
  out = out.replace(/\b[A-Za-z0-9]{24,}\b/g, "[redacted]");
  return out;
}

/**
 * Which kind a thrown thing is.
 *
 * A RetellError already knows — lib/voice/retell.js sets `kind` on every throw,
 * and taking its word is the point of this whole change: the boundary that
 * spoke to the vendor is the only layer that can tell a timeout from a refusal.
 *
 * Everything else is classified from what it carries, because not every vendor
 * client in this codebase is ours. An `AbortError` is a timeout wherever it
 * comes from; a fetch TypeError is a transport failure; a bare status is
 * enough on its own.
 */
export function classifyVendorError(err) {
  if (!err) return "unknown";
  if (typeof err.kind === "string" && DIAGNOSIS_KINDS.includes(err.kind)) return err.kind;

  if (err.name === "AbortError" || err.name === "TimeoutError") return "timeout";

  const status = Number(err.status ?? err.statusCode ?? err.code);
  if (Number.isFinite(status) && status > 0) {
    if (status === 401) return "rejected";
    if (status === 403) return "forbidden";
    if (status === 429) return "rate_limited";
    if (status === 404) return "not_found";
    if (status === 504) return "timeout";
    if (status >= 500) return "provider_error";
    if (status >= 400) return "invalid_request";
  }

  // A fetch that never got a reply throws a TypeError, and Node hangs the real
  // reason off `cause`. Neither carries a status, and both mean the same thing.
  if (err instanceof TypeError || err.cause) return "unreachable";
  return "unknown";
}

/**
 * One vendor failure, named.
 *
 * @param err       the thrown error. A RetellError's `kind` is trusted; anything
 *                  else is classified from what it carries.
 * @param vendor    "Retell", "Twilio" — used in the sentence, never guessed.
 * @param envVar    the variable that would have to be set for this to work.
 * @returns { kind, message, transient, status }  message is browser-safe.
 *
 * Never throws. A diagnostic that can fail is a diagnostic that reports
 * "couldn't check" about itself.
 */
export function describeVendorFailure(err, { vendor = "the provider", envVar = null, env = process.env } = {}) {
  const kind = classifyVendorError(err);
  const status = Number.isFinite(Number(err?.status)) ? Number(err.status) : null;
  const name = envVar ? String(envVar) : null;

  // The vendor's own words, kept ONLY where they add something a template
  // cannot — a 4xx that means our request body was wrong. Scrubbed regardless.
  const detail = scrubSecrets(err?.message || "", { env });

  switch (kind) {
    case "not_configured":
      return done(
        kind,
        name
          ? `${name} isn't set on this deployment, so ${vendor} was never asked anything. Add it in Vercel and redeploy.`
          : `${vendor} isn't configured on this deployment, so it was never asked anything.`,
      );
    case "rejected":
      return done(
        kind,
        name
          ? `${vendor} answered 401 — a key is set and ${vendor} refused it. Check ${name} in Vercel against a live key on the ${vendor} account, then redeploy. Refreshing will not change this.`
          : `${vendor} answered 401 — the credential is set and was refused.`,
      );
    case "forbidden":
      return done(
        kind,
        `${vendor} answered 403 — the key was accepted but is not allowed to do this. Check the key's permissions on the ${vendor} account; this is not a network problem.`,
      );
    case "rate_limited":
      return done(
        kind,
        `${vendor} answered 429 — too many requests. Nothing is wrong with the configuration. Wait a minute and press Refresh.`,
      );
    case "not_found":
      return done(
        kind,
        `${vendor} answered 404 — it replied, and does not have the thing we asked about. That is an answer, not an outage.`,
      );
    case "timeout": {
      const seconds = Number.isFinite(Number(err?.timeoutMs))
        ? Math.round(Number(err.timeoutMs) / 1000)
        : null;
      return done(
        kind,
        `${vendor} didn't answer${seconds ? ` within ${seconds}s` : " in time"}. Nothing is claimed about the result. This is usually transient — press Refresh.`,
      );
    }
    case "unreachable":
      return done(
        kind,
        `Couldn't reach ${vendor} at all — no reply of any kind, so nothing is known either way. Usually a network blip: press Refresh. If it persists, check ${vendor}'s status page.`,
      );
    case "provider_error":
      return done(
        kind,
        `${vendor} answered ${status ?? "5xx"} — the fault is at their end, not in this deployment's configuration. Press Refresh in a minute.`,
      );
    case "invalid_request":
      return done(
        kind,
        `${vendor} refused the request${status ? ` with ${status}` : ""}: ${detail || "no reason given"}. This is a bug on our side, not a setting — the request body was wrong.`,
      );
    default:
      return done(
        "unknown",
        `Something failed before ${vendor} answered${detail ? `: ${detail}` : ""}. Nothing is claimed about the result.`,
      );
  }

  function done(k, message) {
    return { kind: k, message: scrubSecrets(message, { env }), transient: isTransient(k), status };
  }
}

/**
 * A database failure, named — and the cold-start one told apart from the rest.
 *
 * Neon scales to zero, so the FIRST query after an idle spell can fail with
 * P1001 and succeed on the retry. AGENTS.md says to retry once before believing
 * the database is down, and a screen that reports a cold start as an outage
 * sends the owner to a status page over a connection that is already back.
 */
export function describeDatabaseFailure(err, { env = process.env } = {}) {
  const code = err?.code || err?.errorCode || null;
  const text = scrubSecrets(err?.message || "", { env });

  if (code === "P1001" || /can't reach database server|P1001/i.test(text)) {
    return {
      kind: "database_cold",
      message:
        "The database didn't answer (P1001). Neon scales to zero when idle, so the first read after a quiet spell can fail and the next one succeeds. Press Refresh once before believing it is down.",
      transient: true,
      status: null,
    };
  }
  return {
    kind: "database_error",
    // The Prisma code is the useful form of the answer for this reader, and a
    // code is not a secret. The message is scrubbed because a connection string
    // is exactly the kind of thing Prisma puts in one.
    message: `The database refused the read${code ? ` (${code})` : ""}. This is not a provider problem and Refresh will not clear it.`,
    transient: false,
    status: null,
  };
}

/**
 * Whichever of the two above fits. For a route where either can fail.
 *
 * Prisma errors are recognised by their `code`/`clientVersion`, not by
 * instanceof: this module is pure and must not import the Prisma client, or
 * every check script that loads it would need a database.
 */
export function describeFailure(err, opts = {}) {
  const looksPrisma =
    typeof err?.code === "string" && /^P\d{4}$/.test(err.code) ? true : Boolean(err?.clientVersion);
  return looksPrisma ? describeDatabaseFailure(err, opts) : describeVendorFailure(err, opts);
}

/* ═══════════════════ empty is not an error ═══════════════════════════════ */

/**
 * The sentence for a call that SUCCEEDED and returned nothing.
 *
 * Its own function because the failure this codebase repeats is rendering an
 * empty success and a failed read with the same words. `checked` is the
 * evidence: a screen may only say "there is nothing here" when something
 * actually looked.
 */
export function describeEmpty({ subject, checkedAt = null }) {
  return {
    kind: "empty",
    message: `Nothing to show: ${subject}. This is an answer — the read succeeded${
      checkedAt ? ` at ${new Date(checkedAt).toLocaleTimeString("en-CA")}` : ""
    } and found nothing, rather than failing.`,
    transient: false,
    status: null,
  };
}
