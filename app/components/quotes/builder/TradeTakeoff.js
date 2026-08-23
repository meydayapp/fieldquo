// app/components/quotes/builder/TradeTakeoff.js
//
// The structured takeoff for trades that are quoted by counting things.
//
// The generic builder gives you "Add line item" and a product picker, which
// means an estimator quoting a staircase types six lines and does the
// arithmetic in their head. That is how a riser gets counted twice and how a
// newel post gets forgotten. TrueFinish quotes these trades from a form: tick
// what the job includes, enter the counts, and the lines fall out priced.
//
// Presentational. All state lives in the parent as `group.takeoff`; this
// renders it and reports edits back through onChange. Prices come from the
// company's price book (app/data/tradePriceBooks.js) and every one of them can
// be overridden on the line, because a rate card is a starting point.
"use client";

import { COMPLEXITY_LEVELS } from "@/app/data/tradePriceBooks";
import { clientPriceFromCost, newStairSection } from "@/lib/pricing/tradeScope";
import { Plus, Trash2 } from "lucide-react";

const inputClass =
  "w-full mt-1 border border-border rounded px-2 py-1.5 text-sm";
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => num(v).toFixed(2);
const asList = (v) => (Array.isArray(v) ? v : []);

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Num({ value, onChange, min = 0, step = 1, prefix }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {prefix}
        </span>
      )}
      <input
        type="number"
        min={min}
        step={step}
        value={value === 0 ? 0 : value || ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? 0 : Number(e.target.value))
        }
        className={`${inputClass} ${prefix ? "pl-5" : ""}`}
      />
    </div>
  );
}

