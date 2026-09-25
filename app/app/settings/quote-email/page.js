// app/app/settings/quote-email/page.js
//
// The two optional sections of the quote email, at company level.
//
// ── What is NOT on this page, and why ──────────────────────────────────────
//
// The rest of the quote email — the scope breakdown, what's included, the
// process steps and their timelines, what could change the price — is not
// configurable here and has no switch. It is derived from the quote and from
// lib/documents/serviceContent.js, which a company edits per trade under
// Settings → Services. A second place to turn those on and off would be two
// controls over one behaviour, and one of them would end up lying.
//
// So this page says plainly what the email always carries, and then edits the
// two things that are genuinely optional because they are the company's own
// proof rather than the quote's content.
//
// ── The warning about an empty section is the same rule the server holds ───
//
// Switching a section on with nothing in it will stop every send. Saying so
// here, at the moment someone flips the switch, is what makes that gate feel
// like a rule rather than an ambush. It is not the enforcement — see
// lib/quotes/emailSections.js.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
// The same formatter the number-release confirmation uses, so a phone number
// looks the same everywhere in the app rather than in whichever shape the
// person happened to type it.
import { formatNanpInput } from "@/lib/validation";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";
import { PhotoSlot, Field, NewPair } from "@/app/components/settings/PairPhotoFields";

const CAPABILITY = "user:manage";

