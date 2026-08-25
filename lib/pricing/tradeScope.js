// lib/pricing/tradeScope.js
//
// Turn a per-trade takeoff (how many treads, how many square feet, which
// add-ons) into quote line items priced from that trade's book.
//
// Pure — no database, no request, no React. Every rate arrives via the `book`
// argument, so this runs against hostile input in a check script with no
// network and no key, which is where the arithmetic bugs actually get caught.
//
// Line items use fieldquo's existing shape — { description, quantity, unit,
// rate, amount } — NOT TrueFinish's { title, unitPrice, total }. The scope
// groups, the PDF and the invoice already read fieldquo's shape; introducing a
// second one would mean every renderer learning to speak both.

import { getPriceBook } from "@/app/data/tradePriceBooks";
import {
  pitchBand,
  roofLabour,
  slopedAreaSqft,
  SQFT_PER_SQUARE,
} from "@/lib/pricing/roofLabour";
import { paverLabour } from "@/lib/pricing/paverLabour";
import { insulationTakeoff } from "@/lib/pricing/insulation";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Round money to cents. Guards a Decimal column against 0.1+0.2 dust. */
const money = (v) => {
  const n = num(v);
  return Math.round(n * 100) / 100;
};

// Own-property lookup. A material or band key arrives from stored JSON, and
// BOOK.materials["__proto__"] is truthy on any plain object — which would hand
// the caller Object.prototype and price a roof off it. Same guard, same reason,
// as the one in app/data/tradePriceBooks.js.
const ownKey = (map, key) =>
  map &&
  typeof map === "object" &&
  Object.prototype.hasOwnProperty.call(map, key)
    ? map[key]
    : undefined;

function line(description, { quantity = 1, unit = "flat", rate = 0 } = {}) {
  const q = num(quantity);
  const r = money(rate);
  return { description, quantity: q, unit, rate: r, amount: money(q * r) };
}

/* ── Markup ────────────────────────────────────────────────────────────── */

/**
 * Client price for a line quoted from a supplier's invoice.
 *
 * The cost and the percentage are INTERNAL. Callers put the result in `rate`
 * and keep `supplierCost` out of anything the client reads — same rule the
 * QuoteImport model already follows for subcontractor pricing, and the reason
 * TrueFinish leaves the countertop line's description deliberately blank.
 *
 * A per-line `override` wins when set: sometimes you match a competitor's
 * number and back into the margin rather than the other way round.
 */
export function clientPriceFromCost(cost, markupPct, override) {
  const o = num(override);
  if (o > 0) return money(o);
  const c = num(cost);
  if (c <= 0) return 0;
  const pct = num(markupPct);
  // A negative markup is a discount, which is legitimate; below -100% is not.
  return money(c * (1 + Math.max(-100, pct) / 100));
}

/**
 * What the doors on a refacing job COST — never a client-facing number.
 *
 * Refinishing recoats the doors you already have, so it has no purchased-door
 * cost; only refacing buys them. Rates come from real supplier quotes (see
 * app/data/tradePriceBooks.js) and are per square foot of face, so a door
 * count is turned into area using the book's average door and drawer sizes.
 *
 * @returns {{doorCost:number, drawerCost:number, freight:number, total:number,
 *            sqft:number, material:object|null}|null} null when the trade
 *            buys no doors.
 */
export function estimateCabinetDoorCost(config, book) {
  const material = cabinetMaterial(config, book);
  if (!material) return null;

  const doors = num(config?.doors);
  const drawers = num(config?.drawers);
  const doorSqft = doors * num(book.avgDoorSqft);
  const drawerSqft = drawers * num(book.avgDrawerSqft);

  // A shop that sprays in-house pays for the raw blank, not the finished one.
  const perSqft =
    config?.finishInHouse && num(material.rawCostPerSqft) > 0
      ? num(material.rawCostPerSqft)
      : num(material.costPerSqft);

  const doorCost = money(doorSqft * perSqft);
  const drawerCost = money(drawerSqft * perSqft);
  // Caron ships free at 20 doors; below that the order carries freight.
  const freight = doors + drawers >= 20 ? 0 : money(book.freightPerOrder);

  return {
    material,
    perSqft,
    sqft: money(doorSqft + drawerSqft),
    doorCost,
    drawerCost,
    freight,
    total: money(doorCost + drawerCost + freight),
  };
}

/* ── Per-trade builders ────────────────────────────────────────────────── */

/** The door spec chosen on a refacing quote, or null for refinishing. */
export function cabinetMaterial(config, book) {
  const materials = book?.doorMaterials;
  if (!materials) return null;
  const key = config?.doorMaterial || book.defaultMaterial;
  return materials[key] ? { key, ...materials[key] } : null;
}

/**
 * The upgrade lines on a cabinet job — hinges, handle holes, slides, extra
 * colours.
 *
 * Exported because two screens sell these: the takeoff path via buildCabinets,
 * and the unit-priced cabinet builder in /app/quotes/new, which prices its
 * base scope itself (units × final unit price) but had no way to add an
 * upgrade at all. A company could edit `softCloseHingesPerDoor` in Settings
 * and never put soft-close hinges on a quote. One definition rather than two,
 * because the copy is the one that rots.
 *
 * @param {{doors:number, drawers:number, handleHoles?:boolean,
 *          softCloseHinges?:boolean, drawerSlides?:boolean,
 *          twoTone?:boolean, threeTone?:boolean}} config
 * @param {object} book the trade's price book
 */
export function cabinetAddOnLines(config, book) {
  const items = [];
  const a = book?.addOns || {};
  const doors = num(config?.doors);
  const drawers = num(config?.drawers);

  // Named for what happens to the cabinet, not for the operation. "New handle
  // holes (drilling)" was flagged by the quote reviewer as a line a client
  // cannot judge, and it was right: it says an action without saying what the
  // action is done to. Who supplies the handles is deliberately still absent —
  // that varies by company, and inventing it here would put a supply promise in
  // somebody's quote. The service scope paragraph carries the boundary.
  if (config?.handleHoles && doors > 0) {
    items.push(
      line("New handle holes drilled in the doors", {
        quantity: doors,
        unit: "door",
        rate: a.handleHolesPerDoor,
      }),
    );
  }
  if (config?.softCloseHinges && doors > 0) {
    items.push(
      line("Soft-close hinges", {
        quantity: doors,
        unit: "door",
        rate: a.softCloseHingesPerDoor,
      }),
    );
  }
  if (config?.drawerSlides && drawers > 0) {
    items.push(
      line("Drawer slides", {
        quantity: drawers,
        unit: "drawer",
        rate: a.drawerSlidesPerDrawer,
      }),
    );
  }

  // Two- and three-tone are flat + per unit. Three-tone supersedes two-tone
  // rather than stacking: a third colour already includes the second.
  const units = doors + drawers;
  if (config?.threeTone) {
    items.push(
      line("Three-colour finish", {
        rate: num(a.threeToneFlat) + num(a.threeTonePerUnit) * units,
      }),
    );
  } else if (config?.twoTone) {
    items.push(
      line("Two-tone finish", {
        rate: num(a.twoToneFlat) + num(a.twoTonePerUnit) * units,
      }),
    );
  }

  return items.filter((i) => Number.isFinite(i.amount) && i.amount > 0);
}

function buildCabinets(config, book) {
  const items = [];
  const doors = num(config.doors);
  const drawers = num(config.drawers);
  const level = config.complexityLevel || "standard";
  const uplift = num(book.complexityUpchargePerUnit?.[level]);

  // Refacing sells per door like refinishing, but the door you fit sets the
  // rate — a thermofoil front and a white oak front are not the same job. An
  // explicit per-quote override still wins over both.
  const material = cabinetMaterial(config, book);
  const baseDoor =
    num(config.perDoorOverride) > 0
      ? num(config.perDoorOverride)
      : num(material?.sellPerDoor) || num(book.perDoor);
  const baseDrawer =
    num(config.perDrawerOverride) > 0
      ? num(config.perDrawerOverride)
      : num(material?.sellPerDrawer) || num(book.perDrawer);

  const doorRate = baseDoor + uplift;
  const drawerRate = baseDrawer + uplift;
  const suffix = material ? ` (${material.label})` : "";

  if (doors > 0) {
    items.push(
      line(`${book.label} — doors${suffix}`, {
        quantity: doors,
        unit: "door",
        rate: doorRate,
      }),
    );
  }
  if (drawers > 0) {
    items.push(
      line(`${book.label} — drawer fronts${suffix}`, {
        quantity: drawers,
        unit: "drawer",
        rate: drawerRate,
      }),
    );
  }

  items.push(...cabinetAddOnLines({ doors, drawers, ...config }, book));

  // The minimum tops the job UP to the floor; it is not an extra fee on a job
  // that already clears it, and it must never reduce a larger total.
  const runningTotal = items.reduce((s, i) => s + i.amount, 0);
  const minimum = num(book.minimumTotal);
  if (items.length > 0 && minimum > 0 && runningTotal < minimum) {
    items.push(
      line("Job minimum adjustment", { rate: minimum - runningTotal }),
    );
  }

  return items;
}

