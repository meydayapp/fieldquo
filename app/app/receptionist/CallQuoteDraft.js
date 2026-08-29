"use client";

// app/app/receptionist/CallQuoteDraft.js
//
// What FieldQuo AI read off one phone call, and where it went.
//
// ── Two honest outcomes, and no third ──────────────────────────────────────
//
// PRICED. The caller gave everything the trade's instant-quote form needs, so
// the call went through the same path a homeowner's web form does and landed a
// draft in the review queue at /app/estimate-reviews. This panel links to it.
// It never shows the figure itself — the review screen does, next to the
// approve button, which is where a number people can act on belongs.
//
// NOT PRICED. Something was missing, so nothing was computed and nothing was
// created. The panel names the questions the call left open and offers the
// ordinary quote builder with what WAS heard already filled in.
//
// ── Why every line is quoted back ──────────────────────────────────────────
//
// A contractor who cannot tell what the AI made up will not trust it twice. So
// nothing here is asserted: every service and every measurement is shown beside
// the caller's own words, taken verbatim from the recording, and a value that
// could not be traced back to something the caller said never reached this
// screen at all (lib/ai/callQuoteDraft.js drops it).
//
// ── "You don't offer that" is not this panel's to say ─────────────────────
//
// It used to say it, and it was wrong. A caller asked a cabinet painter for new
// hinges and handles and this panel told the owner they don't sell them, while
// their own price book charged $35 a door for soft-close hinges. Three
// renderings now, and the distinction between them is the fix:
//
//   ADDED        an upgrade off the company's own price book, ticked on the
//                draft and priced by the builder. Never priced here.
//   CHECK THIS   something asked for that resembles what they sell but could
//                not be placed automatically. Named beside what it looked like.
//   NO MATCH     nothing in their services, price book or products matched. Even
//                this is not thrown away — it goes onto the quote's review notes.
//
// ── Whose sentence it is ───────────────────────────────────────────────────
//
// Some of these quotes are the caller's own words and some are the assistant
// repeating a fact back and the caller letting it stand — which is usually the
// cleaner sentence and is why lib/voice/transcript.js now accepts it. The panel
// says which, because a line the ROBOT said, shown as though the caller said
// it, is a small lie the estimator will catch once and then stop trusting the
// whole panel over.
//
// ── The recording, and why the link is not the recording ──────────────────
//
// Retell's recording URL is a bearer link: no signature, no expiry, no session.
// The link here is /api/voice/calls/<id>/recording, which is a FieldQuo path
// that checks the session and the tenant and streams the audio itself — so what
// reaches this browser, and anything it is ever pasted into, is useless to a
// stranger. Nothing client-facing carries either form. See lib/voice/recording.js.
//
// ── And what it did NOT hear is on the screen too ──────────────────────────
//
// The list of questions the call left unanswered is not a gap in the panel, it
// is the most useful thing in it: "they didn't say how many doors" is what the
// estimator has to ring back about. Padding those with a plausible average
// would multiply a guess by a rate and turn it into a price somebody sends.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Quote,
  CircleHelp,
  Ban,
  Plus,
  Search,
  MapPin,
  Image as ImageIcon,
  Play,
  UserCheck,
  UserPlus,
  MessageSquareText,
  CheckCheck,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { callRecordingHref } from "@/lib/voice/recording";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function CallQuoteDraft({ call, aiAvailable }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [draft, setDraft] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  // The whole call, fetched only when somebody asks for it. Twenty-eight turns
  // are not a summary and must not be pasted into a notes box — but they are
  // already in the database, so they are one click away rather than lost.
  const [turns, setTurns] = useState(null);

  // No words, nothing to read. Offered as an explanation rather than a disabled
  // button nobody can account for.
  if (!call.hasTranscript) return null;

  async function load(generate) {
    setBusy(true);
    setReason("");
    try {
      const res = await fetch(`/api/voice/calls/${call.id}/draft-quote`, {
        method: generate ? "POST" : "GET",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // A named reason ("this company has no services switched on") is worth
        // more than a red banner, so those are rendered as an explanation and
        // only genuine failures go through reportResponseError.
        if (data?.reason) {
          setReason(data.reason);
          setOpen(true);
          return;
        }
        await reportResponseError(res, t("app.callDraft.error"));
        return;
      }

      if (!data?.draft) {
        setReason(data?.reason || "nothing_quotable");
        setOpen(true);
        return;
      }
      setDraft(data.draft);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function loadTranscript() {
    if (turns) {
      setTurns(null);
      return;
    }
    const res = await fetch(`/api/voice/calls/${call.id}/transcript`);
    if (!res.ok) {
      await reportResponseError(res, t("app.callDraft.error"));
      return;
    }
    const data = await res.json().catch(() => null);
    setTurns(Array.isArray(data?.turns) ? data.turns : []);
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={busy || !aiAvailable}
        onClick={() => load(!call.quoteDraftedAt)}
        title={aiAvailable ? undefined : t("app.callDraft.aiOff")}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Sparkles size={13} />
        )}
        {call.quoteDraftedAt
          ? t("app.callDraft.seeDraft")
          : t("app.callDraft.draftIt")}
      </button>
    );
  }

  return (
    <div className="w-full mt-2 rounded-lg border border-border bg-muted/40 p-3 space-y-3">
      <div className="flex items-baseline gap-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles size={13} /> {t("app.callDraft.title")}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          {t("app.callDraft.hide")}
        </button>
      </div>

      {reason ? (
        <p className="text-xs text-muted-foreground">
          {t(`app.callDraft.reason.${reason}`)}
        </p>
      ) : null}

      {/* ── What the assistant repeated back, and nobody corrected ─────────
          The most reliable sentences in the call: the fact spelled out, then
          agreed to. Shown above the drafted scope because this is what the
          scope was drafted FROM, and because things with no field to land in —
          a colour, a confirmed email — reach the estimator here or nowhere. */}
      {(draft?.confirmed || []).length > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <CheckCheck size={13} /> {t("app.callDraft.confirmedFacts")}
          </p>
          <ul className="mt-1 space-y-1">
            {draft.confirmed.map((line, i) => (
              <li key={i} className="text-xs text-muted-foreground italic">
                “{line}”
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Who this call is now attached to. Said out loud because it is a WRITE:
          a client the estimator did not create has appeared on their list, and
          finding that out from the client list later is how people stop
          trusting an assistant. Matched and created are deliberately different
          sentences — one is a link, the other is a new row. */}
      {(draft?.client?.created || draft?.client?.matchedOn) && draft?.client?.name && (
        <p className="text-xs text-foreground flex gap-1.5">
          {draft.client.created ? (
            <UserPlus size={12} className="mt-0.5 shrink-0" />
          ) : (
            <UserCheck size={12} className="mt-0.5 shrink-0" />
          )}
          <span>
            {draft.client.created
              ? t("app.callDraft.clientCreated", { name: draft.client.name })
              : t("app.callDraft.clientMatched", { name: draft.client.name })}
          </span>
        </p>
      )}

      {/* The audio. Only rendered when a recording actually exists — an
          always-present button that 404s is the dead control AGENTS.md is
          about. Internal: this href needs a session and the right tenant. */}
      {draft?.recording?.callId && (
        <a
          href={callRecordingHref(draft.recording.callId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
        >
          <Play size={13} /> {t("app.receptionist.listen")}
        </a>
      )}

      {/* And the words. Stored all along and openable nowhere until now — see
          /api/voice/calls/[id]/transcript. Fetched on demand, never inlined
          into the draft: the draft is copied into the quote builder and stored
          on the call row, and a transcript does not belong in either. */}
      <div>
        <button
          type="button"
          onClick={loadTranscript}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
        >
          <MessageSquareText size={13} />
          {turns ? t("app.callDraft.hideTranscript") : t("app.callDraft.readTranscript")}
        </button>
        {turns && (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border bg-card p-3 space-y-1.5">
            {turns.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("app.callDraft.reason.no_transcript")}
              </p>
            ) : (
              turns.map((turn, i) =>
                // ── What the agent DID, not just what it said ─────────────
                //
                // Deliberately untranslated: the row is a function name and a
                // tick or a cross. The tool names are literals we send to the
                // provider in English and they are the same string in every
                // locale, so wrapping them in copy would mean six translations
                // of the word "tool" wrapped around an identifier nobody
                // translates.
                turn.role === "tool" ? (
                  <p key={i} className="text-xs font-mono flex gap-1.5">
                    <span
                      className={
                        turn.ok === false ? "text-destructive" : "text-muted-foreground"
                      }
                      aria-hidden="true"
                    >
                      {turn.ok === false ? "✗" : turn.ok === true ? "✓" : "→"}
                    </span>
                    <span className="text-muted-foreground shrink-0">{turn.tool}</span>
                    <span className="text-muted-foreground/70 truncate">{turn.text}</span>
                  </p>
                ) : (
                  <p key={i} className="text-xs">
                    <span className="font-semibold text-foreground">
                      {turn.role === "agent"
                        ? t("app.callDraft.speakerAgent")
                        : t("app.callDraft.speakerCaller")}
                    </span>{" "}
                    <span className="text-muted-foreground">{turn.text}</span>
                  </p>
                ),
              )
            )}
          </div>
        )}
      </div>

      {/* What the receptionist wrote down during the call. Rendered ABOVE the
          drafted scope on purpose: it is the only thing on this panel the model
          did not produce, so it is what the rest gets checked against. */}
      {draft?.callerNotes && (
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs font-semibold text-foreground">
            {t("app.callDraft.callerNotes")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">
            {draft.callerNotes}
          </p>
        </div>
      )}

      {/* Where the work is. It was on the draft and off the screen, which made
          the not-priced outcome look thinner than it is: a call that could not
          be auto-priced is a HANDOFF, and the address is the first thing
          whoever raises the quote by hand needs. Quoted back in the caller's
          own words like everything else here, because a half-heard street is
          worse than none. */}
      {draft?.address?.value && (
        <p className="text-xs text-foreground flex gap-1.5">
          <MapPin size={12} className="mt-0.5 shrink-0" />
          <span>
            {t("app.callDraft.jobAddress", { address: draft.address.value })}
            {draft.address.said && (
              <span className="text-muted-foreground italic">
                {" "}
                — “{draft.address.said}”
              </span>
            )}
          </span>
        </p>
      )}

      {/* Photos: a phone call cannot carry one, so the assistant asks for them
          by email. Said out loud here so a reviewer can tell a quote that is
          photo-less ON PURPOSE from one nobody chased — and worded so it never
          reads as a blocker. The owner's line: pictures are optional, given
          that the assistant got the information over the phone. */}
      {draft?.photos && (
        <p className="text-xs text-muted-foreground flex gap-1.5">
          <ImageIcon size={12} className="mt-0.5 shrink-0" />
          <span>
            {draft.photos.received > 0
              ? t("app.callDraft.photosArrived", { count: draft.photos.received })
              : draft.photos.to
                ? t("app.callDraft.photosAsked", { to: draft.photos.to })
                : t("app.callDraft.photosAskedNoAddress")}
          </span>
        </p>
      )}

      {(draft?.groups || []).map((g) => (
        <div key={g.categoryKey} className="rounded-md border border-border bg-card p-3">
          <p className="text-sm font-semibold text-foreground">{g.label}</p>

          {g.evidence?.scope && (
            <p className="mt-1 text-xs text-muted-foreground flex gap-1.5">
              <Quote size={12} className="mt-0.5 shrink-0" />
              <span className="italic">
                “{g.evidence.scope}”
                {g.evidenceSource?.scope === "confirmed" && (
                  <span className="not-italic">
                    {" "}
                    ({t("app.callDraft.confirmedOnCall")})
                  </span>
                )}
              </span>
            </p>
          )}

          {Object.keys(g.intakeValues || {}).length > 0 && (
            <ul className="mt-2 space-y-1">
              {Object.entries(g.intakeValues).map(([key, value]) => (
                <li key={key} className="text-xs text-foreground">
                  <span className="font-medium">
                    {g.fieldLabels?.[key] || key}
                  </span>
                  : {String(value)}
                  {g.evidence?.[key] && (
                    <span className="text-muted-foreground italic">
                      {" "}
                      — “{g.evidence[key]}”
                      {g.evidenceSource?.[key] === "confirmed" && (
                        <span className="not-italic">
                          {" "}
                          ({t("app.callDraft.confirmedOnCall")})
                        </span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* The upgrades the caller asked for. Shown with their price-book
              label and the caller's own words, and with no figure — the
              builder prices them from the company's own book. */}
          {(g.addOns || []).length > 0 && (
            <ul className="mt-2 space-y-1">
              {g.addOns.map((a) => (
                <li key={a.key} className="text-xs text-foreground flex gap-1.5">
                  <Plus size={12} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">{a.label}</span>
                    {a.said && (
                      <span className="text-muted-foreground italic">
                        {" "}
                        — “{a.said}”
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* The unanswered questions, said out loud. Absence of a statement is
              not a statement — see the header. */}
          {(g.missing || []).length > 0 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 flex gap-1.5">
              <CircleHelp size={12} className="mt-0.5 shrink-0" />
              <span>
                {t("app.callDraft.notTold", {
                  fields: g.missing
                    .map((k) => g.fieldLabels?.[k] || k)
                    .join(", "),
                })}
              </span>
            </p>
          )}
        </div>
      ))}

      {/* Priced, and waiting for somebody to approve it. This is the whole
          point: the call went through the SAME instant-quote path a homeowner's
          web form does, so the figure is the company's own configured pricing
          and it is sitting in the existing review queue rather than in a new
          place nobody checks. */}
      {draft?.estimate?.quoteId && (
        <div className="rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            {t("app.callDraft.estimateReady", {
              number: draft.estimate.quoteNumber,
            })}
          </p>
          <Link
            href="/app/estimate-reviews"
            className="mt-2 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-inverted text-inverted-foreground font-semibold"
          >
            {t("app.callDraft.openReview")}
          </Link>
        </div>
      )}

      {/* And when it could not be priced, the questions the call left open —
          named, never filled in with something plausible. */}
      {(draft?.blocked || []).map((b) => (
        <p
          key={b.categoryKey}
          className="text-xs text-muted-foreground flex gap-1.5"
        >
          <CircleHelp size={12} className="mt-0.5 shrink-0" />
          <span>
            {b.missing?.length
              ? t("app.callDraft.blocked.missing", {
                  fields: b.missing
                    .map(
                      (k) =>
                        draft.groups?.find((g) => g.categoryKey === b.categoryKey)
                          ?.fieldLabels?.[k] || k,
                    )
                    .join(", "),
                })
              : b.missingQuestions?.length
                ? // An estimator exists and this quote type cannot feed it —
                  // "not set up for instant pricing" would be false, and would
                  // send somebody to switch on a trade that is already on.
                  t("app.callDraft.blocked.measure_mismatch", {
                    fields: b.missingQuestions.join(", "),
                  })
                : t(`app.callDraft.blocked.${b.reason}`)}
          </span>
        </p>
      ))}

      {/* Asked for, not placed, but it looks like something they DO sell.
          Never a refusal — the panel names what it resembles and asks. */}
      {(draft?.review || []).map((r) => (
        <p key={r.asked} className="text-xs text-muted-foreground flex gap-1.5">
          <Search size={12} className="mt-0.5 shrink-0" />
          <span>
            {t("app.callDraft.checkThis", {
              asked: r.asked,
              items: r.looksLike.join(", "),
            })}
          </span>
        </p>
      ))}

      {(draft?.unmatched || []).length > 0 && (
        <p className="text-xs text-muted-foreground flex gap-1.5">
          <Ban size={12} className="mt-0.5 shrink-0" />
          <span>
            {t("app.callDraft.noMatch", {
              items: draft.unmatched.join(", "),
            })}
          </span>
        </p>
      )}

      {/* Everything above, as it will reach whoever reviews the quote. Shown so
          the estimator knows the note exists before they open the builder —
          and said out loud that the client never sees it. */}
      {draft?.reviewNotes && (
        <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            {t("app.callDraft.reviewNotes")}
          </p>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80 whitespace-pre-line">
            {draft.reviewNotes}
          </p>
        </div>
      )}

      {/* Reachable whenever there is anything to carry across — a call that
          produced only a note for review still has to reach the builder, or
          the note has nowhere to land. */}
      {(draft?.groups?.length > 0 || draft?.reviewNotes) && (
        <>
          <p className="text-[11px] text-muted-foreground">
            {t("app.callDraft.noPrices")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/app/quotes/new?fromCall=${call.id}`)}
              className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-inverted text-inverted-foreground font-semibold"
            >
              {t("app.callDraft.openBuilder")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => load(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              {busy && <Loader2 size={13} className="animate-spin" />}
              {t("app.callDraft.readAgain")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
