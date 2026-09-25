// app/components/checklists/ChecklistItemControl.js
//
// The answer control for ONE typed checklist item — text, number, pick one,
// pick any, good/watch/problem, photo, signature — used by both the visit
// checklist and the job-level form, so a stop-light means the same thing
// wherever a crew meets it.
//
// A plain tick item is not drawn here: the visit screen's own tick row has
// always drawn those and keeps doing so (additive — see VisitChecklist.js).
//
// ── Answers set `done` ─────────────────────────────────────────────────────
//
// Every change goes through answerItem() (lib/checklists/typedItems.js), which
// recomputes `done` from the answer. The "3/8 checklist items" counts on the
// job page read `done`, so they move when a crew fills a field, not only when
// they tick a box.
//
// ── readOnly ───────────────────────────────────────────────────────────────
//
// The office view of the same form: the answer as text, the photo as a
// thumbnail, the signature as the image — and "No answer yet" for an empty
// one, never a blank that could be read as "nothing to report".
"use client";

import { useState } from "react";
import { Eraser } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import MediaUploader from "@/app/components/MediaUploader";
import SignaturePad from "@/app/components/SignaturePad";
import { answerItem, localizeItem, optionLabel, STOPLIGHT_VALUES } from "@/lib/checklists/typedItems";

/// The responseTypes this control answers. Anything else is a tick.
export const TYPED_RESPONSES = [
  "text",
  "numeric",
  "single_select",
  "multi_select",
  "stoplight",
  "photo",
  "signature",
];

const STOP_CLASSES = {
  green: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300",
  amber: "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300",
  red: "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300",
};
const STOP_DOT = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };

const chipBase =
  "inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border text-sm font-medium disabled:opacity-60";
const chipOff = "border-border text-foreground bg-card hover:bg-muted";
const chipOn = "border-inverted bg-inverted text-inverted-foreground";
const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

export default function ChecklistItemControl({ item, onAnswer, disabled = false, readOnly = false }) {
  const { t, language } = useTranslation();
  const set = (patch) => onAnswer(answerItem(item, patch));

  if (readOnly) return <ReadOnlyAnswer item={item} />;

  switch (item.responseType) {
    case "text":
      return <TextAnswer item={item} disabled={disabled} onCommit={(v) => set({ response: v })} />;
    case "numeric":
      return <NumberAnswer item={item} disabled={disabled} onCommit={(v) => set({ response: v })} />;
    case "single_select":
    case "multi_select": {
      const multi = item.responseType === "multi_select";
      const picked = multi ? (Array.isArray(item.response) ? item.response : []) : item.response;
      // Shown in the viewer's language, stored as the row's own option — see
      // localizeItem for why the answer never depends on who gave it.
      const shown = localizeItem(item, language).options;
      return (
        <div className="flex flex-wrap gap-1.5">
          {(item.options || []).map((opt, i) => {
            const on = multi ? picked.includes(opt) : picked === opt;
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() =>
                  set({
                    response: multi
                      ? on
                        ? picked.filter((p) => p !== opt)
                        : [...picked, opt]
                      : on
                        ? ""
                        : opt,
                  })
                }
                className={`${chipBase} ${on ? chipOn : chipOff}`}
              >
                {shown[i] ?? opt}
              </button>
            );
          })}
        </div>
      );
    }
    case "stoplight":
      return (
        <div className="flex flex-wrap gap-1.5">
          {STOPLIGHT_VALUES.map((v) => {
            const on = item.response === v;
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => set({ response: on ? "" : v })}
                className={`${chipBase} ${on ? STOP_CLASSES[v] : chipOff}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${STOP_DOT[v]}`} aria-hidden="true" />
                {t(`app.checklists.stoplight.${v}`)}
              </button>
            );
          })}
        </div>
      );
    case "photo": {
      const photos = (item.media || []).filter((m) => m.kind === "photo");
      return (
        <MediaUploader
          uploadUrl="/api/upload" purpose="jobs"
          value={photos}
          max={6}
          label={t("app.checklists.addPhoto")}
          hint=""
          onChange={(next) =>
            set({
              media: [
                ...(item.media || []).filter((m) => m.kind !== "photo"),
                ...(next || [])
                  .filter((m) => m?.url && m.kind === "photo")
                  .map((m) => ({ url: m.url, kind: "photo", caption: null })),
              ],
            })
          }
        />
      );
    }
    case "signature":
      return <SignatureAnswer item={item} disabled={disabled} onCommit={(response) => set({ response })} />;
    default:
      return null;
  }
}