function buildStairs(config, book) {
  const items = [];
  for (const section of asArray(config.sections)) {
    const level = section.complexityLevel || "standard";
    const c = book.complexity?.[level] || book.complexity?.standard || {};
    const title = section.title || "Staircase";

    // The complexity tier seeds each rate; the estimator can then type over
    // any one of them on the line. An override of 0 is meaningful ("include
    // this at no charge"), so only undefined/null falls back to the book.
    const rateFor = (key) => {
      const override = section[`${key}Override`];
      return override === undefined || override === null || override === ""
        ? c[key]
        : override;
    };

    const treads = num(section.treads);
    if (treads > 0) {
      items.push(
        line(`${title} — treads`, {
          quantity: treads,
          unit: "tread",
          rate: rateFor("treadPrice"),
        }),
      );
    }
    // Risers, balusters and posts only bill when the estimator opted in —
    // counting them for reference must not silently charge for them.
    if (section.paintRisers && num(section.risers) > 0) {
      items.push(
        line(`${title} — risers`, {
          quantity: num(section.risers),
          unit: "riser",
          rate: rateFor("riserPrice"),
        }),
      );
    }
    if (section.paintBalusters && num(section.balusters) > 0) {
      items.push(
        line(`${title} — balusters`, {
          quantity: num(section.balusters),
          unit: "each",
          rate: rateFor("balusterPrice"),
        }),
      );
    }
    if (section.paintPosts && num(section.posts) > 0) {
      items.push(
        line(`${title} — newel posts`, {
          quantity: num(section.posts),
          unit: "each",
          rate: rateFor("postPrice"),
        }),
      );
    }
    if (num(section.handrailFt) > 0) {
      items.push(
        line(`${title} — handrail`, {
          quantity: num(section.handrailFt),
          unit: "lf",
          rate: rateFor("handrailPricePerFt"),
        }),
      );
    }
    if (num(section.landingSqft) > 0) {
      items.push(
        line(`${title} — landing`, {
          quantity: num(section.landingSqft),
          unit: "sqft",
          rate: rateFor("landingPricePerSqft"),
        }),
      );
    }
    if (section.twoTone) {
      items.push(
        line(`${title} — two-tone finish`, {
          rate: rateFor("twoToneSurcharge"),
        }),
      );
    }
  }

  if (config.basement && num(config.basementTreads) > 0) {
    items.push(
      line("Basement stairs — treads", {
        quantity: num(config.basementTreads),
        unit: "tread",
        rate: book.basementTreadPrice,
      }),
    );
  }
  return items;
}

function buildFlooring(config, book) {
  const items = [];
  for (const section of asArray(config.sections)) {
    const level = section.complexityLevel || "standard";
    const c = book.complexity?.[level] || book.complexity?.standard || {};
    const sqft = num(section.sqft);
    if (sqft <= 0) continue;
    const title = section.title || "Hardwood flooring";

    const detail = [section.woodSpecies, section.finishType]
      .filter(Boolean)
      .join(" · ");
    items.push(
      line(
        detail
          ? `${title} — refinishing (${detail})`
          : `${title} — refinishing`,
        {
          quantity: sqft,
          unit: "sqft",
          rate: c.pricePerSqft,
        },
      ),
    );

    if (section.stainChange) {
      items.push(
        line(`${title} — stain colour change`, {
          quantity: sqft,
          unit: "sqft",
          rate: c.stainChangePricePerSqft,
        }),
      );
    }
    if (section.gapFilling) {
      items.push(
        line(`${title} — gap filling`, {
          quantity: sqft,
          unit: "sqft",
          rate: c.gapFillingPricePerSqft,
        }),
      );
    }
    if (section.waterDamageRepair) {
      items.push(
        line(`${title} — water damage repair`, { rate: c.waterDamagePrice }),
      );
    }
    if (section.furnitureMoving) {
      items.push(
        line(`${title} — furniture moving`, { rate: c.furnitureMovingPrice }),
      );
    }
    if (section.stairBlending) {
      items.push(
        line(`${title} — stair blending`, { rate: c.stairBlendingPrice }),
      );
    }
  }
  return items;
}

function buildCountertop(config, book) {
  const markupPct = config.markupPct ?? book.defaultMarkupPct;
  const heights = book.backsplashHeights || {};
  const items = [];

  for (const item of asArray(config.items)) {
    if (!item.enabled) continue;
    const rate = clientPriceFromCost(
      item.supplierCost,
      markupPct,
      item.override,
    );
    if (rate <= 0) continue;

    // Label only. The supplier's cost and the margin stay out of the document
    // entirely — not in the description, not in a note.
    let label = item.label;
    if (item.id === "countertop" && config.materialType) {
      label = `${config.materialType} Countertop Supply & Installation`;
    } else if (item.id === "backsplash") {
      label = heights[item.heightOption || "4in"] || "Backsplash";
    }
    items.push(line(label, { rate }));
  }
  return items;
}

function buildInteriorPaint(config, book) {
  const items = [];
  for (const room of asArray(config.rooms)) {
    const level = room.complexityLevel || "standard";
    const c = book.complexity?.[level] || book.complexity?.standard || {};
    const title = room.title || "Room";
    const sqft = num(room.sqft);

    if (room.walls && sqft > 0) {
      items.push(
        line(`${title} — walls`, {
          quantity: sqft,
          unit: "sqft",
          rate: c.wallPricePerSqft,
        }),
      );
    }
    if (room.ceiling)
      items.push(line(`${title} — ceiling`, { rate: c.ceilingPrice }));
    if (room.trim) items.push(line(`${title} — trim`, { rate: c.trimPrice }));
    if (room.doors && num(room.doorsCount) > 0) {
      items.push(
        line(`${title} — doors`, {
          quantity: num(room.doorsCount),
          unit: "door",
          rate: c.doorPrice,
        }),
      );
    }
    if (room.closets && num(room.closetsCount) > 0) {
      items.push(
        line(`${title} — closets`, {
          quantity: num(room.closetsCount),
          unit: "each",
          rate: c.closetPrice,
        }),
      );
    }
    if (room.colorChange)
      items.push(
        line(`${title} — colour change`, { rate: c.colorChangeSurcharge }),
      );
    if (room.drywallPrep)
      items.push(line(`${title} — drywall prep`, { rate: c.drywallPrepPrice }));
  }

  const g = book.global || {};
  if (config.popcornRemoval && num(config.popcornSqft) > 0) {
    items.push(
      line("Popcorn ceiling removal", {
        quantity: num(config.popcornSqft),
        unit: "sqft",
        rate: g.popcornRemovalPricePerSqft,
      }),
    );
  }
  if (config.furnitureMoving)
    items.push(line("Furniture moving", { rate: g.furnitureMovingPrice }));
  return items;
}

function buildExteriorPaint(config, book) {
  const level = config.complexityLevel || "standard";
  const c = book.complexity?.[level] || book.complexity?.standard || {};
  const items = [];

  for (const item of asArray(config.items)) {
    if (!item.enabled) continue;
    const qty = num(item.quantity);
    if (qty <= 0) continue;
    // Fixtures are flat per item; surfaces move with the complexity grid.
    const bookItem = (book.items || []).find((i) => i.id === item.id) || item;
    const baseRate =
      bookItem.priceType === "flat"
        ? num(bookItem.flatPrice)
        : num(c[bookItem.priceType]);
    const rate = num(item.override) > 0 ? num(item.override) : baseRate;
    if (rate <= 0) continue;
    items.push(
      line(bookItem.label || item.id, {
        quantity: qty,
        unit: bookItem.unit || "each",
        rate,
      }),
    );
  }

  const e = book.extras || {};
  if (config.pressureWashing)
    items.push(line("Pressure washing", { rate: e.pressureWashingPrice }));
  if (config.priming && num(config.primeSqft) > 0) {
    items.push(
      line("Priming", {
        quantity: num(config.primeSqft),
        unit: "sqft",
        rate: e.primePricePerSqft,
      }),
    );
  }
  return items;
}

