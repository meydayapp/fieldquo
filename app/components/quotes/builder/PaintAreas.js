// app/components/quotes/builder/PaintAreas.js
//
// The painting takeoff: areas, and substrates inside them.
//
// ── Why this is its own file ───────────────────────────────────────────────
//
// TradeTakeoff.js is ~2,900 lines of fourteen trades. This one form is bigger
// than most of them, and it is the only takeoff whose numbers were recovered
// from a completed job — every figure on this screen is asserted to the cent in
// scripts/check-paint-takeoff.mjs. Keeping it separate keeps that relationship
// findable, and PaverDesigner.js already set the precedent for a takeoff that
// outgrew the shared file.
//
// ── Everything on this screen is STAFF-ONLY ────────────────────────────────
//
// Production rates, hourly sell rate, gallons, paint cost per gallon, the rate
// formula. Non-negotiable #4 is that public endpoints never return prices, and
// a production rate plus an hourly rate is the contractor's entire pricing
// model in one line. Nothing here is reachable from /quote, /q or a PDF: the
// client-facing renderers read `description` and `amount` off the line items
// and the public route deliberately never returns `takeoff` at all.
//
// The arithmetic lives in lib/pricing/paintTakeoff.js and is called, not
// reimplemented — a second copy on the screen is how a form ends up disagreeing
// with the quote it is writing.
"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  paintTakeoff,
  paintFormula,
  areaGeometry,
  newPaintArea,
  newPaintSubstrate,
  PAINT_QUANTITY_DRIVERS,
  PAINT_MEASUREMENT_STYLES,
} from "@/lib/pricing/paintTakeoff";
import { Field, Num, inputClass, money, asList } from "./fields";

const own = (map, key) =>
  map && key && Object.prototype.hasOwnProperty.call(map, key)
    ? map[key]
    : undefined;

const hoursText = (h) => `${h} h`;

/* ── One substrate row ─────────────────────────────────────────────────── */