/** Complexity tiles — the whole rate grid moves with the selection. */
function ComplexityPicker({ value, book, onChange }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">Complexity level</label>
      <div className="mt-1 grid gap-2 sm:grid-cols-3">
        {COMPLEXITY_LEVELS.map((level) => {
          const active = (value || "standard") === level.value;
          const desc = book?.complexity?.[level.value]?.desc;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? "border-transparent ring-2"
                  : "border-border hover:border-foreground/30"
              }`}
              style={
                active
                  ? {
                      ringColor: level.color,
                      borderColor: level.color,
                      background: `${level.color}14`,
                    }
                  : undefined
              }
            >
              <span
                className="block text-sm font-medium"
                style={{ color: active ? level.color : undefined }}
              >
                {level.label}
              </span>
              {desc && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {desc}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Stairs ────────────────────────────────────────────────────────────── */

const STAIR_ELEMENTS = [
  {
    key: "treads",
    label: "Treads",
    unit: "tread",
    rateKey: "treadPrice",
    always: true,
  },
  {
    key: "risers",
    label: "Risers",
    unit: "riser",
    rateKey: "riserPrice",
    toggle: "paintRisers",
  },
  {
    key: "balusters",
    label: "Balusters / spindles",
    unit: "each",
    rateKey: "balusterPrice",
    toggle: "paintBalusters",
  },
  {
    key: "posts",
    label: "Newel posts",
    unit: "each",
    rateKey: "postPrice",
    toggle: "paintPosts",
  },
  {
    key: "handrailFt",
    label: "Handrail",
    unit: "linear ft",
    rateKey: "handrailPricePerFt",
    always: true,
  },
  {
    key: "landingSqft",
    label: "Landing / hallway",
    unit: "sqft",
    rateKey: "landingPricePerSqft",
    always: true,
  },
];

function StairSection({ section, index, book, canRemove, onChange, onRemove }) {
  const level = section.complexityLevel || "standard";
  const rates = book?.complexity?.[level] || {};
  const set = (patch) => onChange({ ...section, ...patch });

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={section.title || ""}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={`Staircase ${index + 1}`}
          className="flex-1 border border-border rounded px-2 py-1.5 text-sm font-medium"
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-muted-foreground hover:text-red-600"
            aria-label="Remove staircase"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <ComplexityPicker
        value={level}
        book={book}
        onChange={(v) => set({ complexityLevel: v })}
      />

      <div className="space-y-1.5">
        {STAIR_ELEMENTS.map((el) => {
          // Treads, handrail and landing always bill when a count is entered.
          // Risers, balusters and posts are opt-in: plenty of jobs refinish the
          // treads and leave the painted parts alone, and counting them for
          // reference must never quietly charge for them.
          const on = el.always
            ? num(section[el.key]) > 0
            : Boolean(section[el.toggle]);
          const rate =
            section[`${el.rateKey}Override`] ?? rates[el.rateKey] ?? 0;
          const qty = num(section[el.key]);
          return (
            <div key={el.key} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                {el.toggle ? (
                  <input
                    type="checkbox"
                    checked={Boolean(section[el.toggle])}
                    onChange={(e) => set({ [el.toggle]: e.target.checked })}
                    className="shrink-0"
                  />
                ) : (
                  <span className="w-[13px] shrink-0" />
                )}
                <span
                  className={`text-sm ${on ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {el.label}
                </span>
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Num
                  value={section[el.key]}
                  onChange={(v) => set({ [el.key]: v })}
                />
              </div>
              <div className="col-span-1 hidden sm:block text-xs text-muted-foreground">
                {el.unit}
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Num
                  prefix="$"
                  step={0.25}
                  value={rate}
                  onChange={(v) => set({ [`${el.rateKey}Override`]: v })}
                />
              </div>
              <div className="col-span-3 sm:col-span-2 text-right text-sm tabular-nums">
                {on ? (
                  `$${money(qty * num(rate))}`
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(section.twoTone)}
          onChange={(e) => set({ twoTone: e.target.checked })}
        />
        Two-tone finish
        <span className="text-muted-foreground">
          +$
          {money(
            section.twoToneSurchargeOverride ?? rates.twoToneSurcharge ?? 0,
          )}
        </span>
      </label>

      <Field label="Stain colour">
        <input
          value={section.stainColour || ""}
          onChange={(e) => set({ stainColour: e.target.value })}
          className={inputClass}
          placeholder="e.g. Jacobean"
        />
      </Field>
    </div>
  );
}

function StairsTakeoff({ takeoff, book, onChange }) {
  const sections = Array.isArray(takeoff.sections) ? takeoff.sections : [];
  const setSections = (next) => onChange({ ...takeoff, sections: next });

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <StairSection
          key={i}
          section={section}
          index={i}
          book={book}
          canRemove={sections.length > 1}
          onChange={(next) =>
            setSections(sections.map((s, j) => (j === i ? next : s)))
          }
          onRemove={() => setSections(sections.filter((_, j) => j !== i))}
        />
      ))}

      <button
        type="button"
        onClick={() =>
          setSections([
            ...sections,
            newStairSection(`Staircase ${sections.length + 1}`),
          ])
        }
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus size={14} /> Add another staircase
      </button>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(takeoff.basement)}
            onChange={(e) =>
              onChange({ ...takeoff, basement: e.target.checked })
            }
          />
          Basement stairs
        </label>
        {takeoff.basement && (
          <div className="w-28">
            <Num
              value={takeoff.basementTreads}
              onChange={(v) => onChange({ ...takeoff, basementTreads: v })}
            />
          </div>
        )}
        {takeoff.basement && (
          <span className="text-xs text-muted-foreground">
            treads @ ${money(book?.basementTreadPrice)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Countertop ────────────────────────────────────────────────────────── */

function CountertopTakeoff({ takeoff, book, onChange }) {
  const items = Array.isArray(takeoff.items) ? takeoff.items : [];
  const markup = takeoff.markupPct ?? book?.defaultMarkupPct ?? 0;
  const setItem = (i, patch) =>
    onChange({
      ...takeoff,
      items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    });

  const total = items.reduce(
    (sum, it) =>
      sum +
      (it.enabled
        ? clientPriceFromCost(it.supplierCost, markup, it.override)
        : 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Material">
          <select
            value={takeoff.materialType || ""}
            onChange={(e) =>
              onChange({ ...takeoff, materialType: e.target.value })
            }
            className={inputClass}
          >
            {(book?.materials || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Markup on supplier cost">
          <Num
            step={1}
            value={markup}
            onChange={(v) => onChange({ ...takeoff, markupPct: v })}
          />
        </Field>
      </div>

      {/* Supplier cost and margin are INTERNAL. They are shown here because
          this screen is the estimator's; nothing in this block reaches the
          client's document — see buildTradeLineItems. */}
      <div className="rounded-lg border border-border">
        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-5">Item</div>
          <div className="col-span-2 text-right">Supplier cost</div>
          <div className="col-span-2 text-right">Override</div>
          <div className="col-span-3 text-right">Client price</div>
        </div>

        {items.map((item, i) => {
          const price = item.enabled
            ? clientPriceFromCost(item.supplierCost, markup, item.override)
            : 0;
          return (
            <div
              key={item.id || i}
              className="grid grid-cols-12 items-center gap-2 px-3 py-2 border-b border-border last:border-0"
            >
              <label className="col-span-12 sm:col-span-5 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(item.enabled)}
                  onChange={(e) => setItem(i, { enabled: e.target.checked })}
                />
                <span
                  className={
                    item.enabled ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {item.label}
                </span>
              </label>

              {item.id === "backsplash" && item.enabled && (
                <div className="col-span-12 sm:col-span-5 sm:col-start-1">
                  <select
                    value={item.heightOption || "4in"}
                    onChange={(e) =>
                      setItem(i, { heightOption: e.target.value })
                    }
                    className="border border-border rounded px-2 py-1 text-xs"
                  >
                    {Object.entries(book?.backsplashHeights || {}).map(
                      ([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              )}

              <div className="col-span-4 sm:col-span-2">
                <Num
                  prefix="$"
                  step={0.01}
                  value={item.supplierCost}
                  onChange={(v) => setItem(i, { supplierCost: v })}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Num
                  prefix="$"
                  step={0.01}
                  value={item.override}
                  onChange={(v) => setItem(i, { override: v })}
                />
              </div>
              <div className="col-span-4 sm:col-span-3 text-right text-sm font-medium tabular-nums">
                {price > 0 ? (
                  `$${money(price)}`
                ) : (
                  <span className="text-muted-foreground font-normal">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          Supplier cost $
          {money(
            items.reduce(
              (s, i) => s + (i.enabled ? num(i.supplierCost) : 0),
              0,
            ),
          )}{" "}
          · internal only
        </span>
        <span className="font-semibold">${money(total)}</span>
      </div>
    </div>
  );
}

/* ── Garage doors ──────────────────────────────────────────────────────── */

function DoorRows({ label, entries, picks, onChange }) {
  const set = (id, patch) =>
    onChange(picks.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="rounded-lg border border-border">
      <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 border-b border-border text-xs text-muted-foreground">
        <div className="col-span-6">{label}</div>
        <div className="col-span-2 text-right">Qty</div>
        <div className="col-span-2 text-right">Override</div>
        <div className="col-span-2 text-right">Line</div>
      </div>

      {Object.entries(entries).map(([id, entry]) => {
        const pick = picks.find((p) => p.id === id) || {
          id,
          quantity: 0,
          override: 0,
        };
        const rate =
          num(pick.override) > 0 ? num(pick.override) : num(entry.price);
        const amount = num(pick.quantity) * rate;
        return (
          <div
            key={id}
            className="grid grid-cols-12 items-center gap-2 px-3 py-2 border-b border-border last:border-0"
          >
            <div className="col-span-12 sm:col-span-6 text-sm">
              <span
                className={
                  num(pick.quantity) > 0
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {entry.label}
              </span>
              <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                ${money(entry.price)}
              </span>
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Num
                value={pick.quantity}
                onChange={(v) => set(id, { quantity: v })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Num
                prefix="$"
                step={25}
                value={pick.override}
                onChange={(v) => set(id, { override: v })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2 text-right text-sm font-medium tabular-nums">
              {amount > 0 ? (
                `$${money(amount)}`
              ) : (
                <span className="text-muted-foreground font-normal">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Supply and install. The one thing this screen has to make unmissable is what
// the door price covers: with installation included it is the whole job, and
// without it the door line drops by the install rate and the labour becomes
// its own line. A company that unticks the box and has no install rate set
// would otherwise quote supply-only labour at nothing and never see it.
function GarageDoorTakeoff({ takeoff, book, onChange }) {
  const installIncluded = takeoff.installIncluded !== false;
  const installRate = num(book?.installPricePerDoor);
  const doorCount = asList(takeoff.doors).reduce(
    (s, d) => s + num(d.quantity),
    0,
  );
  const missingInstallPrice =
    !installIncluded && doorCount > 0 && installRate <= 0;

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={installIncluded}
          onChange={(e) =>
            onChange({ ...takeoff, installIncluded: e.target.checked })
          }
        />
        <span>
          Installation included in the door price
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {installIncluded
              ? "Each door is quoted as supplied and fitted."
              : `Doors are quoted supply-only (less $${money(installRate)} each) and installation is charged as its own line.`}
          </span>
        </span>
      </label>

      {missingInstallPrice && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          No installation rate is set, so unticking the box only removes the
          &ldquo;installation included&rdquo; wording — the door prices stay as
          they are and no fitting is charged. Set a rate in Settings → Services
          → Garage Door Services, or leave installation included above.
        </p>
      )}

      <DoorRows
        label="Door"
        entries={book?.doors || {}}
        picks={asList(takeoff.doors)}
        onChange={(doors) => onChange({ ...takeoff, doors })}
      />
      <DoorRows
        label="Capping frame"
        entries={book?.capping || {}}
        picks={asList(takeoff.capping)}
        onChange={(capping) => onChange({ ...takeoff, capping })}
      />
    </div>
  );
}

/* ── Entry point ───────────────────────────────────────────────────────── */

const TAKEOFFS = {
  stairs: StairsTakeoff,
  countertop: CountertopTakeoff,
  garage_door: GarageDoorTakeoff,
};

export function hasTakeoff(categoryKey) {
  return Boolean(TAKEOFFS[categoryKey]);
}

export default function TradeTakeoff({ categoryKey, takeoff, book, onChange }) {
  const Component = TAKEOFFS[categoryKey];
  if (!Component || !takeoff || !book) return null;
  return (
    <div className="space-y-3 pb-4 border-b border-border">
      <Component takeoff={takeoff} book={book} onChange={onChange} />
    </div>
  );
}