/**
 * Garage doors — supply and install.
 *
 * A door is a unit, not an area, so the takeoff is "which model, how many".
 * The only subtlety is what the door's price covers. `installIncluded` is on
 * by default because that is how the trade sells; when a company turns it off
 * the door becomes supply-only (its price drops by the install rate) and a
 * separate Installation line carries the labour, so the client can see both
 * numbers instead of one that quietly means something different.
 *
 * No installation line is emitted when the rate is 0. The alternative — a
 * "$0.00 Installation" row — reads to a client as a promise of free labour,
 * and the takeoff screen says plainly that no rate is set.
 */
function buildGarageDoor(config, book) {
  const items = [];
  const installIncluded = config.installIncluded !== false;
  const installRate = num(book.installPricePerDoor);

  // Only descriptive text that is TRUE of this quote. The install note is
  // dropped on a supply-only quote; the warranty note travels with the door
  // because it is the manufacturer's, not the company's workmanship.
  const specParts = [
    book.doorSpec,
    installIncluded ? book.installNote : null,
    book.warrantyNote,
  ]
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  const suffix = specParts.length ? ` — ${specParts.join(" · ")}` : "";

  let doorCount = 0;

  for (const [id, entry] of Object.entries(book.doors || {})) {
    const picked = asArray(config.doors).find((d) => d.id === id);
    const qty = num(picked?.quantity);
    if (qty <= 0) continue;
    const listPrice =
      num(picked?.override) > 0 ? num(picked.override) : num(entry.price);
    // Supply-only sells the same door for less; the labour reappears below.
    const rate = installIncluded
      ? listPrice
      : Math.max(0, listPrice - installRate);
    if (rate <= 0) continue;
    doorCount += qty;
    items.push(
      line(`${entry.label}${suffix}`, { quantity: qty, unit: "door", rate }),
    );
  }

  for (const [id, entry] of Object.entries(book.capping || {})) {
    const picked = asArray(config.capping).find((c) => c.id === id);
    const qty = num(picked?.quantity);
    if (qty <= 0) continue;
    const rate =
      num(picked?.override) > 0 ? num(picked.override) : num(entry.price);
    if (rate <= 0) continue;
    items.push(line(entry.label, { quantity: qty, unit: "each", rate }));
  }

  if (!installIncluded && doorCount > 0 && installRate > 0) {
    items.push(
      line(
        String(book.installNote || "Professional installation").replace(
          /\s*included\s*$/i,
          "",
        ),
        {
          quantity: doorCount,
          unit: "door",
          rate: installRate,
        },
      ),
    );
  }

  return items;
}

/**
 * Driveway sealing.
 *
 * Priced off the surface, not the depth: sealcoating recoats what is already
 * there. The one thing that has to be visible on the quote is the coat count,
 * because every source in the research ties the reseal interval to it — one
 * coat lasts two to three years, two lasts four — and a client comparing two
 * numbers cannot see that difference unless the document says it.
 */
function buildDrivewaySealing(config, book) {
  const items = [];
  const level = config.complexityLevel || "standard";
  const c = book.complexity?.[level] || book.complexity?.standard || {};
  const e = book.extras || {};
  const sqft = num(config.sqft);
  if (sqft <= 0) return items;

  const coats = config.twoCoats ? 2 : 1;
  const rate = num(c.sealPricePerSqft);
  // The second coat is a multiple of the first rather than a separate rate,
  // so a company that changes its sealing price doesn't have to remember to
  // change a second number to match.
  const multiplier = config.twoCoats
    ? 1 +
      (Number.isFinite(num(book.secondCoatMultiplier))
        ? num(book.secondCoatMultiplier)
        : 1)
    : 1;

  if (rate > 0) {
    items.push(
      line(`Asphalt sealing — ${coats} coat${coats === 1 ? "" : "s"}`, {
        quantity: sqft,
        unit: "sqft",
        rate: money(rate * multiplier),
      }),
    );
  }

  if (config.premiumSealer && num(e.premiumSealerPerSqft) > 0) {
    items.push(
      line("Premium sealer upgrade", {
        quantity: sqft,
        unit: "sqft",
        rate: e.premiumSealerPerSqft,
      }),
    );
  }

  // The included allowance is subtracted, not ignored: charging from the first
  // foot when the company advertises the first twenty free is the kind of
  // discrepancy a client finds and a contractor cannot explain.
  if (config.crackFilling) {
    const billable = Math.max(
      0,
      num(config.crackFt) - num(e.crackFillIncludedFt),
    );
    if (billable > 0 && num(e.crackFillPerFt) > 0) {
      items.push(
        line("Crack filling", {
          quantity: billable,
          unit: "linear ft",
          rate: e.crackFillPerFt,
        }),
      );
    }
  }

  if (config.pressureWash && num(e.pressureWashPerSqft) > 0) {
    items.push(
      line("Pressure wash", {
        quantity: sqft,
        unit: "sqft",
        rate: e.pressureWashPerSqft,
      }),
    );
  }
  if (config.stainTreatment && num(e.stainTreatmentPrice) > 0) {
    items.push(
      line("Oil / grease stain treatment", { rate: e.stainTreatmentPrice }),
    );
  }
  if (config.travelSurcharge && num(e.travelSurchargePrice) > 0) {
    items.push(line("Travel", { rate: e.travelSurchargePrice }));
  }

  // Tops the job UP to the floor, never reduces a larger total — same rule as
  // the cabinet minimum.
  const runningTotal = items.reduce((sum, i) => sum + i.amount, 0);
  const minimum = num(book.minimumTotal);
  if (items.length > 0 && minimum > 0 && runningTotal < minimum) {
    items.push(
      line("Job minimum adjustment", { rate: minimum - runningTotal }),
    );
  }

  return items;
}

/**
 * The band a house falls in, or null.
 *
 * Bands are a keyed map rather than an array — same reason as the garage door
 * catalogue: `mergeDeep` replaces arrays wholesale, so a company editing one
 * band price through the rate card would otherwise wipe the other eight. They
 * are sorted here by their own ceiling rather than trusted to be declared in
 * order, because a company can add a band and the rate card writes it wherever
 * the merge puts it.
 *
 * A house larger than every band still lands on the largest one rather than on
 * nothing — a 9,000 sq ft house that produced no inspection line at all would
 * be discovered by reading the quote, or worse by not reading it. The area
 * ABOVE the top band is charged separately; see buildHomeInspection.
 *
 * Object.entries is deliberate: band ids arrive from stored JSON, and a `for
 * (const id in ...)` would walk inherited keys. `__proto__` as a band id is
 * therefore not reachable here, and mergeDeep already refuses to write one.
 */
export function inspectionBandFor(bands, sqft) {
  const area = num(sqft);
  if (area <= 0) return null;
  const ordered = Object.entries(bands || {})
    .filter(([, band]) => band && typeof band === "object")
    .map(([id, band]) => ({
      id,
      ...band,
      // A missing or non-finite ceiling means open-ended. 1e400 arrives here as
      // Infinity; a band ceiling is company data rather than client input, so
      // reading it as "no ceiling" is the safe direction to fail.
      ceiling: Number.isFinite(Number(band.maxSqft))
        ? Number(band.maxSqft)
        : Infinity,
    }))
    .sort((a, b) => a.ceiling - b.ceiling);
  if (!ordered.length) return null;
  return (
    ordered.find((band) => area <= band.ceiling) || ordered[ordered.length - 1]
  );
}

/**
 * Home inspection.
 *
 * Priced from a square-footage band table, not per square foot: the inspector
 * charges the band the house falls in, and the invoice line names the band
 * ("Full Home Inspection - 3000-3499 sqft"). Multiplying an area by a rate
 * would produce a number no inspector's price list contains.
 *
 * Unlike the other builders, a zero square footage does NOT abandon the whole
 * scope. Radon testing, a WETT inspection and a warranty visit are all sold on
 * their own to people who are not buying a full inspection that day, and
 * dropping those lines because the sqft box is empty would be a control that
 * appears to work and doesn't.
 */
