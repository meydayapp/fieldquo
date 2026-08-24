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
  inspectionBandFor,
  newStairSection,
  newFloorSection,
  newPaintRoom,
} from "@/lib/pricing/tradeScope";
import { Plus, Trash2 } from "lucide-react";
import {
  Field,
  Num,
  OptionRow,
  inputClass,
  num,
  money,
  asList,
} from "./fields";
import PaverDesigner from "./PaverDesigner";
import LabourPanel from "./LabourPanel";
import { pitchBand, roofLabour, roofCrewDays } from "@/lib/pricing/roofLabour";
import { paverLabour, paverCrewDays } from "@/lib/pricing/paverLabour";
import {
  insulationTakeoff,
  insulationCrewDays,
  recommendedR,
  codeMinimumR,
  CLIMATE_ZONES,
} from "@/lib/pricing/insulation";
import { useState } from "react";
import { DRIVEWAY_LABELS } from "@/lib/pricing/tradeScope";

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

/* ── Driveway sealing ──────────────────────────────────────────────────── */

function DrivewaySealingTakeoff({ takeoff, book, onChange }) {
  const level = takeoff.complexityLevel || "standard";
  const c = book?.complexity?.[level] || {};
  const e = book?.extras || {};
  const set = (patch) => onChange({ ...takeoff, ...patch });
  const sqft = num(takeoff.sqft);

  const coats = takeoff.twoCoats ? 2 : 1;
  const multiplier = takeoff.twoCoats
    ? 1 + (num(book?.secondCoatMultiplier) || 1)
    : 1;
  const sealAmount = sqft * num(c.sealPricePerSqft) * multiplier;

  const includedFt = num(e.crackFillIncludedFt);
  const billableFt = Math.max(0, num(takeoff.crackFt) - includedFt);
  const crackAmount = takeoff.crackFilling
    ? billableFt * num(e.crackFillPerFt)
    : 0;

  return (
    <div className="space-y-3">
      <Field label="Driveway area (sqft)">
        <Num value={takeoff.sqft} onChange={(v) => set({ sqft: v })} />
      </Field>

      <ComplexityPicker
        value={level}
        book={book}
        onChange={(v) => set({ complexityLevel: v })}
      />

      <div className="flex items-baseline justify-between border-b border-border py-1.5 text-sm">
        <span>
          Sealing — {coats} coat{coats === 1 ? "" : "s"}
          <span className="ml-2 text-xs text-muted-foreground">
            {sqft > 0
              ? `${sqft} sqft × $${money(num(c.sealPricePerSqft) * multiplier)}/sqft`
              : "Enter the driveway area above"}
          </span>
        </span>
        <span className="font-medium tabular-nums">
          {sealAmount > 0 ? `$${money(sealAmount)}` : "—"}
        </span>
      </div>

      <div>
        <OptionRow
          checked={takeoff.twoCoats}
          onToggle={(v) => set({ twoCoats: v })}
          label="Second coat"
          hint="One coat lasts two to three years; two lasts about four. Priced into the sealing line above."
          amount={0}
        />
        <OptionRow
          checked={takeoff.premiumSealer}
          onToggle={(v) => set({ premiumSealer: v })}
          label="Premium sealer"
          hint={`$${money(e.premiumSealerPerSqft)}/sqft`}
          amount={
            takeoff.premiumSealer ? sqft * num(e.premiumSealerPerSqft) : 0
          }
        />
        <OptionRow
          checked={takeoff.crackFilling}
          onToggle={(v) => set({ crackFilling: v })}
          label="Crack filling"
          hint={
            includedFt > 0
              ? `$${money(e.crackFillPerFt)}/linear ft after the first ${includedFt} ft`
              : `$${money(e.crackFillPerFt)}/linear ft`
          }
          amount={crackAmount}
        >
          <div className="mt-1 w-32">
            <Num
              value={takeoff.crackFt}
              onChange={(v) => set({ crackFt: v })}
            />
          </div>
          {includedFt > 0 && num(takeoff.crackFt) > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {billableFt > 0
                ? `${includedFt} ft included, ${billableFt} ft charged`
                : `All ${num(takeoff.crackFt)} ft fall inside the included ${includedFt} ft`}
            </div>
          )}
        </OptionRow>
        <OptionRow
          checked={takeoff.pressureWash}
          onToggle={(v) => set({ pressureWash: v })}
          label="Pressure wash"
          hint={`$${money(e.pressureWashPerSqft)}/sqft`}
          amount={takeoff.pressureWash ? sqft * num(e.pressureWashPerSqft) : 0}
        />
        <OptionRow
          checked={takeoff.stainTreatment}
          onToggle={(v) => set({ stainTreatment: v })}
          label="Oil / grease stain treatment"
          hint={`$${money(e.stainTreatmentPrice)} flat — sealer will not bond over oil`}
          amount={takeoff.stainTreatment ? num(e.stainTreatmentPrice) : 0}
        />
        <OptionRow
          checked={takeoff.travelSurcharge}
          onToggle={(v) => set({ travelSurcharge: v })}
          label="Travel beyond 30 km"
          hint={`$${money(e.travelSurchargePrice)} flat`}
          amount={takeoff.travelSurcharge ? num(e.travelSurchargePrice) : 0}
        />
      </div>

      {num(book?.minimumTotal) <= 0 && sqft > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          No job minimum is set for this trade, so a small driveway quotes at
          whatever the area comes to — {sqft} sqft is $
          {money(sqft * num(c.sealPricePerSqft))} for one coat. Set one in
          Settings → Services → Driveway Sealing.
        </p>
      )}
    </div>
  );
}

