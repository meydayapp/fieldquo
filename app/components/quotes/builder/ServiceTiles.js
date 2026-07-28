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
"use client";

import { useState } from "react";
import {
  Paintbrush,
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
  Package,
  ChevronRight,
  Plus,
} from "lucide-react";
import { getSectionPresets } from "@/app/data/sectionPresets";
import { resolveServiceContent } from "@/lib/documents/serviceContent";

// Curated rather than `import * as Icons from "lucide-react"` and indexing by
// name. Dynamic property access defeats tree-shaking and would pull the entire
// icon library — around a thousand components — into the bundle to render at
// most a dozen tiles.
const ICONS = {
  Paintbrush,
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
  Package,
};

function iconFor(category) {
  return ICONS[category.icon] || Package;
}

export default function ServiceTiles({ categories = [], onAdd }) {
  // Which tile is showing its section presets. One at a time — two open
  // accordions on a phone means the tiles below are off-screen.
  const [expanded, setExpanded] = useState(null);

  if (!categories.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">Add a service</h2>
        <p className="text-sm text-muted-foreground">
          No services enabled yet — go to Settings → Services to turn some on.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-card border border-border rounded-xl p-5"
      data-tour="service-picker"
    >
      <h2 className="font-semibold text-foreground mb-1">Add a service</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Tap one to add it to this quote. Your own pricing fills in
        automatically.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {categories.map((cat) => {
          const Icon = iconFor(cat);
          const presets = getSectionPresets(cat.key);
          // Same resolver the document uses, so the colour on this tile is
          // the colour on the client's copy.
          const accent = resolveServiceContent(cat.key).accent;
          const isOpen = expanded === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() =>
                presets ? setExpanded(isOpen ? null : cat.id) : onAdd(cat, cat.label)
              }
              className={`group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
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

              <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                {presets ? (
                  <>
                    {presets.length} options
                    <ChevronRight
                      size={12}
                      className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    Add
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Presets for the open tile, full width beneath the grid rather than
          inside it — a tile that grows taller than its neighbours pushes the
          whole grid around and loses the user's place. */}
      {expanded &&
        (() => {
          const cat = categories.find((c) => c.id === expanded);
          const presets = cat ? getSectionPresets(cat.key) : null;
          if (!cat || !presets) return null;
          const accent = resolveServiceContent(cat.key).accent;

          return (
            <div
              className="mt-3 rounded-xl border p-3"
              style={{ borderColor: `${accent}55`, backgroundColor: `${accent}0a` }}
            >
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {cat.label} — pick a section
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
                  Something else
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