function buildHomeInspection(config, book) {
  const items = [];

  const sqft = num(config.sqft);
  const band = inspectionBandFor(book.bands, sqft);
  const bandPrice = num(band?.price);
  if (band && bandPrice > 0) {
    items.push(
      line(`Full home inspection — ${band.label || band.id}`, {
        rate: bandPrice,
      }),
    );

    // Area above the largest band, charged per 1,000 sq ft "or portion
    // thereof" — the wording two Ontario firms publish. Rounding up is the
    // published rule, not a thumb on the scale: 5,200 sq ft is charged as one
    // extra thousand, the same as 6,000 would be. Only reachable when the top
    // band has a finite ceiling; an open-ended top band is already all-in.
    const ceiling = Number(band.maxSqft);
    const per1000 = num(book.oversize?.pricePer1000Sqft);
    if (Number.isFinite(ceiling) && per1000 > 0 && sqft > ceiling) {
      const thousands = Math.ceil((sqft - ceiling) / 1000);
      items.push(
        line(
          book.oversize?.label ||
            "Additional square footage beyond the largest band",
          { quantity: thousands, unit: "per 1,000 sqft", rate: per1000 },
        ),
      );
    }
  }

  // Ancillary services are counts, not flags: two wood-burning appliances is
  // two WETT inspections, and a rural property can need more than one water
  // sample. A checkbox toggles between 0 and 1; the estimator types anything
  // higher.
  for (const [id, entry] of Object.entries(book.ancillary || {})) {
    if (!entry || typeof entry !== "object") continue;
    const qty = num(config.ancillary?.[id]);
    const rate = num(entry.price);
    // A zero-priced service is one FieldQuo ships no figure for. It stays in
    // the list so the estimator can see it exists and set a price, but it must
    // never reach a client's quote as a $0 line that reads as free.
    if (qty <= 0 || rate <= 0) continue;
    items.push(
      line(entry.label || id, {
        quantity: qty,
        unit: entry.unit || "each",
        rate,
      }),
    );
  }

  // The warranty inspection is its own product, not an add-on to a purchase
  // inspection: the client is a new-build owner at a Tarion milestone, and
  // most of them never buy a full inspection at all.
  const visits = num(config.warrantyVisits);
  const visitRate = num(book.warrantyInspection?.price);
  if (visits > 0 && visitRate > 0) {
    items.push(
      line(book.warrantyInspection.label || "Warranty inspection", {
        quantity: visits,
        unit: "visit",
        rate: visitRate,
      }),
    );
  }

  // Tops the job UP to the floor, never reduces a larger total — same rule as
  // the cabinet and sealing minimums.
  const runningTotal = items.reduce((sum, i) => sum + i.amount, 0);
  const minimum = num(book.minimumTotal);
  if (items.length > 0 && minimum > 0 && runningTotal < minimum) {
    items.push(
      line("Job minimum adjustment", { rate: minimum - runningTotal }),
    );
  }

  return items;
}

/**
 * Interlock and paving.
 *
 * The rate is INSTALLED — excavation, compacted base, bedding sand, edge
 * restraint and polymeric sand are inside it, because that is what the Ontario
 * contractors these rates come from include. The line item says so, since a
 * per-square-foot number a client is comparing against another quote is
 * meaningless without the scope attached.
 *
 * The paver choice adds only the DIFFERENCE over the allowance already inside
 * the rate. Adding the whole paver price would charge for the stone twice.
 */
function buildPaving(config, book) {
  const items = [];
  const level = config.complexityLevel || "standard";
  const c = book.complexity?.[level] || book.complexity?.standard || {};
  const e = book.extras || {};

  const SURFACES = [
    ["patio", "Interlock patio", "patioPricePerSqft"],
    ["walkway", "Interlock walkway", "walkwayPricePerSqft"],
    ["driveway", "Interlock driveway", "drivewayPricePerSqft"],
  ];

  const paver = book.paverOptions?.[config.paverOption] || null;
  const allowance = num(book.paverAllowancePerSqft);
  const paverCost =
    num(config.paverCostPerSqft) > 0
      ? num(config.paverCostPerSqft)
      : num(paver?.costPerSqft);
  // Only the excess. A stone at or under the allowance costs nothing extra.
  const paverUplift = Math.max(0, paverCost - allowance);

  let totalSqft = 0;

  for (const [key, label, rateKey] of SURFACES) {
    const sqft = num(config[`${key}Sqft`]);
    if (sqft <= 0) continue;
    let rate = num(c[rateKey]);
    if (key === "driveway") {
      // An 80 mm driveway paver over a 50 mm patio one.
      rate += num(e.drivewayPaverUpchargePerSqft);
    }
    if (rate <= 0) continue;
    totalSqft += sqft;
    items.push(
      line(
        `${label} — supplied and installed, including excavation, compacted base, edge restraint and polymeric sand`,
        { quantity: sqft, unit: "sqft", rate },
      ),
    );
    if (paverUplift > 0) {
      items.push(
        line(`${label} — ${paver?.label || "upgraded paver"}`, {
          quantity: sqft,
          unit: "sqft",
          rate: paverUplift,
        }),
      );
    }
  }

  if (totalSqft <= 0) return items;

  const perSqft = (flag, rateKey, label) => {
    if (!config[flag]) return;
    const rate = num(e[rateKey]);
    if (rate <= 0) return;
    items.push(line(label, { quantity: totalSqft, unit: "sqft", rate }));
  };

  // Wall face area, priced separately from the paved surface — a different
  // unit of work, and the invoice this rate comes from billed it as its own
  // section.
  const wallSqft = num(config.wallFaceSqft);
  if (wallSqft > 0 && num(book.wallPricePerFaceSqft) > 0) {
    items.push(
      line("Retaining / garden wall, including steps, base and capping", {
        quantity: wallSqft,
        unit: "sqft of face",
        rate: book.wallPricePerFaceSqft,
      }),
    );
  }

  perSqft(
    "removeExisting",
    "removeExistingPerSqft",
    "Remove and dispose of the existing surface",
  );
  perSqft("poorAccess", "poorAccessPerSqft", "Restricted site access");
  perSqft("curvesCuts", "curvesCutsPerSqft", "Curves, borders and cutting");
  perSqft("sealing", "sealingPerSqft", "Sealing");

  // Permeable is a percentage of the work above rather than a rate of its own,
  // which is how the two sources that price it express it.
  if (config.permeable) {
    const pct = num(e.permeableUpliftPct);
    const base = items.reduce((sum, i) => sum + i.amount, 0);
    if (pct > 0 && base > 0) {
      items.push(line("Permeable system", { rate: money((base * pct) / 100) }));
    }
  }

  const runningTotal = items.reduce((sum, i) => sum + i.amount, 0);
  const minimum = num(book.minimumTotal);
  if (items.length > 0 && minimum > 0 && runningTotal < minimum) {
    items.push(
      line("Job minimum adjustment", { rate: minimum - runningTotal }),
    );
  }

  return items;
}

/**
 * Snow removal, sold by the season.
 *
 * Seasonal rather than per-visit because that is how this trade sells in
 * Ottawa and how the contract this book's rates come from is written. The
 * season dates and the limit ride on the line item deliberately: "up to 250 cm
 * or 23 events of 4 cm+, whichever comes first" is the entire difference
 * between two numbers a homeowner is comparing, and a quote that omits it is
 * not comparable to one that includes it.
 */
export const DRIVEWAY_LABELS = {
  single: "Single driveway (1 car)",
  double: "Double driveway (2 cars side by side)",
  triple: "Triple or extended driveway",
  commercial: "Commercial lot",
};

function buildSnowRemoval(config, book) {
  const items = [];
  const e = book.extras || {};
  const season = book.season || {};
  const plan = book.plans?.[config.plan] || book.plans?.basic || null;
  if (!plan) return items;

  // The limit IS the price. "Up to 250 cm or 23 events of 4 cm+, whichever
  // comes first" is the entire difference between two numbers a homeowner is
  // comparing, and a quote that omits it is not comparable to one that
  // includes it. Same for the trigger depth, which is what separates the two
  // plans and is the only thing a client can actually feel in February.
  const limit = [
    season.snowfallLimitCm ? `up to ${num(season.snowfallLimitCm)} cm` : null,
    season.eventLimit
      ? `${num(season.eventLimit)} events of ${num(season.eventThresholdCm)} cm+`
      : null,
  ].filter(Boolean);
  const seasonText = [
    season.startsLabel && season.endsLabel
      ? `${season.startsLabel} to ${season.endsLabel}`
      : null,
    limit.length ? `${limit.join(" or ")}, whichever comes first` : null,
  ].filter(Boolean);
  const suffix = seasonText.length ? ` — ${seasonText.join(", ")}` : "";

  const driveRate = num(plan.driveways?.[config.drivewaySize]);
  const hasDriveway = driveRate > 0;
  if (hasDriveway) {
    const label = DRIVEWAY_LABELS[config.drivewaySize] || "Driveway";
    items.push(line(`${label} — ${plan.label}${suffix}`, { rate: driveRate }));
  }

  // Shovelling rides on the driveway service, because the contract this rate
  // comes from says it does: a company that will not send someone out for a
  // walkway alone should not be able to quote one here.
  if (config.shovelling && num(plan.shovelling) > 0) {
    if (hasDriveway || book.shovellingRequiresDriveway === false) {
      items.push(
        line(`Walkway and steps — ${plan.label}`, { rate: plan.shovelling }),
      );
    }
  }

  if (
    config.salting &&
    num(config.saltApplications) > 0 &&
    num(e.saltPerApplication) > 0
  ) {
    items.push(
      line("Salting", {
        quantity: num(config.saltApplications),
        unit: "application",
        rate: e.saltPerApplication,
      }),
    );
  }
  if (num(config.extraVisits) > 0 && num(e.perVisitPrice) > 0) {
    items.push(
      line("Additional visits", {
        quantity: num(config.extraVisits),
        unit: "visit",
        rate: e.perVisitPrice,
      }),
    );
  }

  if (items.length === 0) return items;

  // A discount must never invent money: capped at the total, and emitted as a
  // negative line the client can see rather than folded into the rate above.
  if (config.newClient && num(book.newClientDiscount) > 0) {
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    const discount = Math.min(num(book.newClientDiscount), total);
    if (discount > 0) {
      items.push(line("New client discount", { rate: -discount }));
    }
  }

  return items;
}

