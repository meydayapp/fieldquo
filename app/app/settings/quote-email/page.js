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

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
// The same formatter the number-release confirmation uses, so a phone number
// looks the same everywhere in the app rather than in whichever shape the
// person happened to type it.
import { formatNanpInput } from "@/lib/validation";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";

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

/** One "before" or "after" slot. Uploads through the shared /api/upload route. */
function PhotoSlot({ url, label, disabled, onUploaded, onError }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    // Cleared so choosing the SAME file twice still fires a change event —
    // otherwise a failed upload can't be retried without picking a different
    // photo, which reads as the button being broken.
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await fetchJson("/api/upload", { method: "POST", body: form });
      onUploaded({ url: data.url, publicId: data.publicId || "" });
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="w-full aspect-[4/3] rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Upload size={13} />
            {t("app.setQuoteEmail.addPhoto")}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
      />
    </div>
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

  useEffect(() => {
    fetchJson("/api/settings/quote-email")
      .then(setData)
      .catch((err) => setError(err.message))
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
    } catch (err) {
      setError(err.message);
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

  const references = data?.references || { include: false, items: [], max: 6 };
  const beforeAfter = data?.beforeAfter || { include: false, items: [], max: 4 };

  const refsEmptyOn = references.include && references.items.length === 0;
  const pairsEmptyOn = beforeAfter.include && beforeAfter.items.length === 0;

  function setReferences(items) {
    save({ references: { items } });
  }
  function setPairs(items) {
    save({ beforeAfter: { items } });
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
        description={t("app.setQuoteEmail.beforeAfterHint")}
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
                    className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* A pair is only stored once BOTH photos exist — half a before-and-
            after is the same picture twice under two labels. So the new-pair
            slot is a draft held in the browser and only saved when complete;
            see NewPair. */}
        {canEdit && beforeAfter.items.length < beforeAfter.max && (
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
// `format` is opt-in rather than sniffed from the placeholder: this Field also
// holds a person's NAME, and running a phone formatter over "O'Brien" would
// quietly delete it.
function Field({ value, placeholder, disabled, onCommit, format }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <input
      type={format ? "tel" : "text"}
      inputMode={format ? "tel" : undefined}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(format ? format(e.target.value) : e.target.value)}
      onBlur={() => {
        if (draft !== (value ?? "")) onCommit(draft);
      }}
      className="w-full px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground disabled:opacity-60"
    />
  );
}

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

function NewPair({ disabled, onComplete, onError, t }) {
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);

  useEffect(() => {
    if (!before || !after) return;
    onComplete({
      beforeUrl: before.url,
      beforePublicId: before.publicId,
      afterUrl: after.url,
      afterPublicId: after.publicId,
    });
    setBefore(null);
    setAfter(null);
  }, [before, after, onComplete]);

  return (
    <div className="border border-dashed border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-2">
        {t("app.setQuoteEmail.addPair")}
      </div>
      <div className="flex gap-3">
        <PhotoSlot
          url={before?.url}
          label={t("app.setQuoteEmail.before")}
          disabled={disabled}
          onError={onError}
          onUploaded={setBefore}
        />
        <PhotoSlot
          url={after?.url}
          label={t("app.setQuoteEmail.after")}
          disabled={disabled}
          onError={onError}
          onUploaded={setAfter}
        />
      </div>
    </div>
  );
}
