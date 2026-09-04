"use client";

// app/plan/[token]/PlanAuthorisation.js
//
// The client's authorisation page. A stranger with no account, often on a phone,
// on a bad connection, in a driveway — and being asked to agree to a standing
// arrangement to take their money.
//
// ── Why the terms are on OUR page and not left to Stripe ────────────────────
//
// Stripe's hosted setup flow collects the instrument, and for Canadian
// pre-authorized debit renders and emails its own PAD agreement. It does not
// state what Stripe's own compliance guidance requires a merchant to state for
// off-session charging: that a SERIES of payments will be initiated, their
// timing and frequency, how the amount is determined, and the cancellation
// policy. That is this page. The client reads it, ticks one box, and only then
// is a Stripe session created — see the POST handler for why the order matters.
//
// It is also the only way this can stay white-label. The homeowner is agreeing
// to pay the contractor, under the contractor's name and colour; the word
// FieldQuo appears nowhere.
//
// ── Why the body is here and the route is a server file ─────────────────────
//
// It was all one "use client" page.js, which meant it could export no
// `metadata` — and so this page, alone among the token-gated client-facing
// pages, was missing `robots: { index: false }`. /q, /portal, /visit, /survey,
// /unsubscribe and /no-contact all block crawlers because a token in a search
// index is the token handed to whoever reads the index. This one authorises a
// standing arrangement to take somebody's money, and it was the crawlable one.
// Splitting the shell off is the only way Next lets a page have both a client
// body and metadata.

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/fetchJson";
import { documentTheme, fillPair, neutralPair } from "@/lib/documents/theme";

// English and French only, matching AUTHORISATION_LANGUAGES — the plan cannot
// be sold on the automatic tier in a language whose consent wording nobody
// fluent has read, so this page never has to render one. The language comes
// from the TERMS, not the browser: the client agrees to the wording they were
// shown, and a page that flipped language on a different device would be
// showing them different words from the ones recorded against their name.
const PAGE = {
  en: {
    invalid: "This link isn’t valid any more. Ask the company for a new one.",
    closed: (name, phone) =>
      `This arrangement is no longer running. Nothing will be charged. If you think that’s wrong, contact ${name}${phone ? ` on ${phone}` : ""}.`,
    doneTitle: "You’re set up. Nothing more to do.",
    checking: "Checking with your bank…",
    submit: "Agree and continue",
    submitting: "One moment…",
    reassure:
      "You’ll enter your card or bank details on a secure page. Nothing is charged today.",
    verifying:
      "Your bank details were received but still need to be verified. Your bank will confirm this in a day or two, and there is nothing more for you to do here.",
  },
  fr: {
    invalid:
      "Ce lien n’est plus valide. Demandez-en un nouveau à l’entreprise.",
    closed: (name, phone) =>
      `Cette entente n’est plus en vigueur. Aucun montant ne sera prélevé. Si cela vous semble erroné, communiquez avec ${name}${phone ? ` au ${phone}` : ""}.`,
    doneTitle: "Tout est en place. Rien d’autre à faire.",
    checking: "Vérification auprès de votre banque…",
    submit: "Accepter et continuer",
    submitting: "Un instant…",
    reassure:
      "Vous saisirez vos renseignements bancaires ou de carte sur une page sécurisée. Aucun montant n’est prélevé aujourd’hui.",
    verifying:
      "Vos renseignements bancaires ont été reçus mais doivent encore être vérifiés. Votre banque le confirmera d’ici un ou deux jours; vous n’avez rien d’autre à faire ici.",
  },
};

