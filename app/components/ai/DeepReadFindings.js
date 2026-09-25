// app/components/ai/DeepReadFindings.js
//
// The trade evidence and the photo-vs-trade warning of ONE paid deep read,
// drawn the same way on the quote's panel (app/components/quotes/
// SuggestAddOns.js), the invoice's (app/components/invoices/
// InvoiceReviewPanel.js) and — the warning alone — the estimate-review queue.
//
// A NEW shared component rather than a third copy of new markup: the two
// panels' comment explains why their existing blocks were left where they
// are, and that reasoning is about not refactoring a working control. None of
// this existed before, so there was no working copy to protect and every
// reason not to write it twice.
//
// Internal only. None of this is on a client-facing surface, and nothing
// here writes anything: every quantity is labelled an estimate, and shown
// BESIDE the document's measured figure (check.measured, computed server-side
// by lib/ai/deepReadView.js), never in place of it.
"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { TRADE_CATALOG } from "@/lib/trades/catalog";

/** A trade's name in the reader's language: the row's translation, its label, the catalogue's label. */
export function tradeNameIn(tradeNames, key, language) {
  const n = tradeNames?.[key];
  const tr = n?.labelTranslations?.[language];
  return (typeof tr === "string" && tr.trim()) || n?.label || TRADE_CATALOG[key]?.label || key;
}

function joinList(items, language) {
  const list = items.filter(Boolean);
  try {
    return new Intl.ListFormat(language || "en", { style: "long", type: "conjunction" }).format(list);
  } catch {
    return list.join(", ");
  }
}

function numberIn(language) {
  const f = new Intl.NumberFormat(language || "en", { maximumFractionDigits: 1 });
  return (n) => f.format(n);
}

/** "3" or "3–4", in the reader's digits. */
function span(r, fmt) {
  if (!r) return "";
  return r.low === r.high ? fmt(r.low) : `${fmt(r.low)}–${fmt(r.high)}`;
}

/**
 * The warning. Rendered only for a real mismatch; "unclear" gets one quiet
 * line so an estimator knows the check ran and could not tell — ambiguous
 * photos never raise the amber box. Never blocks anything: there is no
 * button here and nothing reads this verdict to refuse an action.
 */
