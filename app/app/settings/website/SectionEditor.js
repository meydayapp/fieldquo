// app/app/settings/website/SectionEditor.js
//
// Per-section hand editing: headings, body copy, list items, images, and the
// layout variant for each block.
//
// Extracted from the old builder page rather than deleted. It is no longer the
// FIRST thing a company sees — the prompt is (Builder.js) — but a contractor who
// wants to reword one heading should not have to describe that to an AI, and
// nothing else in the product can edit a block. So it lives behind "Fine-tune".
"use client";

import { useState } from "react";
import { X, ImagePlus, Eye, EyeOff, Loader2 } from "lucide-react";
import { BLOCK_TYPES } from "@/app/data/siteBlocks";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

export function BlockEditor({ block, onChange, onToggle, onError }) {
  const { t } = useTranslation();
  const def = BLOCK_TYPES[block.type];
  if (!def) return null;

  const hidden = block.visible === false;

  return (
    <div
      className={`bg-card border border-border rounded-xl p-5 ${hidden ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-foreground">{def.label}</h2>
        {/* Required blocks can't be hidden: a page with no header or no way to
            contact anyone isn't a shorter site, it's a broken one. */}
        {!def.required && (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
            {hidden ? t("app.sectionEditor.show", "Show") : t("app.sectionEditor.hide", "Hide")}
          </button>
        )}
      </div>

      {!hidden && (
        <div className="space-y-3">
          {/* Layout choice. A closed set — every option here was designed and
              checked on a phone, so there is no combination that produces a
              broken page. */}
          {def.variants && (
            <div className="flex flex-wrap gap-1.5">
              {def.variants.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ variant: v })}
                  className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                    (block.content.variant || def.defaults.variant) === v
                      ? "border-foreground bg-inverted text-inverted-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`app.sectionEditor.variant.${v}`, VARIANT_LABELS[v] || v)}
                </button>
              ))}
            </div>
          )}

          {/* Says where the content actually comes from. The alternative — a
              block with a heading field and nothing else — reads as an editor
              that lost the rest of the form. */}
          {def.derived && (
            <p className="text-xs text-muted-foreground">
              {t(`app.sectionEditor.derived.${block.type}`, DERIVED_NOTES[block.type])}
            </p>
          )}

          {(def.editable || []).map((field) => {
            const long = field === "body" || field === "intro";
            return long ? (
              <textarea
                key={field}
                value={block.content[field] || ""}
                onChange={(e) => onChange({ [field]: e.target.value })}
                rows={field === "body" ? 6 : 2}
                placeholder={t(`app.sectionEditor.field.${field}`, labelFor(field))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />
            ) : (
              <input
                key={field}
                value={block.content[field] || ""}
                onChange={(e) => onChange({ [field]: e.target.value })}
                placeholder={t(`app.sectionEditor.field.${field}`, labelFor(field))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />
            );
          })}

          {def.image && (
            <ImageField
              value={block.content[def.image]}
              onChange={(url) => onChange({ [def.image]: url })}
              onError={onError}
            />
          )}

          {def.repeats === "images" && (
            <ImageList
              images={block.content.images || []}
              onChange={(images) => onChange({ images })}
              onError={onError}
            />
          )}

          {/* Repeated items. Driven by `def.repeats` rather than hardcoded to
              "items", so `steps` and `pairs` get an editor from the schema alone
              — the alternative was a third and fourth copy of this block, and
              the copy is the one that rots. Keys listed in `imagePair` get an
              uploader instead of a text input, because a before/after pair holds
              image URLs. */}
          {def.repeats && def.repeats !== "images" && (
            <RepeatEditor def={def} block={block} onChange={onChange} onError={onError} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Editor for a block's repeated list — items, steps, or before/after pairs.
 *
 * One component for all three because they differ only in which keys are text
 * and which are images, and that is already in the schema.
 */
export function RepeatEditor({ def, block, onChange, onError }) {
  const { t } = useTranslation();
  const key = def.repeats;
  const list = block.content[key] || [];
  const imageKeys = def.imagePair || [];
  const textKeys = (def.itemEditable || []).filter((k) => !imageKeys.includes(k));

  const write = (next) => onChange({ [key]: next });
  const patch = (i, k, v) => {
    const next = [...list];
    next[i] = { ...next[i], [k]: v };
    write(next);
  };

  const noun =
    block.type === "faq" ? "question" : block.type === "process" ? "step" : block.type === "beforeafter" ? "pair" : "item";

  return (
    <div className="space-y-2">
      {list.map((item, i) => (
        <div key={i} className="border border-border rounded-lg p-3 space-y-2 relative">
          {imageKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {imageKeys.map((k) => (
                <div key={k}>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">
                    {k}
                  </span>
                  <ImageField
                    value={item[k]}
                    onChange={(url) => patch(i, k, url)}
                    onError={onError}
                  />
                </div>
              ))}
            </div>
          )}
          {textKeys.map((k) => (
            <input
              key={k}
              value={item[k] || ""}
              onChange={(e) => patch(i, k, e.target.value)}
              placeholder={t(`app.sectionEditor.field.${k}`, labelFor(k))}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
            />
          ))}
          <button
            type="button"
            onClick={() => write(list.filter((_, j) => j !== i))}
            className="absolute top-2 right-2 text-muted-foreground hover:text-red-600"
            aria-label={t("app.action.remove", "Remove")}
          >
            <X size={13} />
          </button>
        </div>
      ))}

      {list.length === 0 && EMPTY_HINTS[block.type] && (
        <p className="text-xs text-muted-foreground">{t(`app.sectionEditor.emptyHint.${block.type}`, EMPTY_HINTS[block.type])}</p>
      )}

      <button
        type="button"
        onClick={() =>
          write([...list, Object.fromEntries((def.itemEditable || []).map((k) => [k, ""]))])
        }
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ImagePlus size={13} className="rotate-45" /> {t(`app.sectionEditor.add.${noun}`, `Add ${noun}`)}
      </button>
    </div>
  );
}

// What an empty list means, said out loud. An empty editor with no explanation
// reads as a form that failed to load.
const EMPTY_HINTS = {
  testimonials: "Approved testimonials appear here automatically — or add one below.",
  beforeafter:
    "Fills itself from job visits that have exactly two photos — a before and an after. Add a pair here to override it.",
  process: "Generated from your description. Add your own steps to override it.",
  faq: "Generated from your description. Add your own questions to override it.",
};

export function ImageField({ value, onChange, onError }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await fetchJson("/api/upload", { method: "POST", body: form });
      onChange(data.url);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-20 w-32 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-card border border-border rounded-full p-1 text-muted-foreground"
            aria-label={t("app.sectionEditor.removeImage", "Remove image")}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label className="h-20 w-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer text-muted-foreground">
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <ImagePlus size={18} />
              <span className="text-[11px] mt-1">{t("app.sectionEditor.addPhoto", "Add photo")}</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}

export function ImageList({ images, onChange, onError }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function upload(files) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files).slice(0, 12)) {
        const form = new FormData();
        form.append("file", file);
        const data = await fetchJson("/api/upload", {
          method: "POST",
          body: form,
        });
        uploaded.push(data.url);
      }
      onChange([...images, ...uploaded].slice(0, 24));
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((src, i) => (
        <div key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-20 w-20 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={() => onChange(images.filter((_, j) => j !== i))}
            className="absolute -top-2 -right-2 bg-card border border-border rounded-full p-1 text-muted-foreground"
            aria-label={t("app.sectionEditor.removePhoto", "Remove photo")}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <label className="h-20 w-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer text-muted-foreground">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </label>
    </div>
  );
}

export const VARIANT_LABELS = {
  // hero
  centered: "Centred",
  split: "Photo right",
  sidebyside: "Photo left",
  banner: "Photo + card",
  overlay: "Words on photo",
  minimal: "Type only",
  // services
  cards: "Cards",
  list: "List",
  numbered: "Numbered",
  tiles: "Filled tiles",
  alternating: "Alternating rows",
  // about
  simple: "Text only",
  withphoto: "With photo",
  quote: "Pull quote",
  // gallery
  grid: "Grid",
  masonry: "Masonry",
  strip: "Scrolling row",
  // testimonials
  single: "One, large",
};

const DERIVED_NOTES = {
  areas:
    "Built from your Work Areas in Settings → Work Areas, so adding a town updates the site with no regeneration.",
  quoteform:
    "The form itself is built from your enabled services — the same ones the quote builder uses. Nothing to set up here.",
  booking:
    "Shows real available times from your booking availability. Change them in Settings → Company.",
  hours:
    "Pulled from your opening hours in Settings → Company, so changing them there updates the site and your Google listing at once.",
};

export function labelFor(field) {
  return (
    {
      headline: "Headline",
      subhead: "One line under the headline",
      ctaLabel: "Button text",
      heading: "Section heading",
      intro: "Short intro",
      note: "Anything else — e.g. 24/7 for emergencies",
      body: "Write a few sentences about the business",
      name: "Service name",
      description: "What this involves",
      quote: "What they said",
      author: "Who said it",
      question: "Question",
      answer: "Answer",
      title: "Step name",
      caption: "What this job was",
      sub: "One line under the heading",
      buttonLabel: "Button text",
    }[field] || field
  );
}