// `id` is not decoration: the send gate's "add content" action links to
// /app/settings/quote-email#references, and an anchor that scrolls nowhere is
// a small version of the same dishonesty as a dead button.
function Card({ id, title, description, children }) {
  return (
    <div id={id} className="bg-card border border-border rounded-xl p-5 space-y-4 scroll-mt-6">
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function IncludeToggle({ on, disabled, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-border accent-current"
      />
      {label}
    </label>
  );
}

export default function QuoteEmailSettingsPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canEdit = access.canChange(CAPABILITY);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Separate from `error`, which is a SAVE failure and belongs in the banner
  // above a form that must stay on screen. A LOAD failure means there is no
  // form to show — see the guard below the loading skeleton.
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetchJson("/api/settings/quote-email")
      .then(setData)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(patch) {
    setError("");
    setSaving(true);
    setSaved(false);
    try {
      // The response is what was actually STORED, and the page re-renders from
      // it. A row the sanitiser dropped must not sit on screen looking saved —
      // that is the same two-sources-of-truth gap the send gate exists for,
      // one screen earlier.
      setData(
        await fetchJson("/api/settings/quote-email", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }),
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (err) {
      setError(err.message);
      // False, not a throw: NewPair keeps its stored draft when the pair it
      // completed did not land, so the photo is there to retry from.
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-accent rounded" />
          <div className="h-40 bg-accent rounded-xl" />
          <div className="h-40 bg-accent rounded-xl" />
        </div>
      </div>
    );
  }

  // ── A failed load must not render an editable, empty version of this ──────
  //
  // `if (loading)` above was the only guard. When fetchJson rejects, `data`
  // stays null, `loading` goes false, and both cards used to render fully live
  // off these fallbacks — toggles unchecked, lists empty, Add enabled.
  //
  // That is not merely a wrong picture, it is a delete. AddRow sends
  // `[...references.items, row]`, which after a failed load is `[...[], row]`,
  // and the PATCH replaces the stored array
  // (route.js: `data[meta.companyItemsField] = sanitise(...)`). An admin who
  // opens this screen during a Neon cold start, sees "no references", and adds
  // one has just destroyed the other five. Quieter and just as wrong: the
  // toggle renders OFF for a company whose references are on, so they believe
  // it and the emails keep going out with them.
  //
  // The error banner already existed; what was missing was refusing to render
  // the form. products/page.js one folder over does exactly this and says why.
  if (loadError || !data) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError || t("app.load.generic")}
        </div>
      </div>
    );
  }

  // `max` comes off the response rather than being re-guessed here. The old
  // literals 6 and 4 duplicated lib/quotes/emailSections.js, so raising the cap
  // there would have left the Add button capping at the stale number.
  const references = data.references;
  const beforeAfter = data.beforeAfter;

  const refsEmptyOn = references.include && references.items.length === 0;
  const pairsEmptyOn = beforeAfter.include && beforeAfter.items.length === 0;

  function setReferences(items) {
    save({ references: { items } });
  }
  function setPairs(items) {
    return save({ beforeAfter: { items } });
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.quoteEmail")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setQuoteEmail.subtitle")}
        </p>
        {/* The page the client lands on has its own content — story, gallery,
            documents, reviews — set up once under Settings › Presentation. */}
        <p className="text-sm text-muted-foreground mt-2">
          {t("app.setQuoteEmail.proposalNote", "What the client sees on the quote page itself — your story, gallery, documents and reviews — is set up under")}{" "}
          <Link href="/app/settings/presentation" className="underline underline-offset-2 text-foreground">
            {t("app.presentation.title", "Client proposal")}
          </Link>
        </p>
      </div>

      {!canEdit && (
        <ReadOnlyNotice
          capability={CAPABILITY}
          what={t("app.setQuoteEmail.readOnlyWhat")}
        />
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-300 text-sm rounded-lg px-4 py-3">
          {t("app.setQuoteEmail.saved")}
        </div>
      )}

      {/* What is not negotiable, stated rather than implied by its absence. */}
      <Card
        title={t("app.setQuoteEmail.alwaysTitle")}
        description={t("app.setQuoteEmail.alwaysBody")}
      >
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
          <li>{t("app.setQuoteEmail.alwaysScope")}</li>
          <li>{t("app.setQuoteEmail.alwaysIncluded")}</li>
          <li>{t("app.setQuoteEmail.alwaysSteps")}</li>
          <li>{t("app.setQuoteEmail.alwaysMayChange")}</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          {t("app.setQuoteEmail.alwaysWhere")}{" "}
          <Link href="/app/settings/services" className="underline font-medium">
            {t("app.settings.services")}
          </Link>
          .
        </p>
      </Card>

      {/* ── References ─────────────────────────────────────────────────── */}
      <Card
        id="references"
        title={t("app.quoteEmail.references")}
        description={t("app.setQuoteEmail.referencesHint")}
      >
        <IncludeToggle
          on={references.include}
          disabled={!canEdit || saving}
          onChange={(include) => save({ references: { include } })}
          label={t("app.setQuoteEmail.includeByDefault")}
        />

        {refsEmptyOn && <EmptyWarning t={t} />}

        <div className="space-y-2">
          {references.items.map((r, i) => (
            <div
              key={r.id}
              className="flex items-start gap-2 border border-border rounded-lg p-2.5"
            >
              <div className="flex-1 grid sm:grid-cols-2 gap-2">
                <Field
                  value={r.name}
                  disabled={!canEdit || saving}
                  placeholder={t("app.setQuoteEmail.name")}
                  onCommit={(name) =>
                    setReferences(
                      references.items.map((x, j) =>
                        j === i ? { ...x, name } : x,
                      ),
                    )
                  }
                />
                <Field
                  value={r.phone}
                  disabled={!canEdit || saving}
                  // A reference's number is read off this screen and dialled by
                  // a person; an unpunctuated string of ten digits is the one
                  // shape nobody can read back over the phone.
                  format={formatNanpInput}
                  placeholder={t("app.setQuoteEmail.phone")}
                  onCommit={(phone) =>
                    setReferences(
                      references.items.map((x, j) =>
                        j === i ? { ...x, phone } : x,
                      ),
                    )
                  }
                />
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    setReferences(references.items.filter((_, j) => j !== i))
                  }
                  disabled={saving}
                  aria-label={t("app.setQuoteEmail.remove")}
                  className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && references.items.length < references.max && (
          <AddRow
            label={t("app.setQuoteEmail.addReference")}
            disabled={saving}
            onAdd={(name, phone) =>
              setReferences([...references.items, { name, phone }])
            }
            t={t}
          />
        )}

        <p className="text-xs text-muted-foreground">
          {t("app.setQuoteEmail.consent")}
        </p>
      </Card>

      {/* ── Before & after ─────────────────────────────────────────────── */}
      <Card
        id="before-after"
        title={t("app.quoteEmail.beforeAfter")}
        description={`${t("app.setQuoteEmail.beforeAfterHint")} ${t("app.setQuoteEmail.galleryShared", "These pairs are your company gallery — the same ones on your website and your client proposals; the email prints the first {max}.", { max: beforeAfter.max })}`}
      >
        <IncludeToggle
          on={beforeAfter.include}
          disabled={!canEdit || saving}
          onChange={(include) => save({ beforeAfter: { include } })}
          label={t("app.setQuoteEmail.includeByDefault")}
        />

        {pairsEmptyOn && <EmptyWarning t={t} />}

        <div className="space-y-3">
          {beforeAfter.items.map((p, i) => (
            <div key={p.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex gap-3">
                <PhotoSlot
                  url={p.beforeUrl}
                  label={t("app.setQuoteEmail.before")}
                  disabled={!canEdit || saving}
                  onError={setError}
                  onUploaded={({ url, publicId }) =>
                    setPairs(
                      beforeAfter.items.map((x, j) =>
                        j === i
                          ? { ...x, beforeUrl: url, beforePublicId: publicId }
                          : x,
                      ),
                    )
                  }
                />
                <PhotoSlot
                  url={p.afterUrl}
                  label={t("app.setQuoteEmail.after")}
                  disabled={!canEdit || saving}
                  onError={setError}
                  onUploaded={({ url, publicId }) =>
                    setPairs(
                      beforeAfter.items.map((x, j) =>
                        j === i
                          ? { ...x, afterUrl: url, afterPublicId: publicId }
                          : x,
                      ),
                    )
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Field
                  value={p.caption || ""}
                  disabled={!canEdit || saving}
                  placeholder={t("app.setQuoteEmail.caption")}
                  onCommit={(caption) =>
                    setPairs(
                      beforeAfter.items.map((x, j) =>
                        j === i ? { ...x, caption } : x,
                      ),
                    )
                  }
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      setPairs(beforeAfter.items.filter((_, j) => j !== i))
                    }
                    disabled={saving}
                    aria-label={t("app.setQuoteEmail.remove")}
                    className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50 min-h-11 min-w-11 flex items-center justify-center shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* A pair is only stored once BOTH photos exist — half a before-and-
            after is the same picture twice under two labels. Until then the
            new-pair slot is the company's stored gallery DRAFT (kept apart
            from the pairs any client sees), which can be finished later or
            discarded; see NewPair. No initialDraft is passed: this page's
            own load does not carry the draft, so NewPair reads it from
            /api/settings/gallery itself. */}
        {/* No cap on adding: since 2026-09-21 these pairs are the company's
            ONE gallery (lib/company/gallery.js), shared with the website and
            the client proposal. The email prints the first `max`; the note
            under the card says so. */}
        {canEdit && (
          <NewPair
            disabled={saving}
            onError={setError}
            onComplete={(pair) => setPairs([...beforeAfter.items, pair])}
            t={t}
          />
        )}
      </Card>

      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          {t("app.setQuoteEmail.saving")}
        </div>
      )}
    </div>
  );
}