/* ── Roofing ───────────────────────────────────────────────────────────── */

/**
 * A re-roof, priced by the component rather than by the square.
 *
 * The satellite measurement gives area and pitch for free
 * (lib/measure/roofMeasurement.js); the estimator counts the details. Both of
 * those are why the tear-off, the valleys and the chimney get their own lines:
 * a client comparing three quotes can see WHAT the difference is, and an
 * estimator revising one can change the part that changed.
 *
 * `areaSqft` is the SLOPED surface. Pitch is a surcharge on the money and a
 * multiplier on the hours — it never multiplies the area, which is already
 * sloped. See the header of lib/pricing/roofLabour.js.
 */
function buildRoofing(config, book) {
  const items = [];
  const squares = roofSquares(config);
  if (squares <= 0) return items;

  const material =
    ownKey(book.materials, config.materialKey) ||
    ownKey(book.materials, book.defaultMaterial);

  if (material && num(material.pricePerSquare) > 0) {
    items.push(
      line(`${material.label} — supplied and installed`, {
        quantity: squares,
        unit: "square",
        rate: material.pricePerSquare,
      }),
    );
  }

  const layers = Math.max(0, Math.floor(num(config.layers)));
  const tear = book.tearOff || {};
  if (layers > 0 && num(tear.firstLayerPerSquare) > 0) {
    items.push(
      line("Tear off existing roof and dispose", {
        quantity: squares,
        unit: "square",
        rate: tear.firstLayerPerSquare,
      }),
    );
  }
  // Priced on the squares, not on a second full strip: the extra layers come
  // off a roof that is already open and already staged.
  if (layers > 1 && num(tear.additionalLayerPerSquare) > 0) {
    items.push(
      line(`Additional existing layers (${layers - 1})`, {
        quantity: squares * (layers - 1),
        unit: "square",
        rate: tear.additionalLayerPerSquare,
      }),
    );
  }

  const sheets = Math.max(0, Math.floor(num(config.deckSheets)));
  if (sheets > 0 && num(book.deckSheetPrice) > 0) {
    items.push(
      line("Replace damaged sheathing (allowance)", {
        quantity: sheets,
        unit: "sheet",
        rate: book.deckSheetPrice,
      }),
    );
  }

  const d = book.details || {};
  const linear = [
    ["Ice & water membrane", config.iceWaterFt, d.iceWaterPerLf],
    ["Drip edge", config.dripEdgeFt, d.dripEdgePerLf],
    ["Starter course", config.starterFt, d.starterPerLf],
    ["Valleys", config.valleyFt, d.valleyPerLf],
    ["Ridge and hip cap", config.ridgeHipFt, d.ridgeCapPerLf],
    ["Ridge vent", config.ridgeVentFt, d.ridgeVentPerLf],
    ["Step flashing to wall", config.stepFlashingFt, d.stepFlashingPerLf],
  ];
  for (const [label, ft, rate] of linear) {
    if (num(ft) > 0 && num(rate) > 0) {
      items.push(line(label, { quantity: num(ft), unit: "linear ft", rate }));
    }
  }

  for (const [id, entry] of Object.entries(book.penetrations || {})) {
    const qty = Math.max(0, Math.floor(num(config[PENETRATION_FIELDS[id]])));
    if (qty <= 0 || num(entry.price) <= 0) continue;
    items.push(
      line(entry.label, { quantity: qty, unit: "each", rate: entry.price }),
    );
  }

  // Last, and on the subtotal of everything above: the pitch makes every one of
  // those operations slower, not just the shingle laying.
  const band = pitchBand(num(config.pitchRise));
  const pct = num(ownKey(book.steepnessSurcharge, band.key));
  if (pct > 0) {
    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    if (subtotal > 0) {
      items.push(
        line(`Steep pitch — ${band.label.toLowerCase()}`, {
          quantity: 1,
          unit: "flat",
          rate: subtotal * pct,
        }),
      );
    }
  }

  return items;
}

/** Which takeoff field carries the count for each penetration in the book. */
const PENETRATION_FIELDS = {
  vent_boot: "ventBoots",
  box_vent: "boxVents",
  skylight: "skylights",
  chimney: "chimneys",
};

/**
 * Squares from whichever of the three the takeoff carries. Squares win, then
 * sloped sqft, then a typed footprint converted UP by the pitch — the only
 * place in the roofing path where pitch is allowed near an area.
 */
function roofSquares(config) {
  const c = config || {};
  if (num(c.squares) > 0) return money(num(c.squares));
  if (num(c.areaSqft) > 0) return money(num(c.areaSqft) / SQFT_PER_SQUARE);
  if (num(c.footprintSqft) > 0) {
    return money(
      slopedAreaSqft(c.footprintSqft, c.pitchRise) / SQFT_PER_SQUARE,
    );
  }
  return 0;
}

/* ── Siding ────────────────────────────────────────────────────────────── */

/**
 * Re-cladding a house, priced by the component.
 *
 * Same shape as roofing and for the same reason: the published sources agree
 * that tear-off, rot repair and trim move the total more than the choice of
 * cladding does, so a book that prices only the cladding prices the part that
 * matters least. Wall area drives the field; trim and fascia are linear; rot
 * repair is an allowance nobody can size until the wall is open.
 */
function buildSiding(config, book) {
  const items = [];
  const sqft = num(config.sqft);
  const material =
    ownKey(book.materials, config.materialKey) ||
    ownKey(book.materials, book.defaultMaterial);

  if (sqft > 0 && material && num(material.pricePerSqft) > 0) {
    items.push(
      line(`${material.label} — supplied and installed`, {
        quantity: sqft,
        unit: "sqft",
        rate: material.pricePerSqft,
      }),
    );
  }

  if (config.tearOff && sqft > 0 && num(book.tearOffPerSqft) > 0) {
    items.push(
      line("Strip and dispose of existing cladding", {
        quantity: sqft,
        unit: "sqft",
        rate: book.tearOffPerSqft,
      }),
    );
  }

  if (config.housewrap && sqft > 0 && num(book.housewrapPerSqft) > 0) {
    items.push(
      line("House wrap and weather barrier", {
        quantity: sqft,
        unit: "sqft",
        rate: book.housewrapPerSqft,
      }),
    );
  }

  // An allowance, and labelled as one. Nobody knows how much sheathing is soft
  // until the cladding is off, and a quote that pretends to is a change order
  // waiting to be argued about.
  if (num(config.rotRepairSqft) > 0 && num(book.rotRepairPerSqft) > 0) {
    items.push(
      line("Sheathing and rot repair (allowance)", {
        quantity: num(config.rotRepairSqft),
        unit: "sqft",
        rate: book.rotRepairPerSqft,
      }),
    );
  }

  const linear = [
    ["Trim — corners, windows and doors", config.trimFt, book.trimPerLf],
    ["Fascia", config.fasciaFt, book.fasciaPerLf],
  ];
  for (const [label, ft, rate] of linear) {
    if (num(ft) > 0 && num(rate) > 0) {
      items.push(line(label, { quantity: num(ft), unit: "linear ft", rate }));
    }
  }

  if (num(config.soffitSqft) > 0 && num(book.soffitPerSqft) > 0) {
    items.push(
      line("Soffit", {
        quantity: num(config.soffitSqft),
        unit: "sqft",
        rate: book.soffitPerSqft,
      }),
    );
  }

  // Last, on everything above: the storey decides ladders vs scaffold, and
  // scaffold slows every one of those operations, not just the cladding.
  const pct = num(ownKey(book.storeySurcharge, config.storeys));
  if (pct > 0) {
    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    if (subtotal > 0) {
      items.push(
        line(
          config.storeys === "three_plus"
            ? "Access — three or more storeys"
            : "Access — two storeys",
          { quantity: 1, unit: "flat", rate: subtotal * pct },
        ),
      );
    }
  }

  return items;
}