/* ── Home inspection ───────────────────────────────────────────────────── */

// The band, spelled out. An inspector quoting from a printed price list reads
// down a column to a row; this screen has to show which row it landed on,
// because "3,100 sq ft" and "$625" side by side look like a per-foot rate that
// went wrong. The band label is the thing that reaches the client's document.
function HomeInspectionTakeoff({ takeoff, book, onChange }) {
  const set = (patch) => onChange({ ...takeoff, ...patch });
  const sqft = num(takeoff.sqft);
  const band = inspectionBandFor(book?.bands, sqft);
  const bandPrice = num(band?.price);

  // Mirrors buildHomeInspection exactly. A screen that showed the band price
  // alone would under-state a large house by hundreds of dollars against the
  // quote it goes on to produce.
  const ceiling = Number(band?.maxSqft);
  const per1000 = num(book?.oversize?.pricePer1000Sqft);
  const oversizeThousands =
    bandPrice > 0 && Number.isFinite(ceiling) && per1000 > 0 && sqft > ceiling
      ? Math.ceil((sqft - ceiling) / 1000)
      : 0;

  const ancillary = book?.ancillary || {};
  const counts =
    takeoff.ancillary && typeof takeoff.ancillary === "object"
      ? takeoff.ancillary
      : {};
  const setCount = (id, value) =>
    set({ ancillary: { ...counts, [id]: value } });

  const warranty = book?.warrantyInspection || {};
  const warrantyRate = num(warranty.price);
  const visits = num(takeoff.warrantyVisits);

  return (
    <div className="space-y-3">
      <Field label="Living area (sq ft)">
        <Num
          step={50}
          value={takeoff.sqft}
          onChange={(v) => set({ sqft: v })}
        />
      </Field>

      <div className="flex items-baseline justify-between border-b border-border py-1.5 text-sm">
        <span>
          Full home inspection
          <span className="ml-2 text-xs text-muted-foreground">
            {sqft <= 0
              ? "Enter the area — the price comes from the band it falls in"
              : band
                ? band.label || band.id
                : "No band covers this area"}
          </span>
        </span>
        <span className="font-medium tabular-nums">
          {bandPrice > 0 ? `$${money(bandPrice)}` : "—"}
        </span>
      </div>

      {oversizeThousands > 0 && (
        <div className="flex items-baseline justify-between border-b border-border py-1.5 text-sm">
          <span>
            {book?.oversize?.label || "Additional square footage"}
            <span className="ml-2 text-xs text-muted-foreground">
              {sqft - ceiling} sq ft over the largest band, charged per 1,000 or
              part thereof
            </span>
          </span>
          <span className="font-medium tabular-nums">
            ${money(oversizeThousands * per1000)}
          </span>
        </div>
      )}

      {sqft > 0 && bandPrice <= 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {band
            ? `The “${band.label || band.id}” band has no price set, so no inspection line will appear on this quote.`
            : `No band covers ${sqft} sq ft, so no inspection line will appear on this quote.`}{" "}
          Fix it in Settings → Services → Home Inspection.
        </p>
      )}

      <div>
        {Object.entries(ancillary).map(([id, entry]) => {
          const qty = num(counts[id]);
          const rate = num(entry?.price);
          const unpriced = rate <= 0;
          return (
            <OptionRow
              key={id}
              checked={qty > 0}
              onToggle={(on) => setCount(id, on ? 1 : 0)}
              label={entry?.label || id}
              hint={
                unpriced
                  ? // Said on the row rather than in a footnote: a ticked box
                    // that adds nothing to the total is the exact failure this
                    // codebase keeps finding.
                    `No price set — ticking this adds nothing to the quote. ${entry?.note || ""}`.trim()
                  : [
                      `$${money(rate)} ${entry?.unit ? `/ ${entry.unit}` : "each"}`,
                      entry?.note,
                    ]
                      .filter(Boolean)
                      .join(" · ")
              }
              amount={unpriced ? 0 : qty * rate}
            >
              {entry?.countable && (
                <div className="mt-1 w-24">
                  <Num value={qty} onChange={(v) => setCount(id, v)} />
                </div>
              )}
            </OptionRow>
          );
        })}

        <OptionRow
          checked={visits > 0}
          onToggle={(on) => set({ warrantyVisits: on ? 1 : 0 })}
          label={warranty.label || "Warranty inspection"}
          hint={
            warrantyRate > 0
              ? `$${money(warrantyRate)} per visit${warranty.note ? ` · ${warranty.note}` : ""}`
              : "No price set — ticking this adds nothing to the quote."
          }
          amount={warrantyRate > 0 ? visits * warrantyRate : 0}
        >
          <div className="mt-1 w-24">
            <Num
              value={takeoff.warrantyVisits}
              onChange={(v) => set({ warrantyVisits: v })}
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            One visit per milestone. Bill the milestones the client is booking
            now — the rest are separate visits, months apart.
          </div>
        </OptionRow>
      </div>
    </div>
  );
}

/* ── Interlock and paving ──────────────────────────────────────────────── */

const PAVING_SURFACES = [
  ["patioSqft", "Patio", "patioPricePerSqft", false],
  ["walkwaySqft", "Walkway", "walkwayPricePerSqft", false],
  ["drivewaySqft", "Driveway", "drivewayPricePerSqft", true],
];