function SubstrateRow({ row, priced, book, t, onChange, onRemove }) {
  const def = own(book?.substrates, row?.key);
  if (!def) return null;
  const set = (patch) => onChange({ ...row, ...patch });

  // Derived quantity vs typed. A null quantity means "read it off the room",
  // which is the whole point of measuring the room once.
  const derived = row.quantity === null || row.quantity === undefined;
  const driver = row.driver ?? def.driver;
  const driverLabel = own(PAINT_QUANTITY_DRIVERS, driver)?.label;
  const formula = paintFormula(priced);

  return (
    <div className="rounded border border-border p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={row.label ?? def.label}
          onChange={(e) => set({ label: e.target.value })}
          className="flex-1 min-w-0 border border-border rounded px-2 py-1 text-sm font-medium"
        />
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {priced ? `$${money(priced.amount)}` : "—"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1 text-muted-foreground hover:text-red-600"
          aria-label={t("app.paint.removeSubstrate", "Remove substrate")}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Field
          label={
            derived && driverLabel
              ? t("app.paint.quantityFrom", "Quantity — from {driver}", {
                  driver: driverLabel,
                })
              : `${t("app.paint.quantity", "Quantity")} (${def.unit})`
          }
        >
          <Num
            value={derived ? (priced?.quantity ?? 0) : row.quantity}
            onChange={(v) => set({ quantity: v })}
            step={0.5}
            suffix={def.unit}
          />
        </Field>
        <Field label={t("app.paint.coats", "Coats")}>
          <select
            value={row.coats ?? def.coats ?? 2}
            onChange={(e) => set({ coats: Number(e.target.value) })}
            className={inputClass}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </Field>
        <Field label={t("app.paint.prepHours", "Prep hours")}>
          <Num
            value={row.prepHours ?? 0}
            onChange={(v) => set({ prepHours: v })}
            step={0.25}
            suffix="h"
          />
        </Field>
        <Field label={t("app.paint.product", "Product")}>
          <select
            value={row.noProduct ? "__none" : (row.productKey ?? def.productKey ?? "")}
            onChange={(e) =>
              e.target.value === "__none"
                ? set({ noProduct: true })
                : set({ noProduct: false, productKey: e.target.value })
            }
            className={inputClass}
          >
            {Object.keys(book?.products || {}).map((key) => (
              <option key={key} value={key}>
                {book.products[key].label}
              </option>
            ))}
            {/* Not "$0 paint". No product means nobody is supplying paint for
                this line, which is a different claim from free paint, and the
                totals below report the two separately. */}
            <option value="__none">
              {t("app.paint.noProduct", "No product — labour only")}
            </option>
          </select>
        </Field>
      </div>

      {derived && driverLabel && (
        <button
          type="button"
          onClick={() => set({ quantity: priced?.quantity ?? 0 })}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {t("app.paint.overrideQuantity", "Type a quantity instead")}
        </button>
      )}
      {!derived && driverLabel && (
        <button
          type="button"
          onClick={() => set({ quantity: null })}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {t("app.paint.useMeasured", "Use the measured quantity again")}
        </button>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={row.optional === true}
            onChange={(e) => set({ optional: e.target.checked })}
          />
          {t("app.paint.optionalSubstrate", "Optional — client can add it")}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={row.roundGallonsUp === true}
            onChange={(e) =>
              // Back to null, not false: null inherits the area's setting,
              // false overrides it to "no". Three states, three meanings.
              set({ roundGallonsUp: e.target.checked ? true : null })
            }
          />
          {t("app.paint.roundGallons", "Round gallons up")}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={row.showFormula === true}
            onChange={(e) => set({ showFormula: e.target.checked })}
          />
          {t("app.paint.showFormula", "Show rate formula (internal)")}
        </label>
      </div>

      {priced && (
        <div className="text-xs text-muted-foreground tabular-nums">
          {hoursText(priced.displayHours)} · ${money(priced.labour)}{" "}
          {t("app.paint.labourWord", "labour")}
          {priced.noProduct
            ? ` · ${t("app.paint.noProductShort", "no product")}`
            : priced.unpriced
              ? ` · ${priced.gallons.toFixed(2)} gal · ${t("app.paint.unpriced", "no price on this product yet")}`
              : ` · ${priced.gallons.toFixed(2)} gal · $${money(priced.material)}`}
        </div>
      )}
      {formula && (
        <div className="text-xs rounded bg-accent px-2 py-1 tabular-nums text-muted-foreground">
          {formula}
        </div>
      )}
    </div>
  );
}

/* ── One area ──────────────────────────────────────────────────────────── */

function AreaCard({ area, index, priced, book, t, onChange, onRemove }) {
  const set = (patch) => onChange({ ...area, ...patch });
  const substrates = asList(area.substrates);
  const style = area.measurement || "area";
  const geo = priced?.geometry || areaGeometry(area);

  const setSub = (i, next) =>
    set({ substrates: substrates.map((s, j) => (j === i ? next : s)) });

  // By stored index, never by position in the priced list: a substrate with
  // nothing measured yet produces no line, which would shift every row below it.
  const priceOf = (i) =>
    (priced?.lines || []).find(
      (l) => l.kind === "substrate" && l.rowIndex === i,
    ) || null;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={area.label || ""}
          onChange={(e) => set({ label: e.target.value })}
          placeholder={t("app.paint.areaPlaceholder", "Area {n}", {
            n: index + 1,
          })}
          className="flex-1 min-w-0 border border-border rounded px-2 py-1.5 text-sm font-medium"
        />
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          ${money(priced?.total ?? 0)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1.5 text-muted-foreground hover:text-red-600"
          aria-label={t("app.paint.removeArea", "Remove area")}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field label={t("app.paint.areaType", "Area type")}>
          <select
            value={area.areaType || "den"}
            onChange={(e) => {
              const next = own(book?.areaTypes, e.target.value);
              set({
                areaType: e.target.value,
                surface: next?.surface || area.surface,
                // The label follows the type only while it still matches the
                // old type's — a label the estimator wrote for the client is
                // theirs and is never overwritten.
                label:
                  area.label === own(book?.areaTypes, area.areaType)?.label
                    ? next?.label || area.label
                    : area.label,
              });
            }}
            className={inputClass}
          >
            {Object.keys(book?.areaTypes || {}).map((key) => (
              <option key={key} value={key}>
                {book.areaTypes[key].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("app.paint.surface", "Interior / exterior")}>
          <select
            value={area.surface || "interior"}
            onChange={(e) => set({ surface: e.target.value })}
            className={inputClass}
          >
            <option value="interior">
              {t("app.paint.interior", "Interior")}
            </option>
            <option value="exterior">
              {t("app.paint.exterior", "Exterior")}
            </option>
          </select>
        </Field>
        <Field label={t("app.paint.measurement", "How it's measured")}>
          <select
            value={style}
            onChange={(e) => set({ measurement: e.target.value })}
            className={inputClass}
          >
            {Object.keys(PAINT_MEASUREMENT_STYLES).map((key) => (
              <option key={key} value={key}>
                {PAINT_MEASUREMENT_STYLES[key].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {style === "area" && (
          <>
            <Field label={t("app.paint.lengthFt", "Length (ft)")}>
              <Num value={area.lengthFt} onChange={(v) => set({ lengthFt: v })} step={0.5} />
            </Field>
            <Field label={t("app.paint.widthFt", "Width (ft)")}>
              <Num value={area.widthFt} onChange={(v) => set({ widthFt: v })} step={0.5} />
            </Field>
          </>
        )}
        {style === "wall" && (
          <Field label={t("app.paint.linearFt", "Linear feet")}>
            <Num value={area.linearFt} onChange={(v) => set({ linearFt: v })} step={0.5} />
          </Field>
        )}
        {style === "surface" && (
          <>
            <Field label={t("app.paint.surfaceSqft", "Measured area (sqft)")}>
              <Num value={area.surfaceSqft} onChange={(v) => set({ surfaceSqft: v })} step={1} />
            </Field>
            <Field label={t("app.paint.linearFt", "Linear feet")}>
              <Num value={area.linearFt} onChange={(v) => set({ linearFt: v })} step={0.5} />
            </Field>
          </>
        )}
        {style !== "surface" && (
          <Field label={t("app.paint.heightFt", "Ceiling height (ft)")}>
            <Num value={area.heightFt} onChange={(v) => set({ heightFt: v })} step={0.5} />
          </Field>
        )}
        <Field label={t("app.paint.areaPrepHours", "Extra prep hours")}>
          <Num value={area.prepHours} onChange={(v) => set({ prepHours: v })} step={0.25} suffix="h" />
        </Field>
      </div>

      {/* Derived, and shown, so the estimator can check it against the room
          they are standing in. Wall area is GROSS — openings are not deducted,
          which is standard practice and what every production rate here was
          recovered against. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded bg-accent px-3 py-2 text-xs tabular-nums">
        <div>
          <div className="text-muted-foreground">{t("app.paint.geoWall", "Wall area")}</div>
          <div className="font-medium">{geo.wallSqft} sqft</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t("app.paint.geoCeiling", "Ceiling")}</div>
          <div className="font-medium">{geo.ceilingSqft} sqft</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t("app.paint.geoFloor", "Floor")}</div>
          <div className="font-medium">{geo.floorSqft} sqft</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t("app.paint.geoPerimeter", "Perimeter")}</div>
          <div className="font-medium">{geo.linearFt} lnft</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={area.optional === true}
            onChange={(e) => set({ optional: e.target.checked })}
          />
          {t("app.paint.optionalArea", "Optional — client can add or drop it")}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={area.roundGallonsUp === true}
            onChange={(e) => set({ roundGallonsUp: e.target.checked ? true : null })}
          />
          {t("app.paint.roundGallonsArea", "Round gallons up in this area")}
        </label>
      </div>

      {/* ── Substrates ── */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.paint.whatArePainting", "What are we painting")}
        </div>
        {substrates.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {t("app.paint.noSubstrates", "Nothing added yet — pick a surface below.")}
          </p>
        )}
        {substrates.map((row, i) => (
          <SubstrateRow
            key={i}
            row={row}
            priced={priceOf(i)}
            book={book}
            t={t}
            onChange={(next) => setSub(i, next)}
            onRemove={() =>
              set({ substrates: substrates.filter((_, j) => j !== i) })
            }
          />
        ))}
        <select
          value=""
          onChange={(e) => {
            const row = newPaintSubstrate(e.target.value, book);
            if (row) set({ substrates: [...substrates, row] });
          }}
          className={inputClass}
        >
          <option value="">
            {t("app.paint.addSubstrate", "Add a surface…")}
          </option>
          {Object.keys(book?.substrates || {})
            .filter((key) => {
              const s = book.substrates[key];
              return (
                s.surface === "any" || s.surface === (area.surface || "interior")
              );
            })
            .map((key) => (
              <option key={key} value={key}>
                {book.substrates[key].label}
              </option>
            ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("app.paint.crewNote", "Crew note (work order only)")}>
          <input
            value={area.crewNote || ""}
            onChange={(e) => set({ crewNote: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("app.paint.clientNote", "Client note (on the quote)")}>
          <input
            value={area.clientNote || ""}
            onChange={(e) => set({ clientNote: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      {priced && (
        <div className="flex justify-between text-sm border-t border-border pt-2">
          <span className="text-muted-foreground">
            {t("app.paint.areaTotal", "Area total")} ·{" "}
            {hoursText(priced.displayHours)} @ ${money(priced.hourlySellRate)}/h
          </span>
          <span className="font-semibold tabular-nums">
            ${money(priced.total)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── The takeoff ───────────────────────────────────────────────────────── */

export default function PaintAreas({ takeoff, book, onChange }) {
  const { t } = useTranslation();
  const areas = asList(takeoff?.areas);
  // One call, not a reimplementation. The screen and the quote must agree, and
  // the only way to guarantee that is for them to be the same arithmetic.
  const result = paintTakeoff(takeoff, book);

  const setArea = (i, next) =>
    onChange({ ...takeoff, areas: areas.map((a, j) => (j === i ? next : a)) });

  // Two lists over one array — see `index` in paintTakeoff(). Matching on the
  // label would pair the wrong room the moment a house had two "Bedroom"s.
  const pricedFor = (i) =>
    result.areas.find((o) => o.index === i) ||
    result.optionalAreas.find((o) => o.index === i) ||
    null;

  return (
    <div className="space-y-3">
      {areas.map((area, i) => (
        <AreaCard
          key={i}
          area={area}
          index={i}
          priced={pricedFor(i)}
          book={book}
          t={t}
          onChange={(next) => setArea(i, next)}
          onRemove={() =>
            onChange({ ...takeoff, areas: areas.filter((_, j) => j !== i) })
          }
        />
      ))}

      <button
        type="button"
        onClick={() =>
          onChange({ ...takeoff, areas: [...areas, newPaintArea("den", book)] })
        }
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus size={14} /> {t("app.paint.addArea", "Add an area")}
      </button>

      {areas.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("app.paint.totalHours", "Man-hours")}
            </span>
            <span className="tabular-nums">{hoursText(result.displayHours)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("app.paint.totalLabour", "Labour")}
            </span>
            <span className="tabular-nums">${money(result.labour)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("app.paint.totalMaterial", "Materials")}
            </span>
            <span className="tabular-nums">${money(result.material)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-border pt-2">
            <span>{t("app.paint.totalScope", "Included scope")}</span>
            <span className="tabular-nums">${money(result.total)}</span>
          </div>

          {result.unpricedCount > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t(
                "app.paint.unpricedWarning",
                "{n} line(s) use a product with no price on the rate card. Their paint is counted but not costed.",
                { n: result.unpricedCount },
              )}
            </p>
          )}

          {result.purchase.length > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("app.paint.buyList", "Paint to buy")}
              </div>
              {result.purchase.map((p) => (
                <div key={p.productKey} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="tabular-nums">
                    {p.gallons} gal ({p.fractionalGallons})
                  </span>
                </div>
              ))}
              {/* Fractional in brackets on purpose. Rounding each room up and
                  adding is not adding and rounding once, and on a house the
                  difference is a trip to the store — see paintTakeoff(). */}
            </div>
          )}

          {(result.optionalAreas.length > 0 ||
            result.optionalSubstrates.length > 0) && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("app.paint.optionalOffered", "Offered as optional extras")}
              </div>
              {result.optionalAreas.map((a) => (
                <div key={`a-${a.label}`} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className="tabular-nums">${money(a.total)}</span>
                </div>
              ))}
              {result.optionalSubstrates.map((s, i) => (
                <div key={`s-${i}`} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {s.area} — {s.label}
                  </span>
                  <span className="tabular-nums">${money(s.amount)}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "app.paint.optionalExplain",
                  "Not in the total above. They appear at the bottom of the quote for the client to tick, and the total they sign changes when they do.",
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
