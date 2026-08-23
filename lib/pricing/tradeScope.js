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

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Round money to cents. Guards a Decimal column against 0.1+0.2 dust. */
const money = (v) => {
  const n = num(v);
  return Math.round(n * 100) / 100;
};

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

  if (config?.handleHoles && doors > 0) {
    items.push(
      line("New handle holes (drilling)", {
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
  paving: buildPaving,
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
  const perSqft = num(book?.labourHoursPerSqft);
  if (!book || perSqft <= 0 || !config || typeof config !== "object") return 0;

  // Area is the driver for every trade that publishes one so far. Summed
  // across the surfaces a takeoff can carry rather than hardcoded per trade,
  // so a new area-priced book inherits this by declaring the rate.
  const sqft =
    num(config.sqft) +
    num(config.patioSqft) +
    num(config.walkwaySqft) +
    num(config.drivewaySqft);
  if (sqft <= 0) return 0;
  const hours = sqft * perSqft;
  return Number.isFinite(hours) ? money(hours) : 0;
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