function PavingTakeoff({ takeoff, book, onChange, siteImageUrl }) {
  const level = takeoff.complexityLevel || "standard";
  // The hours come from the same tier and access answers the estimator has
  // already given above — see lib/pricing/paverLabour.js for why the panel does
  // not ask "how hard is this?" a second time in different words.
  const labour = paverLabour(takeoff, book?.labour);
  const crew = paverCrewDays(labour.hours, {
    crewSize: num(takeoff.crewSize) || 3,
    rates: book?.labour,
  });
  const c = book?.complexity?.[level] || {};
  const e = book?.extras || {};
  const set = (patch) => onChange({ ...takeoff, ...patch });

  const options = book?.paverOptions || {};
  const chosen = options[takeoff.paverOption] || null;
  const allowance = num(book?.paverAllowancePerSqft);
  const paverCost =
    num(takeoff.paverCostPerSqft) > 0
      ? num(takeoff.paverCostPerSqft)
      : num(chosen?.costPerSqft);
  const uplift = Math.max(0, paverCost - allowance);

  const totalSqft = PAVING_SURFACES.reduce(
    (sum, [key]) => sum + num(takeoff[key]),
    0,
  );
  const belowAssumed = totalSqft > 0 && totalSqft < num(book?.assumesMinSqft);

  return (
    <div className="space-y-3">
      {/* Trace it rather than guess it.
          The drawing lives inside the takeoff JSON (`takeoff.paverDesign`),
          which is already a column — no schema change, and reopening the quote
          restores the shapes instead of a flat number nobody can recount. The
          three boxes below stay editable: an estimator who measured on site
          with a tape should not have to draw it to type it. */}
      <PaverDesigner
        takeoff={takeoff}
        onChange={onChange}
        design={takeoff.paverDesign || null}
        onDesignChange={(paverDesign) => set({ paverDesign })}
        imageUrl={siteImageUrl || ""}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        {PAVING_SURFACES.map(([key, label, rateKey, isDriveway]) => {
          const rate =
            num(c[rateKey]) +
            (isDriveway ? num(e.drivewayPaverUpchargePerSqft) : 0);
          return (
            <Field key={key} label={`${label} (sqft)`}>
              <Num value={takeoff[key]} onChange={(v) => set({ [key]: v })} />
              <div className="mt-1 text-xs text-muted-foreground">
                ${money(rate)}/sqft installed
              </div>
            </Field>
          );
        })}
      </div>

      <Field label="Retaining / garden wall (sqft of face)">
        <Num
          value={takeoff.wallFaceSqft}
          onChange={(v) => set({ wallFaceSqft: v })}
        />
        <div className="mt-1 text-xs text-muted-foreground">
          ${money(book?.wallPricePerFaceSqft)}/sqft of wall face — its base,
          structural units, capping and any steps built into it. Measured by
          face area rather than length, because that is how it is invoiced.
        </div>
      </Field>

      <ComplexityPicker
        value={level}
        book={book}
        onChange={(v) => set({ complexityLevel: v })}
      />

      {/* Said plainly, because the rate is only true above this size — every
          contractor in the research says small jobs cost more per foot, and
          none of them publishes by how much, so this warns rather than
          silently applying an invented surcharge. */}
      {belowAssumed && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          These rates assume a job of at least {num(book.assumesMinSqft)} sqft
          with machine access. At {totalSqft} sqft the real cost per foot is
          higher — every contractor says so and none of them publishes a number,
          so nothing has been added automatically. Move the complexity up, or
          add a line by hand.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Paver">
          <select
            value={takeoff.paverOption || "standard"}
            onChange={(e2) => set({ paverOption: e2.target.value })}
            className={inputClass}
          >
            {Object.entries(options).map(([key, opt]) => (
              <option key={key} value={key}>
                {opt.label} — ${money(opt.costPerSqft)}/sqft
              </option>
            ))}
          </select>
        </Field>
        <Field label="Or your own paver cost ($/sqft)">
          <Num
            prefix="$"
            step={0.5}
            value={takeoff.paverCostPerSqft}
            onChange={(v) => set({ paverCostPerSqft: v })}
          />
        </Field>
      </div>

      {/* A 50 mm paver under a car cracks. Warned rather than blocked: a
          company may legitimately stock something this book has never seen,
          and the estimator is the one standing in the driveway. */}
      {num(takeoff.drivewaySqft) > 0 &&
        chosen &&
        num(chosen.minThicknessMm) < num(book?.drivewayMinThicknessMm) && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {chosen.label} is a {num(chosen.minThicknessMm)} mm paver and this
            quote includes a driveway. Vehicles need at least{" "}
            {num(book.drivewayMinThicknessMm)} mm.
          </p>
        )}

      {/* The allowance is the thing people get wrong. It is already inside the
          installed rate, so only the excess is billable — charging the whole
          paver price bills the stone twice. */}
      <p className="text-xs text-muted-foreground">
        ${money(allowance)}/sqft of paver is already included in the installed
        rate.{" "}
        {uplift > 0
          ? `This one costs $${money(paverCost)}, so $${money(uplift)}/sqft is added.`
          : "This one is inside the allowance, so nothing is added."}
      </p>

      <div>
        <OptionRow
          checked={takeoff.removeExisting}
          onToggle={(v) => set({ removeExisting: v })}
          label="Remove and dispose of the existing surface"
          hint={`$${money(e.removeExistingPerSqft)}/sqft`}
          amount={
            takeoff.removeExisting
              ? totalSqft * num(e.removeExistingPerSqft)
              : 0
          }
        />
        <OptionRow
          checked={takeoff.poorAccess}
          onToggle={(v) => set({ poorAccess: v })}
          label="Restricted site access"
          hint={`$${money(e.poorAccessPerSqft)}/sqft — no machine route, wheelbarrow distance`}
          amount={takeoff.poorAccess ? totalSqft * num(e.poorAccessPerSqft) : 0}
        />
        <OptionRow
          checked={takeoff.curvesCuts}
          onToggle={(v) => set({ curvesCuts: v })}
          label="Curves, borders and cutting"
          hint={`$${money(e.curvesCutsPerSqft)}/sqft`}
          amount={takeoff.curvesCuts ? totalSqft * num(e.curvesCutsPerSqft) : 0}
        />
        <OptionRow
          checked={takeoff.sealing}
          onToggle={(v) => set({ sealing: v })}
          label="Sealing"
          hint={`$${money(e.sealingPerSqft)}/sqft`}
          amount={takeoff.sealing ? totalSqft * num(e.sealingPerSqft) : 0}
        />
        <OptionRow
          checked={takeoff.permeable}
          onToggle={(v) => set({ permeable: v })}
          label="Permeable system"
          hint={`+${money(e.permeableUpliftPct)}% on the work above`}
          amount={0}
        />
      </div>

      <LabourPanel
        detail={labour}
        crewSize={takeoff.crewSize}
        onCrewSize={(v) => set({ crewSize: v })}
        crew={crew}
        emptyHint="Enter an area above first."
        factorNote={
          labour.incomplete
            ? null
            : `On-site work ${labour.onSiteHours} h (${labour.complexity.tier} ×${labour.complexity.tierFactor}${
                labour.complexity.accessFactor !== 1
                  ? `, poor access ×${labour.complexity.accessFactor}`
                  : ""
              }) · mobilising, compaction passes and ${labour.spoilCuYd} cu yd of spoil hauled away ${labour.fixedHours} h, which do not scale with either.`
        }
      />
    </div>
  );
}

