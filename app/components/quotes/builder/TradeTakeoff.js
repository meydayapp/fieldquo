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
import {
  clientPriceFromCost,
  newStairSection,
  newFloorSection,
  newPaintRoom,
} from "@/lib/pricing/tradeScope";
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

/**
 * A scope option: tick it and it prices itself from the complexity grid.
 *
 * The label carries the arithmetic — "$2.50/sqft × 300 = $750" — because the
 * question an estimator is actually asking is "what does adding this do to the
 * number", and a bare checkbox makes them open a calculator to find out.
 */
function OptionRow({ checked, onToggle, label, hint, amount, children }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
      <input
        type="checkbox"
        className="mt-1"
        checked={Boolean(checked)}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </span>
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {amount > 0 ? (
              `$${money(amount)}`
            ) : (
              <span className="font-normal text-muted-foreground">—</span>
            )}
          </span>
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        {checked && children}
      </div>
    </div>
  );
}

/** Title + remove, shared by every repeatable card (rooms, floor areas). */
function CardHeader({
  value,
  placeholder,
  onChange,
  onRemove,
  canRemove,
  removeLabel,
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border border-border rounded px-2 py-1.5 text-sm font-medium"
      />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-muted-foreground hover:text-red-600"
          aria-label={removeLabel}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/** Add-another button, shared by the repeatable takeoffs. */
function AddButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <Plus size={15} /> {children}
    </button>
  );
}

/* ── Interior painting ─────────────────────────────────────────────────── */

// Room types are a label, not a price. The list exists so a quote reads
// "Master bedroom" rather than "Room 2"; nothing downstream branches on it,
// and no square footage is guessed from it — an assumed 250 sqft is a number
// the client gets billed for that nobody measured.
const ROOM_TYPES = [
  ["living_room", "Living room"],
  ["dining_room", "Dining room"],
  ["kitchen", "Kitchen"],
  ["master_bedroom", "Master bedroom"],
  ["bedroom", "Bedroom"],
  ["bathroom", "Bathroom"],
  ["master_bathroom", "Master bathroom"],
  ["hallway", "Hallway / corridor"],
  ["stairwell", "Stairwell"],
  ["office", "Home office"],
  ["laundry", "Laundry room"],
  ["basement", "Basement / rec room"],
  ["other", "Other"],
];

function PaintRoom({ room, index, book, canRemove, onChange, onRemove }) {
  const level = room.complexityLevel || "standard";
  const c = book?.complexity?.[level] || {};
  const set = (patch) => onChange({ ...room, ...patch });
  const sqft = num(room.sqft);

  const wallAmount =
    room.walls && sqft > 0 ? sqft * num(c.wallPricePerSqft) : 0;
  const doorAmount = room.doors ? num(room.doorsCount) * num(c.doorPrice) : 0;
  const closetAmount = room.closets
    ? num(room.closetsCount) * num(c.closetPrice)
    : 0;
  const total =
    wallAmount +
    doorAmount +
    closetAmount +
    (room.ceiling ? num(c.ceilingPrice) : 0) +
    (room.trim ? num(c.trimPrice) : 0) +
    (room.colorChange ? num(c.colorChangeSurcharge) : 0) +
    (room.drywallPrep ? num(c.drywallPrepPrice) : 0);

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <CardHeader
        value={room.title}
        placeholder={`Room ${index + 1}`}
        onChange={(title) => set({ title })}
        onRemove={onRemove}
        canRemove={canRemove}
        removeLabel="Remove room"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Room type">
          <select
            value={room.roomType || "bedroom"}
            onChange={(e) => set({ roomType: e.target.value })}
            className={inputClass}
          >
            {ROOM_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Floor area (sqft)">
          <Num value={room.sqft} onChange={(v) => set({ sqft: v })} />
        </Field>
      </div>

      <ComplexityPicker
        value={level}
        book={book}
        onChange={(v) => set({ complexityLevel: v })}
      />

      <div>
        <OptionRow
          checked={room.walls}
          onToggle={(v) => set({ walls: v })}
          label="Walls"
          hint={
            sqft > 0
              ? `${sqft} sqft × $${money(c.wallPricePerSqft)}/sqft`
              : "Enter the floor area above to price this"
          }
          amount={wallAmount}
        />
        <OptionRow
          checked={room.ceiling}
          onToggle={(v) => set({ ceiling: v })}
          label="Ceiling"
          hint={`$${money(c.ceilingPrice)} for the room`}
          amount={room.ceiling ? num(c.ceilingPrice) : 0}
        />
        <OptionRow
          checked={room.trim}
          onToggle={(v) => set({ trim: v })}
          label="Trim & baseboards"
          hint={`$${money(c.trimPrice)} for the room`}
          amount={room.trim ? num(c.trimPrice) : 0}
        />
        <OptionRow
          checked={room.doors}
          onToggle={(v) => set({ doors: v })}
          label="Interior doors"
          hint={`$${money(c.doorPrice)} each`}
          amount={doorAmount}
        >
          <div className="mt-1 w-28">
            <Num
              value={room.doorsCount}
              onChange={(v) => set({ doorsCount: v })}
            />
          </div>
        </OptionRow>
        <OptionRow
          checked={room.closets}
          onToggle={(v) => set({ closets: v })}
          label="Closet interiors"
          hint={`$${money(c.closetPrice)} each`}
          amount={closetAmount}
        >
          <div className="mt-1 w-28">
            <Num
              value={room.closetsCount}
              onChange={(v) => set({ closetsCount: v })}
            />
          </div>
        </OptionRow>
        <OptionRow
          checked={room.colorChange}
          onToggle={(v) => set({ colorChange: v })}
          label="Colour change surcharge"
          hint="Dark-to-light or a dramatic change"
          amount={room.colorChange ? num(c.colorChangeSurcharge) : 0}
        />
        <OptionRow
          checked={room.drywallPrep}
          onToggle={(v) => set({ drywallPrep: v })}
          label="Drywall prep / repairs"
          hint="Patches, sanding, skim coat"
          amount={room.drywallPrep ? num(c.drywallPrepPrice) : 0}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Room total</span>
        <span className="font-semibold tabular-nums">${money(total)}</span>
      </div>
    </div>
  );
}

