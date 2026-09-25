// app/components/quotes/builder/ServiceTiles.js
//
// Picking what work goes on the quote.
//
// ── What this replaces ──────────────────────────────────────────────────────
//
// A row of grey pill buttons reading "+ Interior Painting". Functional, and
// the plainest thing on the first screen anyone sees when creating a quote —
// which is also the screen they'll be looking at in a driveway on a phone,
// one-handed, with a client watching.
//
// Tiles are bigger tap targets, they carry the trade's accent colour, and that
// accent is the same one that ends up on the scope card in the finished
// document. So the builder and the thing the client receives visibly belong to
// each other, rather than being two unrelated screens that happen to share a
// database.
//
// ── Only their trades ───────────────────────────────────────────────────────
//
// The caller passes categories already filtered to `enabled`. A painter sees
// three tiles, not sixty. Showing everything would be more "discoverable" and
// would make the picker useless on a phone, which is where it's used.
//
// ── Section presets are preserved ───────────────────────────────────────────
//
// Some trades have known sub-sections (a staircase quote has Main Staircase,
// Upper, Basement). Those were one-click buttons and remain one-click here:
// the tile expands to show them rather than dropping the user into a group
// they then have to rename. That behaviour is load-bearing and easy to lose in
// a redesign, so it's the first thing this component was built around.
//
// ── Two shapes, one component ───────────────────────────────────────────────
//
// `variant="card"` (the default) is the picker the classic builder puts at the
// top of an empty quote: a titled card with a tile grid. `variant="row"` is
// the same data as a compact strip of pills, for the foot of the document
// layout where a full card between the last service and the totals would push
// the money off the screen.
//
// A copy would have been easier and would have rotted: the icon map, the
// accent resolver and the section presets are the load-bearing parts, and the
// second copy is the one nobody looks at. So the shapes differ and the rules
// do not.
//
// ── Adding the same service twice is allowed, deliberately ──────────────────
//
// Nothing here filters out a category already on the quote. A painter quoting
// interior AND exterior, a contractor doing the floor and the countertop —
// it's the same job, just a different scoped item, and each group carries its
// own takeoff, its own scope paragraph and its own add-ons into one total.
"use client";

import { useState } from "react";
import {
  Paintbrush,
  PaintRoller,
  Home,
  Layers,
  Grid2x2,
  MoveUp,
  Hammer,
  Wrench,
  Zap,
  Wind,
  Square,
  Truck,
  HardHat,
  PanelTop,
  Sparkles,
  Trees,
  Droplets,
  Droplet,
  Building,
  Building2,
  Sprout,
  PawPrint,
  Waves,
  Trash2,
  Snowflake,
  Ruler,
  Lock,
  Flame,
  Fence,
  DoorClosed,
  Car,
  Bug,
  Package,
  ChevronRight,
  Plus,
} from "lucide-react";
import { getSectionPresets } from "@/app/data/sectionPresets";
import { useTranslation } from "@/app/hooks/useTranslation";
import { resolveServiceContent } from "@/lib/documents/serviceContent";

// Curated rather than `import * as Icons from "lucide-react"` and indexing by
// name. Dynamic property access defeats tree-shaking and would pull the entire
// icon library — around a thousand components — into the bundle to render at
// most a dozen tiles.
//
// Every icon name lib/trades/catalog.js uses is here. It was not: the map
// carried seventeen names and the catalogue used thirty-two, so Interior
// Painting (PaintRoller), Pool & Spa (Waves), Fencing (Fence) and a dozen
// others drew the Package box. scripts/check-paint-rate-sets.mjs keeps the two
// lists equal.
const ICONS = {
  Paintbrush,
  PaintRoller,
  Home,
  Layers,
  Grid2x2,
  MoveUp,
  Hammer,
  Wrench,
  Zap,
  Wind,
  Square,
  Truck,
  HardHat,
  PanelTop,
  Sparkles,
  Trees,
  Droplets,
  Droplet,
  Building,
  Building2,
  Sprout,
  PawPrint,
  Waves,
  Trash2,
  Snowflake,
  Ruler,
  Lock,
  Flame,
  Fence,
  DoorClosed,
  Car,
  Bug,
  Package,
};

function iconFor(category) {
  return ICONS[category.icon] || Package;
}