/* ── Snow removal ──────────────────────────────────────────────────────── */

function SnowRemovalTakeoff({ takeoff, book, onChange }) {
  const e = book?.extras || {};
  const season = book?.season || {};
  const set = (patch) => onChange({ ...takeoff, ...patch });
  const plans = book?.plans || {};
  const plan = plans[takeoff.plan] || plans.basic || {};
  const drives = plan.driveways || {};
  const driveRate = num(drives[takeoff.drivewaySize]);
  const hasDriveway = driveRate > 0;

  const saltAmount = takeoff.salting
    ? num(takeoff.saltApplications) * num(e.saltPerApplication)
    : 0;
  const visitAmount = num(takeoff.extraVisits) * num(e.perVisitPrice);
  const noVisitRate = num(takeoff.extraVisits) > 0 && num(e.perVisitPrice) <= 0;
  const shovelBlocked =
    takeoff.shovelling &&
    !hasDriveway &&
    book?.shovellingRequiresDriveway !== false;

  return (
    <div className="space-y-3">
      {/* The plan is the product. What separates these two is the depth that
          triggers a visit, which is the only part a client actually feels. */}
      <div>
        <label className="text-xs text-muted-foreground">Plan</label>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {Object.entries(plans).map(([key, p]) => {
            const active = (takeoff.plan || "basic") === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => set({ plan: key })}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  active
                    ? "border-foreground/40 bg-muted"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <span className="block font-medium text-foreground">
                  {p.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {num(p.driveways?.[takeoff.drivewaySize]) > 0
                    ? `$${money(p.driveways[takeoff.drivewaySize])} for the season`
                    : "No rate set for this driveway"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Driveway">
        <select
          value={takeoff.drivewaySize || "double"}
          onChange={(ev) => set({ drivewaySize: ev.target.value })}
          className={inputClass}
        >
          {Object.entries(drives).map(([key, price]) => (
            <option key={key} value={key}>
              {DRIVEWAY_LABELS[key] || key}
              {num(price) > 0 ? ` — $${money(price)}` : " — no rate set"}
            </option>
          ))}
        </select>
      </Field>

      {!hasDriveway && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          No seasonal rate is set for this size on the {plan.label || "chosen"}{" "}
          plan, so nothing will be billed for it. Set one in Settings → Services
          → Snow Removal.
        </p>
      )}

      <p className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
        Season runs {season.startsLabel} to {season.endsLabel}, covering up to{" "}
        {num(season.snowfallLimitCm)} cm or {num(season.eventLimit)} events of{" "}
        {num(season.eventThresholdCm)} cm+, whichever comes first. Past that the
        overage fee of ${money(book?.overageFee)} applies — charged when the
        season runs long, not quoted up front.
      </p>

      <div>
        <OptionRow
          checked={takeoff.shovelling}
          onToggle={(v) => set({ shovelling: v })}
          label="Walkway and steps"
          hint={`$${money(plan.shovelling)} for the season, on the ${plan.label || "chosen"} plan`}
          amount={
            takeoff.shovelling && !shovelBlocked ? num(plan.shovelling) : 0
          }
        />
        <OptionRow
          checked={takeoff.salting}
          onToggle={(v) => set({ salting: v })}
          label="Salting"
          hint={`$${money(e.saltPerApplication)} per application`}
          amount={saltAmount}
        >
          <div className="mt-1 w-32">
            <Num
              value={takeoff.saltApplications}
              onChange={(v) => set({ saltApplications: v })}
            />
          </div>
        </OptionRow>
        <OptionRow
          checked={takeoff.newClient}
          onToggle={(v) => set({ newClient: v })}
          label="New client discount"
          hint={`−$${money(book?.newClientDiscount)}, shown to the client as its own line`}
          amount={0}
        />
      </div>

      {shovelBlocked && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Walkway and steps are sold alongside a driveway, not on their own, so
          this will not be billed until a driveway with a rate is selected
          above. That is the contract these rates come from, not a software
          limit — pick a driveway, or change the rule in Settings.
        </p>
      )}

      <Field label="Additional visits beyond the season">
        <Num
          value={takeoff.extraVisits}
          onChange={(v) => set({ extraVisits: v })}
        />
        <div className="mt-1 text-xs text-muted-foreground">
          {num(e.perVisitPrice) > 0
            ? `$${money(e.perVisitPrice)} per visit — $${money(visitAmount)}`
            : "No per-visit rate is set, so these will not be billed."}
        </div>
      </Field>

      {noVisitRate && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {num(takeoff.extraVisits)} extra visits are entered but no per-visit
          rate exists, so they add nothing. Set one in Settings → Services →
          Snow Removal.
        </p>
      )}
    </div>
  );
}

/* ── Entry point ───────────────────────────────────────────────────────── */

/* ── Roofing ───────────────────────────────────────────────────────────── */

/**
 * The roof takeoff.
 *
 * Two things it does that a bare "area × rate" form cannot:
 *
 *   MEASURES. Area and pitch come from the client's address, through the same
 *   Google Solar model the public instant quote uses. The estimator confirms
 *   rather than guesses, and the field says which of the two it is — a number
 *   nobody measured must never look like one somebody did.
 *
 *   SHOWS THE HOURS. Roofing is the one trade whose labour is itemised
 *   (lib/pricing/roofLabour.js), so the panel at the bottom is the actual
 *   breakdown, not a total to be trusted. Internal only: none of it reaches the
 *   client's quote, the PDF or the email — the line items above do that.
 */
function RoofingTakeoff({ takeoff, book, onChange, siteAddress = "" }) {
  const set = (patch) => onChange({ ...takeoff, ...patch });
  const [measuring, setMeasuring] = useState(false);
  const [measureNote, setMeasureNote] = useState("");

  const materials = book?.materials || {};
  const materialKey = takeoff.materialKey || book?.defaultMaterial || "";
  const material = Object.prototype.hasOwnProperty.call(materials, materialKey)
    ? materials[materialKey]
    : null;

  const squares = num(takeoff.areaSqft) / 100;
  const band = pitchBand(num(takeoff.pitchRise));
  const labour = roofLabour({ ...takeoff, materials }, book?.labour);
  const crew = roofCrewDays(labour.hours, {
    crewSize: num(takeoff.crewSize) || 2,
    rates: book?.labour,
  });

  async function measure() {
    if (!siteAddress) return;
    setMeasuring(true);
    setMeasureNote("");
    try {
      const res = await fetch(
        `/api/measure/roof?address=${encodeURIComponent(siteAddress)}`,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        // Named, not swallowed: an estimator who clicked a button and saw
        // nothing happen has no way to tell "no coverage here" from "broken".
        setMeasureNote(
          data?.message ||
            "Roof measuring is unavailable. Enter the area below.",
        );
        return;
      }
      set({
        areaSqft: Math.round(num(data.areaSqft)),
        pitchRise: num(data.predominantPitch?.rise),
        measuredFrom: "satellite",
      });
      setMeasureNote(
        `Measured ${Math.round(num(data.areaSqft)).toLocaleString()} sqft of roof surface across ${num(data.segmentCount)} facets` +
          (data.predominantPitch?.shareOfRoof
            ? ` — ${data.predominantPitch.rise}/12 over ${data.predominantPitch.shareOfRoof}% of it.`
            : "."),
      );
    } catch {
      setMeasureNote("Roof measuring is unavailable. Enter the area below.");
    } finally {
      setMeasuring(false);
    }
  }

  const lf = [
    ["iceWaterFt", "Ice & water membrane", book?.details?.iceWaterPerLf],
    ["dripEdgeFt", "Drip edge", book?.details?.dripEdgePerLf],
    ["starterFt", "Starter course", book?.details?.starterPerLf],
    ["valleyFt", "Valleys", book?.details?.valleyPerLf],
    ["ridgeHipFt", "Ridge & hip cap", book?.details?.ridgeCapPerLf],
    ["ridgeVentFt", "Ridge vent", book?.details?.ridgeVentPerLf],
    [
      "stepFlashingFt",
      "Step flashing to wall",
      book?.details?.stepFlashingPerLf,
    ],
  ];
  const pens = [
    ["ventBoots", "vent_boot"],
    ["boxVents", "box_vent"],
    ["skylights", "skylight"],
    ["chimneys", "chimney"],
  ];

  return (
    <div className="space-y-3">
      {siteAddress && (
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 text-xs text-muted-foreground">
              Measure the roof from {siteAddress}
            </span>
            <button
              type="button"
              onClick={measure}
              disabled={measuring}
              className="shrink-0 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              {measuring ? "Measuring…" : "Measure from satellite"}
            </button>
          </div>
          {measureNote && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {measureNote}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Roof surface (sqft)">
          <Num
            value={takeoff.areaSqft}
            step={10}
            onChange={(v) => set({ areaSqft: v, measuredFrom: "manual" })}
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {squares > 0
              ? `${squares.toFixed(1)} squares${takeoff.measuredFrom === "satellite" ? " · measured" : ""}`
              : "The sloped surface, not the footprint"}
          </p>
        </Field>
        <Field label="Pitch (rise per 12)">
          <Num
            value={takeoff.pitchRise}
            step={1}
            onChange={(v) => set({ pitchRise: v })}
            suffix="/12"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {band.label} · labour ×{band.factor}
          </p>
        </Field>
        <Field label="Existing layers to strip">
          <Num
            value={takeoff.layers}
            step={1}
            onChange={(v) => set({ layers: v })}
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {num(takeoff.layers) === 0
              ? "New deck — nothing to tear off"
              : "Each layer adds to the strip, not to the install"}
          </p>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Roofing material">
          <select
            value={materialKey}
            onChange={(e) => set({ materialKey: e.target.value })}
            className={inputClass}
          >
            {Object.entries(materials).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label} — ${money(m.pricePerSquare)}/sq
              </option>
            ))}
          </select>
        </Field>
        <Field label="Storeys">
          <select
            value={takeoff.storeys || "one"}
            onChange={(e) => set({ storeys: e.target.value })}
            className={inputClass}
          >
            <option value="one">One storey</option>
            <option value="two">Two storeys</option>
            <option value="three_plus">Three or more</option>
          </select>
        </Field>
        <Field label="Sheathing to replace">
          <Num
            value={takeoff.deckSheets}
            step={1}
            onChange={(v) => set({ deckSheets: v })}
            suffix="sheets"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            An allowance — reconcile it on the invoice
          </p>
        </Field>
      </div>

      <div>
        <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Linear details
        </h5>
        <div className="grid gap-2 sm:grid-cols-4">
          {lf.map(([key, label, rate]) => (
            <Field key={key} label={label}>
              <Num
                value={takeoff[key]}
                step={5}
                onChange={(v) => set({ [key]: v })}
                suffix="ft"
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {num(rate) > 0 ? `$${money(rate)}/ft` : "not priced"}
              </p>
            </Field>
          ))}
        </div>
      </div>

      <div>
        <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Penetrations
        </h5>
        <div className="grid gap-2 sm:grid-cols-4">
          {pens.map(([field, id]) => {
            const entry = book?.penetrations?.[id];
            if (!entry) return null;
            return (
              <Field key={field} label={entry.label}>
                <Num
                  value={takeoff[field]}
                  step={1}
                  onChange={(v) => set({ [field]: v })}
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  ${money(entry.price)} each
                </p>
              </Field>
            );
          })}
        </div>
      </div>

      <LabourPanel
        detail={labour}
        crewSize={takeoff.crewSize}
        onCrewSize={(v) => set({ crewSize: v })}
        crew={crew}
        emptyHint="Enter the roof area first."
        factorNote={
          labour.incomplete
            ? null
            : `On-roof work ${labour.onRoofHours} h (pitch ×${labour.pitch.factor}, storeys ×${labour.storeyFactor}${
                labour.materialFactor !== 1
                  ? `, ${material?.label || "material"} ×${labour.materialFactor}`
                  : ""
              }) · set-up, cleanup and dump runs ${labour.fixedHours} h, which do not scale with pitch.`
        }
      />

      <Field label="Scope notes">
        <textarea
          value={takeoff.notes || ""}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
          className={inputClass}
          placeholder="Access, staging, anything the crew needs to know"
        />
      </Field>
    </div>
  );
}

/* ── Siding ────────────────────────────────────────────────────────────── */

/**
 * The siding takeoff.
 *
 * Wall area, not floor area — the number a sider measures. The published
 * $/sqft figures behind this book are quoted against "a 2,000 sqft home",
 * which is the house's floor area and clads out at roughly 1,800-2,400 sqft of
 * wall; asking for the wrong one of those is a 20% error before anything else
 * happens, so the field says which it wants.
 */
function SidingTakeoff({ takeoff, book, onChange }) {
  const set = (patch) => onChange({ ...takeoff, ...patch });
  const materials = book?.materials || {};
  const materialKey = takeoff.materialKey || book?.defaultMaterial || "";
  const material = Object.prototype.hasOwnProperty.call(materials, materialKey)
    ? materials[materialKey]
    : null;
  const sqft = num(takeoff.sqft);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Wall area (sqft)">
          <Num
            value={takeoff.sqft}
            step={10}
            onChange={(v) => set({ sqft: v })}
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            The wall being clad, not the floor area of the house
          </p>
        </Field>
        <Field label="Cladding">
          <select
            value={materialKey}
            onChange={(e) => set({ materialKey: e.target.value })}
            className={inputClass}
          >
            {Object.entries(materials).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label} — ${money(m.pricePerSqft)}/sqft
              </option>
            ))}
          </select>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {material && sqft > 0
              ? `$${money(sqft * num(material.pricePerSqft))} installed`
              : "Installed, cladding and labour"}
          </p>
        </Field>
        <Field label="Storeys">
          <select
            value={takeoff.storeys || "one"}
            onChange={(e) => set({ storeys: e.target.value })}
            className={inputClass}
          >
            <option value="one">One storey</option>
            <option value="two">Two storeys</option>
            <option value="three_plus">Three or more</option>
          </select>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {num(book?.storeySurcharge?.[takeoff.storeys || "one"]) > 0
              ? `+${Math.round(num(book.storeySurcharge[takeoff.storeys]) * 100)}% for staging`
              : "Ladders — no access surcharge"}
          </p>
        </Field>
      </div>

      <div>
        <OptionRow
          checked={takeoff.tearOff}
          onToggle={(v) => set({ tearOff: v })}
          label="Strip and dispose of existing cladding"
          hint={`$${money(book?.tearOffPerSqft)}/sqft`}
          amount={takeoff.tearOff ? sqft * num(book?.tearOffPerSqft) : 0}
        />
        <OptionRow
          checked={takeoff.housewrap}
          onToggle={(v) => set({ housewrap: v })}
          label="House wrap and weather barrier"
          hint={`$${money(book?.housewrapPerSqft)}/sqft`}
          amount={takeoff.housewrap ? sqft * num(book?.housewrapPerSqft) : 0}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Rot repair allowance">
          <Num
            value={takeoff.rotRepairSqft}
            step={5}
            onChange={(v) => set({ rotRepairSqft: v })}
            suffix="sqft"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            ${money(book?.rotRepairPerSqft)}/sqft — reconcile on the invoice
          </p>
        </Field>
        <Field label="Trim">
          <Num
            value={takeoff.trimFt}
            step={5}
            onChange={(v) => set({ trimFt: v })}
            suffix="ft"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            ${money(book?.trimPerLf)}/ft
          </p>
        </Field>
        <Field label="Fascia">
          <Num
            value={takeoff.fasciaFt}
            step={5}
            onChange={(v) => set({ fasciaFt: v })}
            suffix="ft"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            ${money(book?.fasciaPerLf)}/ft
          </p>
        </Field>
        <Field label="Soffit">
          <Num
            value={takeoff.soffitSqft}
            step={5}
            onChange={(v) => set({ soffitSqft: v })}
            suffix="sqft"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            ${money(book?.soffitPerSqft)}/sqft
          </p>
        </Field>
      </div>

      <Field label="Scope notes">
        <textarea
          value={takeoff.notes || ""}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
          className={inputClass}
          placeholder="Access, colour, anything the crew needs to know"
        />
      </Field>
    </div>
  );
}

