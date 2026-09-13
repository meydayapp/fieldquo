// The DOM audit one rendered frame gets. Runs INSIDE the page — shoot.mjs and
// scripts/check-platform-mobile.mjs read this file and evaluate the function
// through the DevTools protocol, so the frame in docs/screens and the check
// that guards it measure the same thing.
//
// What it measures, and why each is a phone defect and not a taste:
//
//   overflow    elements whose box leaves the viewport sideways and are not
//               inside a horizontal scroll container. AGENTS.md: the page
//               body must never scroll horizontally. Reported outermost-first
//               so a wide table is one row, not one per cell.
//   clipped     the same, but inside an overflow:hidden ancestor — the page
//               does not scroll, the content is simply cut off.
//   tables      every <table>, with whether an ancestor scrolls sideways and
//               whether that ancestor itself fits the viewport. A table wider
//               than the phone with no scroller is the overflow above; one
//               inside a scroller is fine.
//   tap         interactive elements under 44×44 CSS px — Apple's HIG floor
//               and the number every min-h-[44px] in this codebase cites.
//               `primary` marks the ones a thumb must hit (submit buttons,
//               filled buttons, the nav's own controls).
//   truncated   text-overflow: ellipsis that is actually eliding.
//   dialogs     role=dialog / aria-modal panels taller than the viewport.
//   fixed       position:fixed elements and their boxes, so a toast, dock or
//               bar sitting on content can be seen in numbers.
//   asides      every visible <aside> and its width — a 240px rail on a
//               375px phone is the first defect the owner meant.
//   smallInputs inputs/selects under 16px font — iOS zooms the page on
//               focus, and the zoom is the sideways scroll everybody hates.
// `deviceWidth` is the emulated width: under Chrome's mobile emulation a
// page that overflows is shrunk to fit and window.innerWidth grows with it,
// which would hide exactly the overflow this is looking for.
export function auditPage(deviceWidth) {
  const vw = deviceWidth || window.innerWidth;
  const vh = window.innerHeight;
  const docW = document.documentElement.scrollWidth;
  const docH = document.documentElement.scrollHeight;
  const cs = (el) => window.getComputedStyle(el);
  const visible = (el) => {
    const s = cs(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
  };
  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: (typeof el.className === "string" ? el.className : "").replace(/\s+/g, " ").trim().slice(0, 140),
    text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70),
    ...rectOf(el),
  });
  // Nearest ancestor that scrolls or clips sideways and itself fits the
  // viewport — inside one of those, a wide box does not widen the page.
  const container = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = cs(p);
      const ox = s.overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") {
        const r = p.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return ox === "hidden" || ox === "clip" ? "clip" : "scroll";
      }
      p = p.parentElement;
    }
    return null;
  };
  const all = Array.from(document.body.querySelectorAll("*")).filter(visible);
  const isFixed = (el) => cs(el).position === "fixed";

  // ── overflow / clipped ────────────────────────────────────────────────
  const offenders = new Map();
  for (const el of all) {
    if (isFixed(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      const c = container(el);
      if (c === "scroll") continue;
      offenders.set(el, c === "clip" ? "clipped" : "overflow");
    }
  }
  const outermost = [...offenders.keys()].filter((el) => {
    let p = el.parentElement;
    while (p) {
      if (offenders.has(p)) return false;
      p = p.parentElement;
    }
    return true;
  });
  const overflow = outermost.filter((el) => offenders.get(el) === "overflow").map(describe);
  const clipped = outermost.filter((el) => offenders.get(el) === "clipped").map(describe);

  // ── tables ────────────────────────────────────────────────────────────
  const tables = Array.from(document.querySelectorAll("table")).filter(visible).map((t) => {
    let p = t.parentElement;
    let scroller = null;
    while (p && p !== document.body) {
      const ox = cs(p).overflowX;
      if (ox === "auto" || ox === "scroll") {
        scroller = p;
        break;
      }
      p = p.parentElement;
    }
    const r = t.getBoundingClientRect();
    const sr = scroller ? scroller.getBoundingClientRect() : null;
    return {
      width: Math.round(r.width),
      y: Math.round(r.top + window.scrollY),
      inScroller: Boolean(scroller),
      scrollerFits: sr ? sr.right <= vw + 1 : null,
      caption: (t.querySelector("th")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
    };
  });

  // ── tap targets ───────────────────────────────────────────────────────
  // The filled buttons of the three consoles: --primary, --inverted (the
  // platform's black button), --foreground fills, the brand orange, red.
  const PRIMARY = /\b(bg-primary|bg-inverted|bg-brand-accent|bg-sidebar-primary|bg-destructive|bg-foreground)\b/;
  const interactive = Array.from(
    document.querySelectorAll("button, a[href], [role='button'], input[type='checkbox'], input[type='radio'], select, summary, [role='tab'], [role='menuitem']"),
  ).filter(visible);
  const tap = [];
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    // A link inside running prose is text, not a target row; measured
    // separately so an inline "read more" does not count as a button.
    const inline = el.tagName === "A" && cs(el).display === "inline";
    if (r.height < 44 || r.width < 44) {
      // getAttribute, not el.type: a <button> with no type attribute reports
      // type "submit" from the DOM, which would make every button primary.
      const primary =
        el.tagName === "BUTTON" &&
        (el.getAttribute("type") === "submit" || PRIMARY.test(el.className || "") || el.hasAttribute("data-tour-open") || el.hasAttribute("data-tour-close"));
      tap.push({ ...describe(el), inline, primary, type: el.getAttribute("type") || null });
    }
  }
  const tapPrimary = tap.filter((t) => t.primary);

  // ── truncated text ────────────────────────────────────────────────────
  const truncated = all
    .filter((el) => cs(el).textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1)
    .map(describe);

  // ── dialogs ───────────────────────────────────────────────────────────
  const dialogs = Array.from(document.querySelectorAll("[role='dialog'], [aria-modal='true'], [data-dialog]"))
    .filter(visible)
    .map((d) => ({ ...describe(d), tallerThanViewport: d.getBoundingClientRect().height > vh + 1, scrolls: /(auto|scroll)/.test(cs(d).overflowY) }));

  // ── fixed ─────────────────────────────────────────────────────────────
  const fixed = all.filter(isFixed).map((el) => ({ ...describe(el), z: cs(el).zIndex }));

  // ── asides / main ─────────────────────────────────────────────────────
  const asides = Array.from(document.querySelectorAll("aside")).filter(visible).map((a) => ({ ...describe(a), fixed: isFixed(a) }));
  // The console's desktop rail by name — a page's own <aside> (the chat's
  // room list) is not the defect this looks for.
  const rail = document.querySelector("[data-platform-rail]");
  const railVisible = Boolean(rail && visible(rail));
  const main = document.querySelector("main");
  const mainRect = main ? rectOf(main) : null;

  // ── small inputs ──────────────────────────────────────────────────────
  const smallInputs = Array.from(document.querySelectorAll("input:not([type='checkbox']):not([type='radio']):not([type='hidden']), select, textarea"))
    .filter(visible)
    .filter((el) => parseFloat(cs(el).fontSize) < 16)
    .map((el) => ({ ...describe(el), fontSize: cs(el).fontSize }));

  // ── horizontal scrollers present (so the check can prove a table's) ───
  const scrollers = all.filter((el) => /(auto|scroll)/.test(cs(el).overflowX) && el.scrollWidth > el.clientWidth + 1).map(describe);

  return {
    vw, vh, docW, docH,
    scrollsSideways: docW > vw + 1,
    overflow, clipped, tables, tap, tapPrimary, truncated, dialogs, fixed, asides, railVisible, mainRect, smallInputs, scrollers,
    unanswered: window.__harnessUnanswered || [],
    sceneError: document.documentElement.getAttribute("data-scene-error") || null,
    headings: Array.from(document.querySelectorAll("h1")).map((h) => (h.textContent || "").trim().slice(0, 60)),
    textLength: (document.body.innerText || "").length,
  };
}