// `documentLanguage` is the QUOTE's language, not the reader's: a section
// preset becomes the scope group's label on the document the client reads.
//
// `details(cat)` (optional, card shape only) → { description, priceHint,
// templates: [{ id, name, count, onAdd }] } — what the owner asked a service
// card to say (2026-09-22): what the service is, roughly what it costs, and,
// when the company's own service carries an estimate template, a second
// action that adds the service WITH its template lines. The caller computes
// all of it (it holds the products, the wording and the money formatter);
// this component only draws it, and draws nothing for a field that is absent
// rather than a placeholder.
export default function ServiceTiles({ categories = [], onAdd, documentLanguage, variant = "card", details = null }) {
  const { t } = useTranslation();
  // Which tile is showing its section presets. One at a time — two open
  // accordions on a phone means the tiles below are off-screen.
  const [expanded, setExpanded] = useState(null);
  // Which card is showing every one of its templated services.
  const [allTemplates, setAllTemplates] = useState(null);
  const row = variant === "row";

  // The presets for whichever tile is open, drawn below the tiles in both
  // shapes — a tile that grows taller than its neighbours pushes the whole
  // grid around and loses the user's place.
  const presetPanel = (() => {
    if (!expanded) return null;
    const cat = categories.find((c) => c.id === expanded);
    const presets = cat ? getSectionPresets(cat.key, documentLanguage) : null;
    if (!cat || !presets) return null;
    const accent = resolveServiceContent(cat.key).accent;
    return (
      <div
        className="mt-3 rounded-xl border p-3"
        style={{ borderColor: `${accent}55`, backgroundColor: `${accent}0a` }}
        data-service-presets
      >
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {t("app.serviceTiles.pickSection", { label: cat.label })}
        </p>
        <div className="flex flex-wrap gap-2">
          {presets.map((sectionLabel) => (
            <button
              key={sectionLabel}
              type="button"
              onClick={() => {
                onAdd(cat, sectionLabel);
                setExpanded(null);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              <Plus size={13} style={{ color: accent }} />
              {sectionLabel}
            </button>
          ))}
          {/* An escape hatch: the presets are common cases, not the only
              ones. Without this, a trade with presets loses the ability
              to add a plainly-labelled group at all. */}
          <button
            type="button"
            onClick={() => {
              onAdd(cat, cat.label);
              setExpanded(null);
            }}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus size={13} />
            {t("app.serviceTiles.somethingElse")}
          </button>
        </div>
      </div>
    );
  })();

  if (!categories.length) {
    // The row shape has no card of its own, so the "nothing enabled" case is
    // a sentence rather than an empty panel wedged into the document.
    if (row) {
      return (
        <p className="text-xs text-muted-foreground" data-service-tiles data-service-tiles-empty>
          {t(
            "app.quoteNew.noServicesEnabled",
            "No services enabled yet — go to Settings → Services to turn some on.",
          )}
        </p>
      );
    }
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">
          {t("app.quoteNew.addServiceHeading", "Add a service")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "app.quoteNew.noServicesEnabled",
            "No services enabled yet — go to Settings → Services to turn some on.",
          )}
        </p>
      </div>
    );
  }

  if (row) {
    return (
      <div data-tour="service-picker" data-service-tiles data-service-tiles-variant="row">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const Icon = iconFor(cat);
            const presets = getSectionPresets(cat.key, documentLanguage);
            const accent = resolveServiceContent(cat.key).accent;
            const isOpen = expanded === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  presets ? setExpanded(isOpen ? null : cat.id) : onAdd(cat, cat.label)
                }
                data-service-tile={cat.key || cat.id}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] text-foreground transition-colors"
                style={
                  isOpen
                    ? { backgroundColor: `${accent}14`, borderColor: accent }
                    : { borderColor: "var(--border)" }
                }
                onMouseEnter={(e) => {
                  if (!isOpen) e.currentTarget.style.backgroundColor = `${accent}0d`;
                }}
                onMouseLeave={(e) => {
                  if (!isOpen) e.currentTarget.style.backgroundColor = "";
                }}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded shrink-0"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  <Icon size={12} />
                </span>
                <span className="leading-none">{cat.label}</span>
                {presets ? (
                  <ChevronRight
                    size={12}
                    className={`text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                ) : (
                  <Plus size={12} className="text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
        {presetPanel}
      </div>
    );
  }

  return (
    <div
      className="bg-card border border-border rounded-xl p-5"
      data-tour="service-picker"
      data-service-tiles
      data-service-tiles-variant="card"
    >
      <h2 className="font-semibold text-foreground mb-1">
        {t("app.quoteNew.addServiceHeading", "Add a service")}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {t(
          "app.quoteNew.addServiceHint",
          "Tap one to add it to this quote. Your own pricing fills in automatically.",
        )}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {categories.map((cat) => {
          const Icon = iconFor(cat);
          const presets = getSectionPresets(cat.key, documentLanguage);
          // Same resolver the document uses, so the colour on this tile is
          // the colour on the client's copy.
          const accent = resolveServiceContent(cat.key).accent;
          const isOpen = expanded === cat.id;
          const info = details ? details(cat) || {} : {};
          const templates = Array.isArray(info.templates) ? info.templates : [];

          return (
            <div key={cat.id} className="flex flex-col gap-1 min-w-0" data-service-card={cat.key || cat.id}>
            <button
              type="button"
              onClick={() =>
                presets ? setExpanded(isOpen ? null : cat.id) : onAdd(cat, cat.label)
              }
              data-service-tile={cat.key || cat.id}
              className={`group relative flex flex-1 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                isOpen
                  ? "border-transparent"
                  : "border-border hover:border-transparent"
              }`}
              style={
                isOpen
                  ? { backgroundColor: `${accent}14`, borderColor: accent }
                  : undefined
              }
              onMouseEnter={(e) => {
                if (!isOpen) e.currentTarget.style.backgroundColor = `${accent}0d`;
              }}
              onMouseLeave={(e) => {
                if (!isOpen) e.currentTarget.style.backgroundColor = "";
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                <Icon size={18} />
              </span>

              <span className="text-sm font-medium text-foreground leading-tight">
                {cat.label}
              </span>

              {info.description ? (
                <span className="text-xs text-muted-foreground leading-snug line-clamp-2" data-service-card-description>
                  {info.description}
                </span>
              ) : null}
              {info.priceHint ? (
                <span className="text-xs font-medium text-foreground tabular-nums" data-service-card-price>
                  {info.priceHint}
                </span>
              ) : null}

              <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5 mt-auto">
                {presets ? (
                  <>
                    {t("app.serviceTiles.options", { count: presets.length })}
                    <ChevronRight
                      size={12}
                      className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    {t("app.action.add")}
                  </>
                )}
              </span>
            </button>
            {/* The second way in: the company's own service, with the lines
                its estimate template writes (lib/quotes/serviceTemplateLines
                .js) — one per templated service linked to this trade. A
                sibling of the tile, never inside it: a button in a button is
                two targets a thumb cannot tell apart. */}
            {/* Three, then the rest behind one press — a trade whose eleven
                services all carry a template would otherwise be a column
                eleven actions tall beside a row of one-line cards. */}
            {(allTemplates === cat.id ? templates : templates.slice(0, 3)).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={tpl.onAdd}
                className="inline-flex items-start gap-1 rounded-lg px-2 py-1 text-left text-[11px] font-medium text-foreground hover:bg-muted"
                data-service-card-template={tpl.id}
              >
                <Plus size={11} className="mt-0.5 shrink-0" style={{ color: accent }} />
                <span className="min-w-0">
                  {templates.length > 1 ? `${tpl.name} — ` : ""}
                  {/* The library's own words for the same action, so the
                      card and the dialog name it identically. */}
                  {t("app.templateLines.addWith", "Add with its template lines ({count})", { count: tpl.count })}
                  {tpl.note ? (
                    <span className="block font-normal text-muted-foreground" data-service-card-template-skipped>
                      {tpl.note}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
            {templates.length > 3 && allTemplates !== cat.id && (
              <button
                type="button"
                onClick={() => setAllTemplates(cat.id)}
                className="px-2 py-1 text-left text-[11px] text-muted-foreground underline underline-offset-2"
                data-service-card-more-templates
              >
                {t("app.serviceTiles.moreTemplates", "{count} more with template lines", { count: templates.length - 3 })}
              </button>
            )}
            </div>
          );
        })}
      </div>

      {/* Presets for the open tile, full width beneath the grid rather than
          inside it — a tile that grows taller than its neighbours pushes the
          whole grid around and loses the user's place. */}
      {expanded &&
        (() => {
          const cat = categories.find((c) => c.id === expanded);
          const presets = cat ? getSectionPresets(cat.key, documentLanguage) : null;
          if (!cat || !presets) return null;
          const accent = resolveServiceContent(cat.key).accent;

          return (
            <div
              className="mt-3 rounded-xl border p-3"
              style={{ borderColor: `${accent}55`, backgroundColor: `${accent}0a` }}
            >
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {t("app.serviceTiles.pickSection", { label: cat.label })}
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((sectionLabel) => (
                  <button
                    key={sectionLabel}
                    type="button"
                    onClick={() => {
                      onAdd(cat, sectionLabel);
                      setExpanded(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                  >
                    <Plus size={13} style={{ color: accent }} />
                    {sectionLabel}
                  </button>
                ))}
                {/* An escape hatch: the presets are common cases, not the only
                    ones. Without this, a trade with presets loses the ability
                    to add a plainly-labelled group at all. */}
                <button
                  type="button"
                  onClick={() => {
                    onAdd(cat, cat.label);
                    setExpanded(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Plus size={13} />
                  {t("app.serviceTiles.somethingElse")}
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