export default function PlanAuthorisation() {
  const { token } = useParams();
  const search = useSearchParams();
  const setupSession = search.get("setup");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Set by the return leg from Stripe, so the page can say "you're set up"
  // without waiting on a webhook that may be seconds behind or misconfigured.
  const [justAuthorised, setJustAuthorised] = useState(false);
  const [returnPending, setReturnPending] = useState(Boolean(setupSession));
  // Stripe accepted the bank details but they still need verifying. Held as a
  // flag rather than a message string because the sentence has to be rendered in
  // the PLAN's language, which isn't known until the payload lands.
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  // Before the payload lands there is no plan language to read, so the link-is-
  // dead message falls back to English. Once it lands, everything follows the
  // terms' own language.
  const copyFor = (code) => PAGE[code] || PAGE.en;

  const load = useCallback(async () => {
    try {
      setData(await fetchJson(`/api/plan/${token}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // The return leg. Does exactly what the webhook does; whichever arrives first
  // wins and the second is a no-op.
  useEffect(() => {
    if (!setupSession) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchJson(`/api/plan/${token}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: setupSession }),
        });
        if (cancelled) return;
        setJustAuthorised(Boolean(res.authorised));
        // Not authorised, and we know why — a bank account still in
        // micro-deposit verification, most often. Said, not hidden behind a
        // spinner that never resolves.
        if (!res.authorised && res.reason === "setup_incomplete") {
          setAwaitingVerification(true);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) {
          setReturnPending(false);
          load();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setupSession, token, load]);

  const agree = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetchJson(`/api/plan/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      if (res.setupUrl) {
        window.location.href = res.setupUrl;
        return;
      }
      // Already done — reload rather than leave a submitted-looking button.
      await load();
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="animate-pulse w-full max-w-lg space-y-3" aria-busy="true">
          <div className="h-10 bg-black/10 rounded-lg" />
          <div className="h-48 bg-black/10 rounded-lg" />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <p role="alert" className="text-sm text-center max-w-md">
          {error || PAGE.en.invalid}
        </p>
      </main>
    );
  }

  const theme = documentTheme(data.company);
  const fill = fillPair(theme);
  const done = data.alreadyAuthorised || justAuthorised;
  const copy = copyFor(data.terms.language);
  const disabled = neutralPair(theme);

  return (
    <main style={{ background: theme.paper, color: theme.ink }} className="min-h-dvh">
      {/* The brand band — the same first mark as the emails and the PDF. */}
      <div style={{ background: fill.bg, color: fill.fg }} className="px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {data.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.company.logoUrl}
              alt={data.company.name}
              className="h-8 w-auto"
            />
          ) : (
            <span className="font-bold text-lg">{data.company.name}</span>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-5 space-y-5">
        <h1 className="text-xl font-bold" style={{ color: theme.ink }}>
          {data.terms.title}
        </h1>

        {data.closed ? (
          // A cancelled plan's link keeps working and says what happened rather
          // than 404ing, which would read as a broken link from the contractor.
          <p style={{ color: theme.inkMuted }} className="text-sm">
            {copy.closed(data.company.name, data.company.phone)}
          </p>
        ) : done ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold" style={{ color: theme.ink }}>
              {copy.doneTitle}
            </p>
            <p className="text-sm" style={{ color: theme.inkMuted }}>
              {data.terms.bullets[1]} {data.terms.bullets[2]}
            </p>
            <p className="text-sm" style={{ color: theme.inkMuted }}>
              {data.terms.bullets[4]}
            </p>
          </div>
        ) : returnPending ? (
          <p className="text-sm" style={{ color: theme.inkMuted }}>
            {copy.checking}
          </p>
        ) : (
          <>
            <p className="text-sm" style={{ color: theme.inkMuted }}>
              {data.terms.intro}
            </p>

            <ul className="space-y-2 list-disc pl-5">
              {data.terms.bullets.map((line, i) => (
                <li key={i} className="text-sm" style={{ color: theme.ink }}>
                  {line}
                </li>
              ))}
            </ul>

            {data.terms.cancelNote && (
              <p className="text-sm font-semibold" style={{ color: theme.ink }}>
                {data.terms.cancelNote}
              </p>
            )}

            <label className="flex gap-3 items-start cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1 h-5 w-5"
              />
              <span className="text-sm" style={{ color: theme.ink }}>
                {data.terms.consentLabel}
              </span>
            </label>

            <button
              onClick={agree}
              disabled={!checked || submitting}
              // Disabled state uses the measured wash pair, not a guessed grey:
              // neutralPair returns a foreground checked at 4.5:1 against it.
              style={
                checked
                  ? { background: fill.bg, color: fill.fg }
                  : { background: disabled.bg, color: disabled.fg }
              }
              className="w-full rounded-full px-5 py-3.5 text-sm font-bold disabled:cursor-not-allowed"
            >
              {submitting ? copy.submitting : copy.submit}
            </button>

            <p className="text-xs text-center" style={{ color: theme.inkMuted }}>
              {copy.reassure}
            </p>
          </>
        )}

        {awaitingVerification && (
          <p className="text-sm" style={{ color: theme.inkMuted }}>
            {copy.verifying}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm" style={{ color: theme.negative }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