function InteriorPaintTakeoff({ takeoff, book, onChange }) {
  const rooms = asList(takeoff.rooms);
  const g = book?.global || {};
  const setRoom = (i, room) =>
    onChange({ ...takeoff, rooms: rooms.map((r, j) => (j === i ? room : r)) });

  const popcornAmount = takeoff.popcornRemoval
    ? num(takeoff.popcornSqft) * num(g.popcornRemovalPricePerSqft)
    : 0;

  return (
    <div className="space-y-3">
      {rooms.map((room, i) => (
        <PaintRoom
          key={i}
          room={room}
          index={i}
          book={book}
          canRemove={rooms.length > 1}
          onChange={(next) => setRoom(i, next)}
          onRemove={() =>
            onChange({ ...takeoff, rooms: rooms.filter((_, j) => j !== i) })
          }
        />
      ))}

      <AddButton
        onClick={() =>
          onChange({
            ...takeoff,
            rooms: [...rooms, newPaintRoom(`Room ${rooms.length + 1}`)],
          })
        }
      >
        Add room
      </AddButton>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Whole-project add-ons
        </div>
        <OptionRow
          checked={takeoff.popcornRemoval}
          onToggle={(v) => onChange({ ...takeoff, popcornRemoval: v })}
          label="Popcorn / stipple ceiling removal"
          hint={`$${money(g.popcornRemovalPricePerSqft)}/sqft`}
          amount={popcornAmount}
        >
          <div className="mt-1 w-32">
            <Num
              value={takeoff.popcornSqft}
              onChange={(v) => onChange({ ...takeoff, popcornSqft: v })}
            />
          </div>
        </OptionRow>
        <OptionRow
          checked={takeoff.furnitureMoving}
          onToggle={(v) => onChange({ ...takeoff, furnitureMoving: v })}
          label="Furniture moving & protection"
          hint={`$${money(g.furnitureMovingPrice)} flat`}
          amount={takeoff.furnitureMoving ? num(g.furnitureMovingPrice) : 0}
        />
      </div>
    </div>
  );
}

/* ── Exterior painting ─────────────────────────────────────────────────── */