function EmptyWarning({ t }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <span>{t("app.setQuoteEmail.emptyWarning")}</span>
    </div>
  );
}

/**
 * A text input that saves on blur rather than on every keystroke.
 *
 * Saving per keystroke would round-trip through the sanitiser mid-word and
 * delete a half-typed row out from under the person typing it.
 */
function AddRow({ label, disabled, onAdd, t }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const ready = name.trim() && phone.trim();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={name}
        disabled={disabled}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("app.setQuoteEmail.name")}
        className="flex-1 min-w-[8rem] px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
      />
      <input
        type="tel"
        value={phone}
        disabled={disabled}
        inputMode="tel"
        onChange={(e) => setPhone(formatNanpInput(e.target.value))}
        placeholder={t("app.setQuoteEmail.phone")}
        className="flex-1 min-w-[8rem] px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
      />
      <button
        type="button"
        // Disabled until both halves exist, because a reference with only one
        // is dropped server-side — a button that accepts the click and then
        // silently discards the row is the dead control this codebase forbids.
        disabled={disabled || !ready}
        onClick={() => {
          onAdd(name.trim(), phone.trim());
          setName("");
          setPhone("");
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-inverted text-inverted-foreground font-medium disabled:opacity-50"
      >
        <Plus size={14} />
        {label}
      </button>
    </div>
  );
}