/* ── Gutters and eavestroughs ──────────────────────────────────────────── */

/**
 * The five jobs this trade sells. The takeoff asks ONCE, at the top, and every
 * priced line below follows from the answer — cleaning a run and replacing it
 * are not the same trade with a different number on it.
 *
 * Exported so the takeoff form and the builder read one list. Same contract as
 * DRIVEWAY_LABELS.
 */
export const GUTTER_WORK_TYPES = {
  cleaning: "Cleaning",
  install: "New installation",
  replacement: "Replacement",
  repair: "Repair",
  guard_only: "Gutter guard only",
};

export const GUTTER_STOREY_LABELS = {
  one: "one storey",
  two: "two storeys",
  three_plus: "three or more storeys",
};

/**
 * Gutters, priced by the linear foot of run.
 *
 * ── The two rules that must not meet ────────────────────────────────────
 *
 * The cleaning rates are published PER STOREY ($1.10 / $1.50 / $2.00), so the
 * height is already inside them. The height factor (1.00x / 1.20x / 1.425x) is
 * published for INSTALL work, where the rate is flat. Applying both to the
 * same dollar would bill a three-storey clean for the ladders twice, so the
 * lines are built into two buckets and the surcharge only ever sees one of
 * them. A guard fitted on a cleaning visit is install work and is surcharged;
 * the cleaning on that same visit is not.
 *
 * ── One minimum, chosen by the work type ────────────────────────────────
 *
 * "$150 minimum on all gutter cleaning jobs" and "$150 minimum on a repair
 * visit" are two published rules for two different jobs, not two floors under
 * one. Exactly one applies, and it is emitted as its own line rather than
 * folded into a rate — a client who counts 40 feet at $1.10 and gets a bill
 * for $150 is owed the sentence that explains it.
 */
function buildGutters(config, book) {
  const workType = Object.prototype.hasOwnProperty.call(
    GUTTER_WORK_TYPES,
    config.workType,
  )
    ? config.workType
    : "cleaning";
  const storeys = Object.prototype.hasOwnProperty.call(
    GUTTER_STOREY_LABELS,
    config.storeys,
  )
    ? config.storeys
    : "one";
  const storeyLabel = GUTTER_STOREY_LABELS[storeys];
  const ft = num(config.gutterFt);

  // Two buckets, because the height factor is allowed to see only one of them.
  const cleaning = [];
  const install = [];
  // A third, held apart from both: a repair is neither cleaning work nor a
  // rate the height factor has ever been published against.
  const repair = [];

  if (workType === "cleaning") {
    const rate = num(book.cleaning?.perFt?.[storeys]);
    if (ft > 0 && rate > 0) {
      cleaning.push(
        line(
          `Gutter cleaning — ${storeyLabel}, cleared by hand and debris taken away`,
          { quantity: ft, unit: "linear ft", rate },
        ),
      );
    }
  }

  if (workType === "install" || workType === "replacement") {
    const material =
      ownKey(book.materials, config.materialKey) ||
      ownKey(book.materials, book.defaultMaterial);
    // A bundled replacement rate is one that a source stated WITH removal and
    // disposal inside it. Only the 5" aluminium pair has one by default.
    const bundled = num(material?.replacementPricePerFt);
    const useBundled = workType === "replacement" && bundled > 0;
    const rate = useBundled ? bundled : num(material?.pricePerFt);

    if (material && ft > 0 && rate > 0) {
      install.push(
        line(
          useBundled
            ? `${material.label} — supplied and installed, existing gutters removed and taken away`
            : `${material.label} — supplied and installed`,
          { quantity: ft, unit: "linear ft", rate },
        ),
      );
    }

    // Removal on its own line whenever it is NOT already inside the rate: a
    // replacement priced off an undifferentiated rate, or an installer taking
    // down a run the new work does not put back. Charging it on top of a
    // bundled rate would bill the strip twice, which is the whole reason the
    // book carries two rates per profile.
    const removalRate = num(book.removalPerFt);
    const needsRemoval =
      workType === "replacement" ? !useBundled : Boolean(config.removeExisting);
    if (needsRemoval && ft > 0 && removalRate > 0) {
      install.push(
        line("Remove and dispose of existing gutters", {
          quantity: ft,
          unit: "linear ft",
          rate: removalRate,
        }),
      );
    }
  }

  // Guards sell on any visit — the commonest upsell on a cleaning job is the
  // reason not to clean it again — so this is not gated on the work type. It
  // is install work wherever it happens, which is what puts it in the bucket
  // the height factor can see.
  const guard = ownKey(book.guards, config.guard);
  const guardFt = num(config.guardFt);
  if (guard && guardFt > 0 && num(guard.pricePerFt) > 0) {
    install.push(
      line(`${guard.label} gutter guard — supplied and fitted`, {
        quantity: guardFt,
        unit: "linear ft",
        rate: guard.pricePerFt,
      }),
    );
  }

  const installed = num(config.downspoutsInstalled);
  if (installed > 0 && num(book.downspouts?.installEach) > 0) {
    install.push(
      line("Downspout — supplied and installed", {
        quantity: installed,
        unit: "each",
        rate: book.downspouts.installEach,
      }),
    );
  }

  // Flushing is cleaning work whatever visit it happens on: it is in the
  // cleaning bucket so a two-storey flush is not surcharged for a height the
  // cleaning ladder was already priced for.
  const flushed = num(config.downspoutsFlushed);
  if (flushed > 0 && num(book.downspouts?.flushEach) > 0) {
    cleaning.push(
      line("Downspout flush and flow test", {
        quantity: flushed,
        unit: "each",
        rate: book.downspouts.flushEach,
      }),
    );
  }

  const cableFt = num(config.heatCableFt);
  if (cableFt > 0 && num(book.extras?.heatCablePerFt) > 0) {
    install.push(
      line("Heated de-icing cable — supplied and installed", {
        quantity: cableFt,
        unit: "linear ft",
        rate: book.extras.heatCablePerFt,
      }),
    );
  }

  if (
    config.soffitFasciaRinse &&
    num(book.extras?.soffitFasciaRinsePrice) > 0
  ) {
    cleaning.push(
      line("Soffit and fascia rinse", {
        rate: book.extras.soffitFasciaRinsePrice,
      }),
    );
  }

  const sections = num(config.repairSections);
  if (sections > 0 && num(book.repairs?.perSectionPrice) > 0) {
    repair.push(
      line("Reseal or refasten gutter section", {
        quantity: sections,
        unit: "section",
        rate: book.repairs.perSectionPrice,
      }),
    );
  }

  const items = [...cleaning, ...install, ...repair];
  if (items.length === 0) return items;

  // On the install subtotal only. See the header.
  const pct = num(ownKey(book.heightSurcharge, storeys));
  const installSubtotal = install.reduce((sum, i) => sum + i.amount, 0);
  if (pct > 0 && installSubtotal > 0) {
    items.push(
      line(`Access — ${storeyLabel}`, { rate: installSubtotal * pct }),
    );
  }

  // Exactly one floor, named for what it is. Tops the job UP, never reduces a
  // larger total — same rule as the cabinet, sealing and inspection minimums.
  const minimum =
    workType === "cleaning"
      ? num(book.cleaning?.minimumCharge)
      : workType === "repair"
        ? num(book.repairs?.minimumPerJob)
        : 0;
  if (minimum > 0) {
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    if (total < minimum) {
      items.push(
        line(
          workType === "cleaning"
            ? "Minimum service charge — applies to every gutter cleaning visit"
            : "Minimum repair charge — applies to every repair visit",
          { rate: minimum - total },
        ),
      );
    }
  }

  return items;
}

/**
 * The gutter scope, exported so the takeoff screen can show the estimator the
 * lines this quote will actually carry.
 *
 * Every other takeoff re-multiplies its own rates on screen, which is fine for
 * `qty x rate`. Two of the lines here are RULES rather than multiplications —
 * which subtotal the height factor is allowed to see, and which of the two
 * minimums applies — and a screen that re-derived those would be the copy that
 * rots: the one nobody looks at when the rule changes.
 */