function ExteriorPaintTakeoff({ takeoff, book, onChange }) {
  const level = takeoff.complexityLevel || "standard";
  const c = book?.complexity?.[level] || {};
  const picks = asList(takeoff.items);
  const e = book?.extras || {};

  // Surfaces move with the complexity grid; fixtures are flat per item — a
  // garage door is a garage door whether the house is one storey or three.
  const rateFor = (bookItem) =>
    bookItem.priceType === "flat"
      ? num(bookItem.flatPrice)
      : num(c[bookItem.priceType]);

  const setItem = (id, patch) =>
    onChange({
      ...takeoff,
      items: picks.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const primeAmount = takeoff.priming
    ? num(takeoff.primeSqft) * num(e.primePricePerSqft)
    : 0;

  return (
    <div className="space-y-3">
      <ComplexityPicker
        value={level}
        book={book}
        onChange={(v) => onChange({ ...takeoff, complexityLevel: v })}
      />

      <div className="rounded-lg border border-border px-3">
        {asList(book?.items).map((bookItem) => {
          const pick = picks.find((p) => p.id === bookItem.id) || {
            id: bookItem.id,
            enabled: false,
            quantity: 0,
            override: 0,
          };
          const base = rateFor(bookItem);
          const rate = num(pick.override) > 0 ? num(pick.override) : base;
          const amount = pick.enabled ? num(pick.quantity) * rate : 0;
          return (
            <OptionRow
              key={bookItem.id}
              checked={pick.enabled}
              onToggle={(v) => setItem(bookItem.id, { enabled: v })}
              label={bookItem.label}
              hint={`$${money(base)} / ${bookItem.unit}`}
              amount={amount}
            >
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Field label={`Quantity (${bookItem.unit})`}>
                  <Num
                    value={pick.quantity}
                    onChange={(v) => setItem(bookItem.id, { quantity: v })}
                  />
                </Field>
                {/* An override replaces the RATE, not the line total — that is
                    what the builder does with it, and labelling it "override
                    total" while it behaves per-unit is how the same field ends
                    up meaning two things on two screens. */}
                <Field label={`Override rate (per ${bookItem.unit})`}>
                  <Num
                    prefix="$"
                    step={0.25}
                    value={pick.override}
                    onChange={(v) => setItem(bookItem.id, { override: v })}
                  />
                </Field>
              </div>
            </OptionRow>
          );
        })}
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Project add-ons
        </div>
        <OptionRow
          checked={takeoff.pressureWashing}
          onToggle={(v) => onChange({ ...takeoff, pressureWashing: v })}
          label="Pressure washing"
          hint={`$${money(e.pressureWashingPrice)} flat — full exterior wash before painting`}
          amount={takeoff.pressureWashing ? num(e.pressureWashingPrice) : 0}
        />
        <OptionRow
          checked={takeoff.priming}
          onToggle={(v) => onChange({ ...takeoff, priming: v })}
          label="Priming"
          hint={`$${money(e.primePricePerSqft)}/sqft — bare wood, colour change, weathered surfaces`}
          amount={primeAmount}
        >
          <div className="mt-1 w-32">
            <Num
              value={takeoff.primeSqft}
              onChange={(v) => onChange({ ...takeoff, primeSqft: v })}
            />
          </div>
        </OptionRow>
      </div>
    </div>
  );
}

/* ── Hardwood flooring ─────────────────────────────────────────────────── */

const WOOD_SPECIES = [
  "Red oak",
  "White oak",
  "Maple",
  "Cherry",
  "Walnut",
  "Hickory",
  "Pine",
  "Ash",
  "Birch",
  "Douglas fir",
];
const FINISH_TYPES = [
  "Water-based polyurethane",
  "Oil-based polyurethane",
  "Hard-wax oil",
  "Penetrating oil",
  "Swedish finish",
  "Satin",
  "Semi-gloss",
  "Matte",
];

function FloorSection({ section, index, book, canRemove, onChange, onRemove }) {
  const level = section.complexityLevel || "standard";
  const c = book?.complexity?.[level] || {};
  const set = (patch) => onChange({ ...section, ...patch });
  const sqft = num(section.sqft);

  const refinish = sqft * num(c.pricePerSqft);
  const stain = section.stainChange ? sqft * num(c.stainChangePricePerSqft) : 0;
  const gaps = section.gapFilling ? sqft * num(c.gapFillingPricePerSqft) : 0;
  const total =
    refinish +
    stain +
    gaps +
    (section.waterDamageRepair ? num(c.waterDamagePrice) : 0) +
    (section.furnitureMoving ? num(c.furnitureMovingPrice) : 0) +
    (section.stairBlending ? num(c.stairBlendingPrice) : 0);

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <CardHeader
        value={section.title}
        placeholder={`Floor area ${index + 1}`}
        onChange={(title) => set({ title })}
        onRemove={onRemove}
        canRemove={canRemove}
        removeLabel="Remove floor area"
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Square footage">
          <Num value={section.sqft} onChange={(v) => set({ sqft: v })} />
        </Field>
        <Field label="Wood species">
          <select
            value={section.woodSpecies || ""}
            onChange={(e) => set({ woodSpecies: e.target.value })}
            className={inputClass}
          >
            <option value="">Not specified</option>
            {WOOD_SPECIES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Finish type">
          <select
            value={section.finishType || ""}
            onChange={(e) => set({ finishType: e.target.value })}
            className={inputClass}
          >
            <option value="">Not specified</option>
            {FINISH_TYPES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <ComplexityPicker
        value={level}
        book={book}
        onChange={(v) => set({ complexityLevel: v })}
      />

      <div className="flex items-baseline justify-between border-b border-border py-1.5 text-sm">
        <span>
          Refinishing
          <span className="ml-2 text-xs text-muted-foreground">
            {sqft > 0
              ? `${sqft} sqft × $${money(c.pricePerSqft)}/sqft`
              : "Enter the square footage above"}
          </span>
        </span>
        <span className="font-medium tabular-nums">
          {refinish > 0 ? `$${money(refinish)}` : "—"}
        </span>
      </div>

      <div>
        <OptionRow
          checked={section.stainChange}
          onToggle={(v) => set({ stainChange: v })}
          label="Stain colour change"
          hint={`$${money(c.stainChangePricePerSqft)}/sqft`}
          amount={stain}
        />
        <OptionRow
          checked={section.gapFilling}
          onToggle={(v) => set({ gapFilling: v })}
          label="Gap filling"
          hint={`$${money(c.gapFillingPricePerSqft)}/sqft`}
          amount={gaps}
        />
        <OptionRow
          checked={section.waterDamageRepair}
          onToggle={(v) => set({ waterDamageRepair: v })}
          label="Water damage repair"
          hint={`$${money(c.waterDamagePrice)} flat`}
          amount={section.waterDamageRepair ? num(c.waterDamagePrice) : 0}
        />
        <OptionRow
          checked={section.furnitureMoving}
          onToggle={(v) => set({ furnitureMoving: v })}
          label="Furniture moving"
          hint={`$${money(c.furnitureMovingPrice)} flat`}
          amount={section.furnitureMoving ? num(c.furnitureMovingPrice) : 0}
        />
        <OptionRow
          checked={section.stairBlending}
          onToggle={(v) => set({ stairBlending: v })}
          label="Stair blending"
          hint={`$${money(c.stairBlendingPrice)} flat`}
          amount={section.stairBlending ? num(c.stairBlendingPrice) : 0}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Area total</span>
        <span className="font-semibold tabular-nums">${money(total)}</span>
      </div>
    </div>
  );
}

function FlooringTakeoff({ takeoff, book, onChange }) {
  const sections = asList(takeoff.sections);
  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <FloorSection
          key={i}
          section={section}
          index={i}
          book={book}
          canRemove={sections.length > 1}
          onChange={(next) =>
            onChange({
              ...takeoff,
              sections: sections.map((s, j) => (j === i ? next : s)),
            })
          }
          onRemove={() =>
            onChange({
              ...takeoff,
              sections: sections.filter((_, j) => j !== i),
            })
          }
        />
      ))}
      <AddButton
        onClick={() =>
          onChange({
            ...takeoff,
            sections: [
              ...sections,
              newFloorSection(`Floor area ${sections.length + 1}`),
            ],
          })
        }
      >
        Add floor area
      </AddButton>
    </div>
  );
}

/* ── Entry point ───────────────────────────────────────────────────────── */

const TAKEOFFS = {
  stairs: StairsTakeoff,
  countertop: CountertopTakeoff,
  garage_door: GarageDoorTakeoff,
  interior_painting: InteriorPaintTakeoff,
  exterior_painting: ExteriorPaintTakeoff,
  flooring: FlooringTakeoff,
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