export function DeepReadMismatch({ mismatch, tradeNames, docKind = "quote" }) {
  const { t, language } = useTranslation();
  if (!mismatch) return null;
  const name = (k) => tradeNameIn(tradeNames, k, language);

  if (mismatch.verdict === "unclear") {
    return (
      <p className="text-[11px] text-muted-foreground mt-1.5" data-deep-read-mismatch="unclear">
        {t("app.deepRead.mismatch.unclear")}
      </p>
    );
  }
  if (mismatch.verdict !== "mismatch" || !mismatch.photos?.length) return null;

  return (
    <div
      role="status"
      data-deep-read-mismatch="mismatch"
      className="mt-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3"
    >
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
        <AlertTriangle size={13} className="shrink-0" />
        {t("app.deepRead.mismatch.title")}
      </p>
      <ul className="mt-1.5 space-y-1">
        {mismatch.photos.map((p) => (
          <li key={p.photo} className="text-xs text-amber-900 dark:text-amber-200">
            {t("app.deepRead.mismatch.photo", { n: p.photo, trades: joinList(p.trades.map(name), language) })}
            {p.shows ? <span className="text-amber-900/80 dark:text-amber-200/80"> — “{p.shows}”</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-amber-900 dark:text-amber-200">
        {t(docKind === "invoice" ? "app.deepRead.mismatch.invoiceIs" : "app.deepRead.mismatch.quoteIs", {
          trades: joinList(mismatch.quoteTrades.map(name), language),
        })}{" "}
        {t("app.deepRead.mismatch.hint")}
      </p>
    </div>
  );
}

function EstimateBadge() {
  const { t } = useTranslation();
  return (
    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-full border border-border px-1.5 py-px text-muted-foreground">
      {t("app.deepRead.estimate")}
    </span>
  );
}

/** One family's rows: [fieldKey, value, { estimate, basis }]. Unclear and absent are skipped — not padded. */
function familyRows(family, ev, t, fmt) {
  const rows = [];
  const add = (field, value, extra = {}) => {
    if (value == null || value === "" || value === "unclear") return;
    rows.push({ field, value, ...extra });
  };
  const enumV = (group, v) => (v && v !== "unclear" ? t(`app.deepRead.v.${group}.${v}`) : null);
  const enumL = (group, vs) => (Array.isArray(vs) && vs.length ? vs.map((v) => t(`app.deepRead.v.${group}.${v}`)).join(" · ") : null);
  const seen = (n) => (Number.isInteger(n) ? t("app.deepRead.v.seen", { value: fmt(n) }) : null);

  switch (family) {
    case "junk":
      if (ev.volume) {
        add(
          "volume",
          [
            t("app.deepRead.v.cuYd", { value: span(ev.volume.cubicYards, fmt) }),
            t("app.deepRead.v.m3", { value: span(ev.volume.cubicMetres, fmt) }),
            t("app.deepRead.v.beds", { value: span(ev.volume.pickupBeds, fmt) }),
          ].join(" · "),
          { estimate: true, basis: ev.volume.basis },
        );
      }
      add("items", enumL("junk", ev.items));
      add("fees", enumL("fee", ev.surcharges));
      break;
    case "roofing":
      add("pitch", enumV("pitch", ev.pitch), { estimate: true, basis: ev.pitchBasis });
      add("layers", enumV("layers", ev.layers), { estimate: true, basis: ev.layersBasis });
      add("damage", enumL("roofDamage", ev.damage));
      break;
    case "painting":
      add("condition", enumV("condition", ev.condition));
      add("peeling", enumV("peeling", ev.peeling));
      add("currentColour", ev.currentColour);
      add("colourChange", enumV("colour", ev.colourChange));
      break;
    case "cabinets":
      add("doors", seen(ev.doorsSeen), { estimate: true });
      add("drawers", seen(ev.drawersSeen), { estimate: true, basis: ev.countBasis });
      add("doorStyle", enumV("doorStyle", ev.doorStyle));
      add("finish", enumV("finish", ev.finish));
      add("condition", enumV("condition", ev.condition));
      break;
    case "flooring":
      add("material", enumV("floor", ev.currentMaterial));
      add("transitions", seen(ev.transitionsSeen), { estimate: true, basis: ev.transitionsBasis });
      add("condition", enumV("condition", ev.condition));
      break;
    case "stairs":
      add("treads", seen(ev.treadsSeen), { estimate: true });
      add("risers", seen(ev.risersSeen), { estimate: true, basis: ev.countBasis });
      add("shape", enumV("shape", ev.shape));
      break;
    case "gutters":
      if (ev.length) {
        add(
          "length",
          `${t("app.deepRead.v.ft", { value: span(ev.length.feet, fmt) })} · ${t("app.deepRead.v.m", { value: span(ev.length.metres, fmt) })}`,
          { estimate: true, basis: ev.length.basis },
        );
      }
      add("downspouts", seen(ev.downspoutsSeen), { estimate: true });
      add("storeys", enumV("storeys", ev.storeys));
      add("issues", enumL("gutter", ev.issues));
      break;
    default:
      break;
  }
  return rows;
}

/** A measured-beside row's two halves, in words. */
function measuredWords(row, t, fmt) {
  const m = row.measured?.value;
  const e = row.estimate || {};
  if (row.field === "pitch") {
    return { measured: t("app.deepRead.v.rise", { value: fmt(m) }), estimate: t(`app.deepRead.v.pitch.${e.band}`) };
  }
  if (row.field === "layers") {
    return { measured: fmt(m), estimate: t(`app.deepRead.v.layers.${e.band}`) };
  }
  if (row.field === "length") {
    return { measured: t("app.deepRead.v.ft", { value: fmt(m) }), estimate: t("app.deepRead.v.ft", { value: span(e, fmt) }) };
  }
  return { measured: fmt(m), estimate: t("app.deepRead.v.seen", { value: fmt(e.low) }) };
}

/**
 * Everything one pass found beyond its notes: the mismatch warning, then each
 * trade family's evidence with the measured figures beside it. Renders
 * nothing for a pass from before evidence existed.
 */
export default function DeepReadFindings({ pass, tradeNames, docKind = "quote" }) {
  const { t, language } = useTranslation();
  const fmt = numberIn(language);
  const evidence = pass?.evidence && typeof pass.evidence === "object" ? pass.evidence : {};
  const families = Object.keys(evidence);
  const measured = Array.isArray(pass?.check?.measured) ? pass.check.measured : [];

  return (
    <>
      <DeepReadMismatch mismatch={pass?.check?.mismatch} tradeNames={tradeNames} docKind={docKind} />
      {families.map((family) => {
        const ev = evidence[family] || {};
        const rows = familyRows(family, ev, t, fmt);
        const beside = measured.filter((r) => r.family === family);
        return (
          <div key={family} className="mt-2.5" data-deep-read-evidence={family}>
            <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
              {t("app.deepRead.evidence.title", { trade: t(`app.deepRead.family.${family}`) })}
              {ev.confidence && (
                <span className="font-normal text-muted-foreground">· {t(`app.deepRead.confidence.${ev.confidence}`)}</span>
              )}
            </p>
            {rows.length ? (
              <dl className="mt-1 space-y-1">
                {rows.map((r) => (
                  <div key={r.field} className="text-xs leading-relaxed">
                    <dt className="inline text-muted-foreground">{t(`app.deepRead.f.${r.field}`)}: </dt>
                    <dd className="inline text-foreground">
                      {r.value}
                      {r.estimate && <EstimateBadge />}
                    </dd>
                    {r.basis && (
                      <p className="text-[11px] text-muted-foreground">{t("app.deepRead.basis", { basis: r.basis })}</p>
                    )}
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">{t("app.deepRead.evidence.nothing")}</p>
            )}
            {beside.map((row) => {
              const w = measuredWords(row, t, fmt);
              return (
                <p
                  key={`m-${row.field}`}
                  className="text-xs mt-1 text-foreground"
                  data-deep-read-measured={row.field}
                  data-differs={row.differs ? "true" : "false"}
                >
                  <span className="text-muted-foreground">{t(`app.deepRead.f.${row.field}`)}: </span>
                  {t("app.deepRead.measured.row", { measured: w.measured, estimate: w.estimate })}
                  {row.differs && (
                    <span className="ml-1 text-amber-700 dark:text-amber-300 font-medium">{t("app.deepRead.measured.differs")}</span>
                  )}
                </p>
              );
            })}
          </div>
        );
      })}
      {families.length > 0 && (
        <p className="text-[11px] text-muted-foreground/70 mt-2">{t("app.deepRead.evidenceNote")}</p>
      )}
    </>
  );
}
