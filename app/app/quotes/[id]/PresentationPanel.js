// app/app/quotes/[id]/PresentationPanel.js
//
// THIS quote's proposal, on the quote page: what the homeowner sees when
// they open the link, in the order they see it — with on/off per section,
// the library documents to include, the crew size behind the day plan, and
// the waivers attached. Mirrors the Email sections panel's rule next door:
// company default + a nullable per-quote override, and a section with
// nothing behind it is greyed here and never rendered.
//
// "Your project" is the quote itself and has no switch.
//
// ── Two modes, one panel ────────────────────────────────────────────────────
//
// With a `quoteId` it reads and PATCHes its own row, which is what the quote
// page and the builder's Presentation tab on a SAVED quote do.
//
// Without one — the builder on /app/quotes/new — the overrides have nowhere
// to be saved yet, so they live in builder state and arrive as `value` with
// an `onChange`; the create POST writes them with the rest of the quote.
// Everything the panel SHOWS is company-level either way and comes from
// /api/quotes/new/presentation, so the tab opens on the company's defaults
// rather than on a grey "set once the quote is saved" box, which is what it
// used to be (the unfinished gate in DocumentBuilder, commit 9d38a77a5).
//
// The day plan and the waivers are the two pieces a save is genuinely needed
// for — see lib/proposal/panel.js — and in create mode they are replaced by
// one line saying so, not by disabled controls.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import WaiversCard from "@/app/components/waivers/WaiversCard";
import { readPresentationInput, resolveProposalSections, sanitisePresentation } from "@/lib/proposal/sections";

const SETTINGS_HREF = "/app/settings/presentation";