export function gutterLines(config, book) {
  if (!config || typeof config !== "object" || !book) return [];
  try {
    return buildGutters(config, book).filter(
      (i) => i && Number.isFinite(i.amount),
    );
  } catch {
    return [];
  }
}

/* ── Insulation ────────────────────────────────────────────────────────── */

/**
 * An insulated assembly, priced by the R it adds rather than by its area.
 *
 * The depth arithmetic lives in lib/pricing/insulation.js — this only turns its
 * answer into money. Two things the line item says that a per-square-foot quote
 * cannot: what R the assembly ENDS at, and what was already there. A homeowner
 * applying for a rebate needs the first, and a homeowner comparing two quotes
 * needs the second.
 */
function buildInsulation(config, book) {
  const items = [];
  const material =
    ownKey(book.materials, config.materialKey) ||
    ownKey(book.materials, book.defaultMaterial);
  if (!material) return items;

  const take = insulationTakeoff(config, material, book.labour);
  if (take.incomplete) return items;

  const sqft = take.sqft;
  const e = book.extras || {};

  if (num(material.rPerInch) > 0) {
    // Charged on the R ADDED, so an attic with four inches already in it is
    // quoted for the top-up and not for the whole depth.
    const rate = num(material.installedPerSqftPerR) * take.addedR;
    if (rate > 0 && take.addedR > 0) {
      items.push(
        line(
          `${material.label} — ${take.inches}" to bring the assembly to R${take.finalR}` +
            (take.existingR > 0
              ? ` (R${take.existingR} already in place)`
              : ""),
          { quantity: sqft, unit: "sqft", rate },
        ),
      );
    }
  } else if (num(material.pricePerSqft) > 0) {
    // No R claim on the line, because the product does not have one. See the
    // note on radiant_barrier in the price book.
    items.push(
      line(`${material.label} — supplied and installed`, {
        quantity: sqft,
        unit: "sqft",
        rate: material.pricePerSqft,
      }),
    );
  }

  if (config.removeExisting && num(e.removalPerSqft) > 0) {
    items.push(
      line("Remove and dispose of existing insulation", {
        quantity: sqft,
        unit: "sqft",
        rate: e.removalPerSqft,
      }),
    );
  }
  // Open cell and unfaced batt do not stop vapour. Quoting one without the
  // barrier leaves an incomplete assembly on a document a client will compare
  // against a competitor who did include it — and the engine already knows
  // which materials need one, so it does not have to be remembered.
  if (
    take.needsVapourBarrier &&
    config.vapourBarrier !== false &&
    num(e.vapourBarrierPerSqft) > 0
  ) {
    items.push(
      line("Vapour barrier", {
        quantity: sqft,
        unit: "sqft",
        rate: e.vapourBarrierPerSqft,
      }),
    );
  }

  if (config.airSeal && num(e.airSealPerSqft) > 0) {
    items.push(
      line("Air seal penetrations, top plates and hatches", {
        quantity: sqft,
        unit: "sqft",
        rate: e.airSealPerSqft,
      }),
    );
  }
  const baffles = Math.max(0, Math.floor(num(config.baffles)));
  if (baffles > 0 && num(e.baffleEach) > 0) {
    items.push(
      line("Soffit baffles, to keep the ventilation path open", {
        quantity: baffles,
        unit: "each",
        rate: e.baffleEach,
      }),
    );
  }

  return items;
}

const BUILDERS = {
  cabinet_refinishing: buildCabinets,
  cabinet_refacing: buildCabinets,
  stairs: buildStairs,
  flooring: buildFlooring,
  countertop: buildCountertop,
  interior_painting: buildInteriorPaint,
  exterior_painting: buildExteriorPaint,
  garage_door: buildGarageDoor,
  driveway_sealing: buildDrivewaySealing,
  home_inspection: buildHomeInspection,
  paving: buildPaving,
  roofing_service: buildRoofing,
  siding: buildSiding,
  gutter_services: buildGutters,
  insulation: buildInsulation,
  snow_removal: buildSnowRemoval,
};

/**
 * Build the line items for one trade.
 *
 * @param {string} categoryKey  e.g. "stairs"
 * @param {object} config       the takeoff the estimator filled in
 * @param {object} [overrides]  CompanyServiceCategory.rates
 * @returns {Array} line items in fieldquo's shape; [] for a trade with no book
 */
export function buildTradeLineItems(categoryKey, config, overrides) {
  const book = getPriceBook(categoryKey, overrides);
  const builder = BUILDERS[categoryKey];
  if (!book || !builder || !config || typeof config !== "object") return [];
  // A builder throwing on a malformed takeoff would take the whole quote
  // editor down mid-edit; an empty scope is recoverable and visibly wrong.
  try {
    return builder(config, book).filter((i) => i && Number.isFinite(i.amount));
  } catch {
    return [];
  }
}

/**
 * Crew hours a takeoff implies — "expected production time".
 *
 * Separate from the price. A trade can be priced per square foot and still
 * take a predictable number of hours, and the estimator needs both: one to
 * quote with, one to schedule and to cost against. Returns 0 for a trade whose
 * book states no productivity figure, which is most of them — an invented
 * hours-per-unit is worse than none, because it feeds a margin.
 */
export function tradeLabourHours(categoryKey, config, overrides) {
  const book = getPriceBook(categoryKey, overrides);
  if (!book || !config || typeof config !== "object") return 0;

  // Roofing does not answer this question by area. A per-square rate returns
  // the same hours for a bare deck and for three layers of 1965 shingle, and
  // has nowhere to put the valleys, the chimney, the dump runs or the two hours
  // spent setting ladders. lib/pricing/roofLabour.js itemises all of it.
  if (categoryKey === "roofing_service") {
    const detail = roofRunLabour(config, book);
    return detail.incomplete ? 0 : detail.hours;
  }

  // Paving, for the same reason plus one more: excavation, disposal and base
  // are VOLUME work, and a driveway carries 18" of base against a patio's 12".
  // Per square foot of surface those two cost the same hours, which is not
  // what happens on site. See lib/pricing/paverLabour.js.
  if (categoryKey === "paving") {
    const detail = paverLabour(config, book.labour);
    return detail.incomplete ? 0 : detail.hours;
  }

  // Insulation, because the hours follow the DEPTH. Topping up four inches and
  // filling a bare attic of the same area are not the same day's work.
  if (categoryKey === "insulation") {
    const detail = insulationRunLabour(config, book);
    return detail?.incomplete ? 0 : num(detail?.hours);
  }

  const perSqft = num(book?.labourHoursPerSqft);
  if (perSqft <= 0) return 0;

  // Siding's per-sqft rate is for vinyl; fibre cement, cedar and stone veneer
  // are progressively slower to hang. The factor lives with the material's rate
  // in the price book, and this is what reads it — without this line it would
  // be a field written and never used, which is the failure this codebase gets
  // swept for.
  const materialFactor =
    categoryKey === "siding"
      ? num(
          (
            ownKey(book.materials, config.materialKey) ||
            ownKey(book.materials, book.defaultMaterial)
          )?.labourFactor,
        ) || 1
      : 1;

  // Area is the driver for every trade that publishes one so far. Summed
  // across the surfaces a takeoff can carry rather than hardcoded per trade,
  // so a new area-priced book inherits this by declaring the rate.
  const sqft =
    num(config.sqft) +
    num(config.patioSqft) +
    num(config.walkwaySqft) +
    num(config.drivewaySqft);
  if (sqft <= 0) return 0;
  const hours = sqft * perSqft * materialFactor;
  return Number.isFinite(hours) ? money(hours) : 0;
}

/**
 * The roofing labour engine, fed the takeoff and the book's editable constants.
 *
 * `materials` is passed through so the engine can read the chosen material's
 * labourFactor — standing seam is not laid at shingle speed — without the
 * engine having to know what a price book is.
 */
function roofRunLabour(config, book) {
  return roofLabour({ ...config, materials: book.materials }, book.labour);
}

/**
 * Itemised roofing hours, for the internal cost panel.
 *
 * tradeLabourHours() returns the single number every trade returns; this
 * returns the breakdown behind it, so the estimator can see that eleven of the
 * hours are the strip and four are setting up rather than being asked to trust
 * a total. Roofing and paving; null for every trade still on a flat rate.
 */
export function tradeLabourDetail(categoryKey, config, overrides) {
  const book = getPriceBook(categoryKey, overrides);
  if (!book || !config || typeof config !== "object") return null;
  if (categoryKey === "roofing_service") return roofRunLabour(config, book);
  if (categoryKey === "paving") return paverLabour(config, book.labour);
  if (categoryKey === "insulation") return insulationRunLabour(config, book);
  return null;
}