function TextAnswer({ item, disabled, onCommit }) {
  const [value, setValue] = useState(item.response ?? "");
  return (
    <textarea
      rows={2}
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== (item.response ?? "") && onCommit(value.trim())}
      className={inputClass}
    />
  );
}

function NumberAnswer({ item, disabled, onCommit }) {
  const [value, setValue] = useState(item.response ?? "");
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const num = value === "" ? "" : Number(value);
        if (num !== "" && !Number.isFinite(num)) return;
        if (num !== (item.response ?? "")) onCommit(num);
      }}
      className={`${inputClass} max-w-[12rem] tabular-nums`}
    />
  );
}

function SignatureAnswer({ item, disabled, onCommit }) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState("");
  const [name, setName] = useState("");
  const signed = item.response && typeof item.response === "object" && item.response.dataUrl;

  if (signed) {
    return (
      <div className="space-y-1.5">
        <SignatureImage response={item.response} />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCommit("")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <Eraser size={12} /> {t("app.checklists.clearSignature")}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <SignaturePad onChange={setDataUrl} height={120} />
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("app.checklists.signName")}
        className={inputClass}
      />
      <button
        type="button"
        disabled={disabled || !dataUrl}
        onClick={() => onCommit({ dataUrl, name: name.trim() || null, signedAt: new Date().toISOString() })}
        className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 min-h-[40px] rounded-lg disabled:opacity-50"
      >
        {t("app.checklists.sign")}
      </button>
    </div>
  );
}

function SignatureImage({ response }) {
  const { t } = useTranslation();
  return (
    <div>
      {/* A data URL from the pad, never a remote address — nothing to proxy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={response.dataUrl} alt={t("app.checklists.type.signature")} className="h-20 bg-white border border-border rounded" />
      <p className="text-xs text-muted-foreground mt-1">
        {response.name ? t("app.checklists.signedBy", { name: response.name }) : null}
        {response.name && response.signedAt ? " · " : null}
        {response.signedAt ? new Date(response.signedAt).toLocaleString() : null}
      </p>
    </div>
  );
}

function ReadOnlyAnswer({ item }) {
  const { t, language } = useTranslation();
  const r = item.response;
  const empty = <span className="text-xs italic text-muted-foreground">{t("app.checklists.noAnswer")}</span>;

  switch (item.responseType) {
    case "stoplight":
      return STOPLIGHT_VALUES.includes(r) ? (
        <span className={`${chipBase} ${STOP_CLASSES[r]}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${STOP_DOT[r]}`} aria-hidden="true" />
          {t(`app.checklists.stoplight.${r}`)}
        </span>
      ) : empty;
    case "multi_select":
      return Array.isArray(r) && r.length ? (
        <span className="text-sm text-foreground">{r.map((v) => optionLabel(item, v, language)).join(", ")}</span>
      ) : empty;
    case "single_select":
      return r ? <span className="text-sm text-foreground">{optionLabel(item, r, language)}</span> : empty;
    case "photo": {
      const photos = (item.media || []).filter((m) => m.kind === "photo");
      return photos.length ? (
        <div className="flex flex-wrap gap-1.5">
          {photos.map((m) => (
            <a key={m.url} href={m.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="h-16 w-16 object-cover rounded border border-border" />
            </a>
          ))}
        </div>
      ) : empty;
    }
    case "signature":
      return r && typeof r === "object" && r.dataUrl ? <SignatureImage response={r} /> : empty;
    default:
      return r !== undefined && r !== null && r !== "" ? (
        <span className="text-sm text-foreground whitespace-pre-wrap">{String(r)}</span>
      ) : empty;
  }
}