function Toggle({ on, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-40 ${on ? "bg-emerald-600" : "bg-muted-foreground/40"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function PresentationPanel({
  quoteId,
  editable = true,
  // ── Create mode (no quoteId) ──────────────────────────────────────────
  // `value` is Quote.presentation as the builder holds it — null until the
  // estimator touches something — and `onChange` receives the merged value.
  // `language` is what the builder is composing in, so the document titles
  // on the panel are the ones this quote will carry.
  value = null,
  onChange = null,
  language = null,
}) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const createMode = !quoteId;

  const load = useCallback(async () => {
    try {
      setData(
        await fetchJson(
          quoteId
            ? `/api/quotes/${quoteId}/presentation`
            : `/api/quotes/new/presentation${language ? `?language=${encodeURIComponent(language)}` : ""}`,
        ),
      );
    } catch (err) {
      setError(err.message);
    }
  }, [quoteId, language]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body, key) {
    // Create mode: the same body, merged into builder state instead of into
    // a row that does not exist. Through the SERVER's own reader, so the
    // screen cannot hold a value the save would refuse, and merged rather
    // than replaced so one switch does not reset the others.
    if (createMode) {
      const { error: invalid, value: merged } = readPresentationInput(body, value);
      if (invalid) {
        setError(invalid);
        return;
      }
      setError("");
      onChange?.(merged);
      return;
    }
    setBusy(key);
    setError("");
    try {
      setData(await fetchJson(`/api/quotes/${quoteId}/presentation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <div className="h-24 bg-accent rounded-xl animate-pulse" aria-busy="true" />;

  const countFor = (key) =>
    key === "beforeAfter"
      ? t("app.proposal.count.pairs", "{n} pairs from your gallery", { n: data.counts.beforeAfter })
      : key === "documents"
        ? t("app.proposal.count.documents", "{n} documents", { n: data.counts.documents })
        : key === "testimonials"
          ? t("app.proposal.count.reviews", "{n} reviews marked “show”", { n: data.counts.testimonials })
          : key === "services"
            ? t("app.proposal.count.services", "{n} services", { n: data.counts.services })
            : "";

  // ── Create mode resolves the three-state here ─────────────────────────
  //
  // The overrides are still in builder state, so the server has never seen
  // them: it answered for the company's defaults alone. They are resolved
  // against those defaults by resolveProposalSections — the SAME function
  // the client page and the saved-quote route decide with, so the tab cannot
  // show one answer while the document the homeowner opens shows another.
  const held = createMode ? sanitisePresentation(value) : null;
  const resolved = createMode
    ? resolveProposalSections({
        company: { proposalSections: Object.fromEntries(data.sections.map((s) => [s.key, s.companyDefault])) },
        quote: { presentation: value },
        content: Object.fromEntries(data.sections.map((s) => [s.key, s.hasContent])),
      })
    : null;
  const sections = createMode
    ? data.sections.map((s) => ({ ...s, ...resolved[s.key], override: held.sections[s.key] }))
    : data.sections;
  const documents = createMode
    ? data.documents.map((d) => ({
        ...d,
        included: d.visibleToClients && (held.documentIds === null || held.documentIds.includes(d.id)),
      }))
    : data.documents;

  const includedIds = documents.filter((d) => d.included).map((d) => d.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("app.proposal.panelHint", "What the client sees when they open the link, in this order. Off here leaves the section out of this quote only; the company default lives in Settings.")}{" "}
        <Link href={SETTINGS_HREF} className="underline underline-offset-2 text-foreground">
          {t("app.presentation.title", "Client proposal")}
        </Link>
      </p>

      <div className="divide-y divide-border">
        <div className="flex items-start gap-3 py-2.5">
          <Toggle on disabled label={t("app.proposal.section.project", "Your project")} onChange={() => {}} />
          <div className="text-sm">
            <div className="font-medium text-foreground">{t("app.proposal.section.project", "Your project")}</div>
            <div className="text-xs text-muted-foreground">{t("app.proposal.alwaysOn", "The quote itself — always on.")}</div>
          </div>
        </div>

        {sections.map((s) => (
          <div key={s.key} className={`flex items-start gap-3 py-2.5 ${s.hasContent ? "" : "opacity-60"}`}>
            <Toggle
              on={s.on}
              disabled={!editable || busy === s.key}
              label={t(s.labelKey, s.key)}
              onChange={(on) => patch({ sections: { [s.key]: on } }, s.key)}
            />
            <div className="text-sm min-w-0 flex-1">
              <div className="font-medium text-foreground">
                {t(s.labelKey, s.key)}
                {s.inherited && (
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">{t("app.proposal.inherited", "company default")}</span>
                )}
                {!s.inherited && editable && (
                  <button
                    type="button"
                    onClick={() => patch({ sections: { [s.key]: null } }, s.key)}
                    className="ml-2 text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
                  >
                    {t("app.proposal.followDefault", "follow the default")}
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.hasContent ? (
                  countFor(s.key) || t("app.proposal.fromStory", "from your company story")
                ) : (
                  <>
                    {t("app.proposal.nothingBehind", "Nothing behind it yet — not shown.")}{" "}
                    <Link href={s.fillHref} className="underline underline-offset-2">
                      {t("app.proposal.addContent", "Add it")}
                    </Link>
                  </>
                )}
              </div>

              {s.key === "documents" && s.hasContent && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                  {documents
                    .filter((d) => d.visibleToClients)
                    .map((d) => (
                      <label key={d.id} className="flex items-center gap-1.5 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={d.included}
                          disabled={!editable || busy === "documentIds"}
                          onChange={(e) => {
                            const next = e.target.checked ? [...includedIds, d.id] : includedIds.filter((x) => x !== d.id);
                            // Every visible document ticked = back to "all", so a
                            // document added to the library later joins this quote too.
                            const visible = documents.filter((x) => x.visibleToClients).map((x) => x.id);
                            const all = visible.every((id) => next.includes(id));
                            patch({ documentIds: all ? null : next }, "documentIds");
                          }}
                          className="w-3.5 h-3.5 accent-current"
                        />
                        {d.title}
                      </label>
                    ))}
                  {documents.some((d) => d.expired) && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      {t("app.proposal.expiredHidden", "{n} expired — hidden", { n: documents.filter((d) => d.expired).length })}
                    </span>
                  )}
                </div>
              )}
            </div>
            {busy === s.key && <Loader2 size={14} className="animate-spin text-muted-foreground mt-1" />}
          </div>
        ))}
      </div>

      {/* ── The two pieces a saved quote is genuinely needed for ────────────
          The plan divides THIS quote's takeoff hours (server-derived from the
          saved scopeGroups), and a waiver signature carries a quoteId — so
          before the first save they are absent and said so in one line,
          rather than drawn as controls that could not work. */}
      {createMode ? (
        <p className="bg-muted border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground">
          {t("app.docBuilder.presentationAfterSave", "The day-by-day plan and the waivers to sign arrive once the quote is saved — the plan divides this quote's own takeoff hours, and a waiver attaches to a saved quote.")}
        </p>
      ) : (
      <>
      {/* ── The day plan's crew size ─────────────────────────────────────── */}
      <div className="rounded-lg border border-border px-3 py-2.5 text-sm">
        <div className="font-medium text-foreground">{t("app.proposal.plan.title", "How the work runs — day by day")}</div>
        {data.plan.totalHours > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{t("app.proposal.plan.hours", "{hours} h from the takeoff", { hours: data.plan.totalHours })}</span>
            <label className="flex items-center gap-1.5">
              {t("app.proposal.plan.crew", "Crew size")}
              <input
                type="number"
                min={1}
                max={20}
                defaultValue={data.plan.crewSizeOverride ?? data.plan.crewSize ?? ""}
                disabled={!editable || busy === "crewSize"}
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v !== (data.plan.crewSizeOverride ?? null)) patch({ crewSize: v }, "crewSize");
                }}
                className="w-16 px-2 py-1 rounded-md border border-border bg-card text-foreground"
              />
            </label>
            <span>
              {data.plan.days
                ? t("app.proposal.plan.days", "{n} day plan shown", { n: data.plan.days.length })
                : t("app.proposal.plan.noCrew", "No crew size — the plan is left out rather than guessed.")}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            {t("app.proposal.plan.noHours", "This quote has no takeoff hours, so no day plan is shown — nothing is invented.")}
          </p>
        )}
      </div>

      {/* ── Waivers ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border px-3 py-2.5">
        <div className="text-sm font-medium text-foreground mb-2">{t("app.waivers.title", "Waivers")}</div>
        <WaiversCard target={{ quoteId }} editable={editable} compact onChanged={load} />
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.waivers.blocksAccept", "While an attached waiver is unsigned, the client's Accept button stays disabled with the reason printed.")}
        </p>
      </div>
      </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