/** The insulation engine, fed the takeoff and the chosen material's ratings. */
function insulationRunLabour(config, book) {
  const material =
    ownKey(book.materials, config.materialKey) ||
    ownKey(book.materials, book.defaultMaterial);
  return insulationTakeoff(config, material, book.labour);
}

/** Subtotal of a built scope. */
export function tradeSubtotal(categoryKey, config, overrides) {
  return money(
    buildTradeLineItems(categoryKey, config, overrides).reduce(
      (s, i) => s + i.amount,
      0,
    ),
  );
}

/** Blank takeoff for a trade, seeded from its book. */
export function createTradeConfig(categoryKey, overrides) {
  const book = getPriceBook(categoryKey, overrides);
  if (!book) return null;

  switch (categoryKey) {
    case "cabinet_refinishing":
    case "cabinet_refacing":
      return {
        doors: 0,
        drawers: 0,
        complexityLevel: "standard",
        handleHoles: false,
        softCloseHinges: false,
        drawerSlides: false,
        twoTone: false,
        threeTone: false,
        colour: "",
        sheen: "",
        notes: "",
        // Refacing only: which door is being fitted, and whether the shop
        // finishes it themselves (which changes the cost, not the price).
        ...(book.doorMaterials
          ? { doorMaterial: book.defaultMaterial, finishInHouse: false }
          : {}),
      };
    case "stairs":
      return {
        sections: [newStairSection("Main Staircase")],
        basement: false,
        basementTreads: 0,
        notes: "",
      };
    case "flooring":
      return { sections: [newFloorSection("Main Floor")], notes: "" };
    case "insulation":
      return {
        assembly: "attic",
        // No default zone. Ottawa is Zone 6 and Miami is Zone 1, and an R60
        // recommendation printed on a Florida quote is a number the contractor
        // has to defend. The takeoff asks.
        climateZone: "",
        sqft: 0,
        materialKey: book.defaultMaterial,
        existingDepthIn: 0,
        existingR: 0,
        targetR: 0,
        maxDepthIn: 0,
        removeExisting: false,
        airSeal: true,
        // Included by default and removable, rather than absent by default and
        // easy to forget. The engine says which materials need one; leaving it
        // out is a decision the estimator makes, not one they drift into.
        vapourBarrier: true,
        targetBasis: "energy_star",
        baffles: 0,
        crewSize: 2,
        notes: "",
      };
    case "gutter_services":
      return {
        // The one answer the whole form hangs off. Defaulted to cleaning
        // rather than left blank because it is a visible picker at the top of
        // the screen and cleaning is the overwhelming majority of gutter
        // visits — unlike the insulation climate zone, a wrong value here is
        // impossible to leave unnoticed and changes every field below it.
        workType: "cleaning",
        gutterFt: 0,
        storeys: "one",
        materialKey: book.defaultMaterial,
        // Only reachable on a new installation: a replacement always removes,
        // either inside the rate or on its own line.
        removeExisting: false,
        // "" is no guard, not a default guard. Ticking a company into selling
        // micro-mesh it never quoted is a scope, not a preference.
        guard: "",
        // Its own footage rather than the run's: guarding two elevations of a
        // house you are cleaning all four sides of is the normal sale.
        guardFt: 0,
        downspoutsInstalled: 0,
        downspoutsFlushed: 0,
        repairSections: 0,
        heatCableFt: 0,
        soffitFasciaRinse: false,
        notes: "",
      };
    case "siding":
      return {
        sqft: 0,
        materialKey: book.defaultMaterial,
        storeys: "one",
        tearOff: true,
        housewrap: true,
        rotRepairSqft: 0,
        trimFt: 0,
        fasciaFt: 0,
        soffitSqft: 0,
        notes: "",
      };
    case "roofing_service":
      return {
        // Measured, not guessed: the takeoff offers to fill area and pitch from
        // the client's address. Blank rather than a plausible default, because
        // a roof size nobody entered must not look like a roof size somebody
        // measured.
        areaSqft: 0,
        pitchRise: 0,
        layers: 1,
        storeys: "one",
        materialKey: book.defaultMaterial,
        deckSheets: 0,
        iceWaterFt: 0,
        dripEdgeFt: 0,
        starterFt: 0,
        valleyFt: 0,
        ridgeHipFt: 0,
        ridgeVentFt: 0,
        stepFlashingFt: 0,
        ventBoots: 0,
        boxVents: 0,
        skylights: 0,
        chimneys: 0,
        crewSize: 2,
        measuredFrom: "",
        notes: "",
      };
    case "countertop":
      return {
        materialType: book.materials?.[0] || "Quartz",
        markupPct: book.defaultMarkupPct,
        notes: "",
        items: (book.items || []).map((i) => ({
          id: i.id,
          label: i.label,
          kind: i.kind,
          ...(i.heightOption ? { heightOption: i.heightOption } : {}),
          enabled: false,
          supplierCost: num(i.defaultCost),
          override: 0,
        })),
      };
    case "interior_painting":
      return {
        rooms: [newPaintRoom("Room 1")],
        popcornRemoval: false,
        popcornSqft: 0,
        furnitureMoving: false,
        notes: "",
      };
    case "exterior_painting":
      return {
        complexityLevel: "standard",
        pressureWashing: false,
        priming: false,
        primeSqft: 0,
        notes: "",
        items: (book.items || []).map((i) => ({
          id: i.id,
          enabled: false,
          quantity: 0,
          override: 0,
        })),
      };
    case "snow_removal":
      return {
        plan: "basic",
        drivewaySize: "double",
        shovelling: false,
        salting: false,
        saltApplications: 0,
        extraVisits: 0,
        newClient: false,
        notes: "",
      };
    case "paving":
      return {
        complexityLevel: "standard",
        patioSqft: 0,
        walkwaySqft: 0,
        drivewaySqft: 0,
        wallFaceSqft: 0,
        paverOption: "standard",
        paverCostPerSqft: 0,
        crewSize: 3,
        removeExisting: false,
        poorAccess: false,
        curvesCuts: false,
        permeable: false,
        sealing: false,
        notes: "",
      };
    case "driveway_sealing":
      return {
        complexityLevel: "standard",
        sqft: 0,
        twoCoats: false,
        crackFilling: false,
        crackFt: 0,
        pressureWash: false,
        stainTreatment: false,
        premiumSealer: false,
        travelSurcharge: false,
        notes: "",
      };
    case "home_inspection":
      return {
        sqft: 0,
        // Seeded from the book's own keys so a company that adds an ancillary
        // service to its rate card gets a row for it without an edit here.
        ancillary: Object.fromEntries(
          Object.keys(book.ancillary || {}).map((id) => [id, 0]),
        ),
        warrantyVisits: 0,
        // Deliberately no `notes`. Every other trade's config carries one and
        // nothing anywhere reads it — no takeoff renders it, no document
        // prints it. Adding a twelfth copy of a dead field is not consistency,
        // it is one more thing to mistake for working.
      };
    case "garage_door":
      return {
        installIncluded: book.installIncluded !== false,
        notes: "",
        doors: Object.keys(book.doors || {}).map((id) => ({
          id,
          quantity: 0,
          override: 0,
        })),
        capping: Object.keys(book.capping || {}).map((id) => ({
          id,
          quantity: 0,
          override: 0,
        })),
      };
    default:
      return null;
  }
}

export function newStairSection(title = "Staircase") {
  return {
    title,
    complexityLevel: "standard",
    treads: 0,
    risers: 0,
    balusters: 0,
    posts: 0,
    handrailFt: 0,
    landingSqft: 0,
    paintRisers: false,
    paintBalusters: false,
    paintPosts: false,
    twoTone: false,
    stainColour: "",
    notes: "",
  };
}

export function newFloorSection(title = "Floor Area") {
  return {
    title,
    complexityLevel: "standard",
    sqft: 0,
    rooms: 1,
    woodSpecies: "",
    finishType: "",
    stainChange: false,
    waterDamageRepair: false,
    gapFilling: false,
    furnitureMoving: false,
    stairBlending: false,
    notes: "",
  };
}

export function newPaintRoom(title = "Room") {
  return {
    title,
    roomType: "bedroom",
    complexityLevel: "standard",
    sqft: 0,
    walls: true,
    ceiling: false,
    trim: false,
    doors: false,
    doorsCount: 1,
    closets: false,
    closetsCount: 1,
    colorChange: false,
    drywallPrep: false,
    notes: "",
  };
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}