/* ── Insulation ────────────────────────────────────────────────────────── */

/**
 * The insulation takeoff.
 *
 * The depth is calculated, not chosen: target R minus what is already there,
 * divided by the material's R per inch. Everything on this form exists to feed
 * that one sum, which is why the climate zone is a required question with no
 * default — Ottawa is Zone 6 and Miami is Zone 1, and the recommendation is
 * R60 in one and R30 in the other.
 */
function InsulationTakeoff({ takeoff, book, onChange }) {
  const set = (patch) => onChange({ ...takeoff, ...patch });
  const materials = book?.materials || {};
  const materialKey = takeoff.materialKey || book?.defaultMaterial || "";
  const material = Object.prototype.hasOwnProperty.call(materials, materialKey)
    ? materials[materialKey]
    : null;
  const e = book?.extras || {};

  const detail = insulationTakeoff(takeoff, material, book?.labour);
  const crew = insulationCrewDays(detail.hours, {
    crewSize: num(takeoff.crewSize) || 2,
    rates: book?.labour,
  });

  const recommended = recommendedR(
    takeoff.climateZone,
    takeoff.assembly,
    takeoff.existingDepthIn,
  );
  const sqft = num(takeoff.sqft);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="What's being insulated">
          <select
            value={takeoff.assembly || "attic"}
            onChange={(e2) => set({ assembly: e2.target.value })}
            className={inputClass}
          >
            <option value="attic">Attic</option>
            <option value="floor">Floor or crawlspace</option>
            <option value="wall">Wall cavity</option>
            <option value="other">Something else</option>
          </select>
        </Field>
        <Field label="Climate zone">
          <select
            value={takeoff.climateZone || ""}
            onChange={(e2) => set({ climateZone: e2.target.value })}
            className={inputClass}
          >
            <option value="">Choose a zone…</option>
            {CLIMATE_ZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {recommended
              ? `ENERGY STAR recommends R${recommended} here`
              : "Check the IECC map — nothing is assumed from the address"}
          </p>
        </Field>
        <Field label="Area (sqft)">
          <Num
            value={takeoff.sqft}
            step={10}
            onChange={(v) => set({ sqft: v })}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Material">
          <select
            value={materialKey}
            onChange={(e2) => set({ materialKey: e2.target.value })}
            className={inputClass}
          >
            {Object.entries(materials).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label}
                {num(m.rPerInch) > 0 ? ` — R${m.rPerInch}/inch` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Already in place">
          <Num
            value={takeoff.existingDepthIn}
            step={0.5}
            onChange={(v) => set({ existingDepthIn: v })}
            suffix="in"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {num(takeoff.existingDepthIn) >= 3
              ? "Top-up target applies"
              : "Leave 0 for a bare assembly"}
          </p>
        </Field>
        <Field label="Target R">
          <select
            value={
              num(takeoff.targetR) > 0
                ? "manual"
                : takeoff.targetBasis || "energy_star"
            }
            onChange={(e2) =>
              set(
                e2.target.value === "manual"
                  ? { targetBasis: "manual" }
                  : { targetBasis: e2.target.value, targetR: 0 },
              )
            }
            className={inputClass}
          >
            <option value="energy_star">ENERGY STAR recommendation</option>
            <option value="code">Ontario code minimum (OBC)</option>
            <option value="manual">A number I&apos;ll type</option>
          </select>
          {(takeoff.targetBasis === "manual" || num(takeoff.targetR) > 0) && (
            <div className="mt-1">
              <Num
                value={takeoff.targetR}
                step={1}
                onChange={(v) => set({ targetR: v })}
              />
            </div>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {/* A code MINIMUM and a recommendation are different claims. The
                field says which one produced the number, because "recommended"
                on a legal minimum understates it and "required" on a
                recommendation overstates it. */}
            {detail.targetBasis === "code"
              ? `OBC minimum for this assembly: R${detail.targetR}`
              : detail.targetBasis === "energy_star"
                ? `ENERGY STAR: R${detail.targetR}`
                : detail.targetBasis === "manual"
                  ? "Your own target"
                  : codeMinimumR(takeoff.assembly)
                    ? `No zone chosen — OBC minimum here is R${codeMinimumR(takeoff.assembly)}`
                    : "Choose a zone or type a target"}
          </p>
        </Field>
        <Field label="Cavity depth limit">
          <Num
            value={takeoff.maxDepthIn}
            step={0.5}
            onChange={(v) => set({ maxDepthIn: v })}
            suffix="in"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            0 for an open attic
          </p>
        </Field>
      </div>

      {/* The whole point of the form, said back in one sentence. */}
      <div className="rounded-lg border border-border px-3 py-2 text-sm">
        {detail.incomplete ? (
          <span className="text-muted-foreground">{detail.warnings[0]}</span>
        ) : detail.rated ? (
          <span className="text-foreground">
            <strong>{detail.inches}&quot;</strong> of {material?.label} adds{" "}
            <strong>R{detail.addedR}</strong>
            {detail.existingR > 0
              ? ` on top of the R${detail.existingR} already there`
              : ""}{" "}
            → the assembly finishes at <strong>R{detail.finalR}</strong>
            {detail.targetR > 0
              ? ` against a target of R${detail.targetR}`
              : ""}
            .
          </span>
        ) : (
          <span className="text-muted-foreground">
            {material?.label} is sold by the square foot and carries no R-value
            claim — see the note on the quote.
          </span>
        )}
      </div>

      <div>
        <OptionRow
          checked={takeoff.airSeal}
          onToggle={(v) => set({ airSeal: v })}
          label="Air seal before insulating"
          hint={`$${money(e.airSealPerSqft)}/sqft — blowing over the leaks is the most common way an attic job fails to perform`}
          amount={takeoff.airSeal ? sqft * num(e.airSealPerSqft) : 0}
        />
        <OptionRow
          checked={takeoff.removeExisting}
          onToggle={(v) => set({ removeExisting: v })}
          label="Remove existing insulation"
          hint={`$${money(e.removalPerSqft)}/sqft — wet, compacted or contaminated`}
          amount={takeoff.removeExisting ? sqft * num(e.removalPerSqft) : 0}
        />
        {/* Only for the materials that actually need one. Closed-cell foam is
            its own vapour barrier at these thicknesses, and offering the line
            anyway would sell a homeowner something the assembly already has. */}
        {material?.needsVapourBarrier && (
          <OptionRow
            checked={takeoff.vapourBarrier !== false}
            onToggle={(v) => set({ vapourBarrier: v })}
            label="Vapour barrier"
            hint={`$${money(e.vapourBarrierPerSqft)}/sqft — ${material.label} is vapour-permeable and needs one`}
            amount={
              takeoff.vapourBarrier !== false
                ? sqft * num(e.vapourBarrierPerSqft)
                : 0
            }
          />
        )}
      </div>

      <Field label="Soffit baffles" className="max-w-[10rem]">
        <Num
          value={takeoff.baffles}
          step={1}
          onChange={(v) => set({ baffles: v })}
        />
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          ${money(e.baffleEach)} each
        </p>
      </Field>

      <LabourPanel
        detail={detail}
        crewSize={takeoff.crewSize}
        onCrewSize={(v) => set({ crewSize: v })}
        crew={crew}
        emptyHint="Enter the area first."
      />

      <Field label="Scope notes">
        <textarea
          value={takeoff.notes || ""}
          onChange={(e2) => set({ notes: e2.target.value })}
          rows={2}
          className={inputClass}
          placeholder="Access, hatch location, anything the crew needs to know"
        />
      </Field>
    </div>
  );
}

const TAKEOFFS = {
  stairs: StairsTakeoff,
  countertop: CountertopTakeoff,
  garage_door: GarageDoorTakeoff,
  interior_painting: InteriorPaintTakeoff,
  exterior_painting: ExteriorPaintTakeoff,
  flooring: FlooringTakeoff,
  driveway_sealing: DrivewaySealingTakeoff,
  home_inspection: HomeInspectionTakeoff,
  paving: PavingTakeoff,
  roofing_service: RoofingTakeoff,
  siding: SidingTakeoff,
  insulation: InsulationTakeoff,
  snow_removal: SnowRemovalTakeoff,
};

export function hasTakeoff(categoryKey) {
  return Boolean(TAKEOFFS[categoryKey]);
}

export default function TradeTakeoff({
  categoryKey,
  takeoff,
  book,
  onChange,
  // An aerial tile of the client's address, when the page has one. Optional:
  // the designer draws on a blank grid without it, so a quote for a client
  // whose address failed to geocode still measures.
  siteImageUrl = "",
  // The client's address, for the trades that measure off it rather than draw
  // on it. Separate from siteImageUrl because a roof is measured by Google's
  // 3-D model, not by tracing a photo — there is nothing to show.
  siteAddress = "",
}) {
  const Component = TAKEOFFS[categoryKey];
  if (!Component || !takeoff || !book) return null;
  return (
    <div className="space-y-3 pb-4 border-b border-border">
      <Component
        takeoff={takeoff}
        book={book}
        onChange={onChange}
        siteImageUrl={siteImageUrl}
        siteAddress={siteAddress}
      />
    </div>
  );
}
