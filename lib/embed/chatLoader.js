// lib/embed/chatLoader.js
//
// The one-line chat loader a company pastes into a website FieldQuo did not
// build:
//
//     <script src="https://www.fieldquo.com/embed/<slug>/chat.js" async></script>
//
// served by app/embed/[companySlug]/chat.js/route.js.
//
// ══ Why a script, when an iframe snippet already existed ═══════════════════
//
// An iframe has ONE size, chosen by the host page. The old snippet had to pick
// between two failures: big enough for the open panel, and an invisible
// 380×560 box sat over the bottom-right of the contractor's site blocking
// every click on whatever was underneath it even while the chat was closed;
// or bubble-sized, and the panel had nowhere to open. Every chat widget on the
// web solves this the same way — a small script on the host page owns the
// iframe and resizes it when the widget inside says what it needs. This is
// that script. The widget itself is unchanged: it is still the /embed/<slug>
// /chat page, the same SiteChatMount the company's FieldQuo site renders.
//
// The old iframe snippet keeps working exactly as before (the embed page only
// changes behaviour when the loader asks for it with ?host=loader), so nobody
// who pasted it is broken by this.
//
// ══ The protocol ═══════════════════════════════════════════════════════════
//
// Frame → host   {type:"fq-chat", state:"closed", width, height, title}
//                {type:"fq-chat", state:"open",   width, height}
//                {type:"fq-chat", state:"disabled"}
// Host  → frame  {type:"fq-chat-host", layout:"float"|"full"}
//                {type:"fq-chat-host", action:"close"}
//
// The host accepts a message only when event.origin is OUR origin AND
// event.source is ITS OWN iframe — the origin check alone would let a second
// FieldQuo embed on the same page (a booking form, another company's chat)
// drive this one. The frame, which cannot know the host's origin, accepts
// only from window.parent, and nothing the host can say does more than close
// the panel or change its layout.
//
// The frame starts hidden (visibility:hidden, 1px) and is shown only on its
// first "closed" message — so a company with no employee on the web channel
// ("disabled": the iframe is removed), a slow network, or a deleted company
// (the embed 404s and never speaks) leaves nothing on the host page: no box,
// nothing to tab into.
//
// ══ Constraints the source below keeps ═════════════════════════════════════
//
// - ES5 only. It runs on whatever browser visits a painter's website, and
//   there is no build step between this string and that browser. The check
//   script parses it with ecmaVersion 5.
// - No eval, no innerHTML, no <style> element: every style is a CSSOM
//   property set with setProperty(…, "important"), which a host's CSP
//   `style-src` does not block and a host's `iframe { width:100% !important }`
//   rule cannot override.
// - One global, window.fqChat, holding the instances by slug. Pasting the
//   snippet twice (header AND footer plugin — it happens) mounts one bubble.
// - Nothing visible names FieldQuo. The iframe's title comes from the frame
//   ("Chat with <company>", in the company's language).

/** Where the bubble sits from the viewport edge, host side. The widget pads
 *  its own button by FRAME_PAD inside the frame (room for the shadow), so the
 *  iframe itself sits FRAME_PAD closer to the edge than the bubble looks. */
export const BUBBLE_OFFSET = 16;
export const FRAME_PAD = 12;
/** Below this host width an open chat is a full-screen overlay. */
export const PHONE_MAX = 640;
/** The z-index when the snippet names none. data-z overrides it. */
export const DEFAULT_Z = 2147483000;

// Slugs are what lib/booking/findBookingCompany.js resolves: bookingSlug or
// slug, both lower-case-ish URL segments. Anything else is refused before it
// goes anywhere near a JS string literal.
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export function isLoaderSlug(slug) {
  return typeof slug === "string" && SLUG_RE.test(slug);
}

/** A JSON string literal. Both inputs have already passed a strict ASCII
 *  pattern, so this is belt-and-braces: `<` is escaped in case the source is
 *  ever inlined in an HTML <script> block rather than served as a file. */
function jsString(value) {
  return JSON.stringify(String(value))
    .replace(/</g, "\\u003c");
}

/**
 * @param origin  our origin, e.g. "https://www.fieldquo.com" (getAppOrigin)
 * @param slug    the booking slug the snippet names
 * @returns the loader source, or "" when either input is unusable
 */
export function chatLoaderScript({ origin, slug } = {}) {
  if (!isLoaderSlug(slug)) return "";
  if (typeof origin !== "string" || !/^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(origin)) return "";

  return `/* chat loader */
(function (w, d) {
  "use strict";
  var ORIGIN = ${jsString(origin)};
  var SLUG = ${jsString(slug)};
  var OFFSET = ${BUBBLE_OFFSET - FRAME_PAD};
  var PHONE = ${PHONE_MAX};

  var ns = w.fqChat = w.fqChat || {};
  ns.instances = ns.instances || {};
  if (ns.instances[SLUG]) return;

  function findScript() {
    if (d.currentScript) return d.currentScript;
    var all = d.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      var src = all[i].getAttribute("src") || "";
      if (src.indexOf("/embed/" + SLUG + "/chat.js") !== -1) return all[i];
    }
    return null;
  }
  var script = findScript();
  function opt(name) {
    return script ? script.getAttribute("data-" + name) : null;
  }
  var side = opt("position") === "left" ? "left" : "right";
  var other = side === "left" ? "right" : "left";
  var z = parseInt(opt("z"), 10);
  if (!(z >= 0 && z <= 2147483647)) z = ${DEFAULT_Z};

  var frame = null;
  var state = "loading";
  var size = { w: 0, h: 0 };
  var sentLayout = null;
  var lock = null;

  function css(el, map) {
    for (var k in map) {
      if (Object.prototype.hasOwnProperty.call(map, k)) el.style.setProperty(k, map[k], "important");
    }
  }
  function viewport() {
    var de = d.documentElement;
    return { w: w.innerWidth || de.clientWidth || 0, h: w.innerHeight || de.clientHeight || 0 };
  }
  function layout() {
    return viewport().w < PHONE ? "full" : "float";
  }
  function post(msg) {
    try {
      if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg, ORIGIN);
    } catch (e) {}
  }

  // Host scroll is locked only while the full-screen chat is open, and put
  // back exactly as it was — including the scroll position, which
  // position:fixed on <body> would otherwise throw away.
  function lockScroll(on) {
    var b = d.body;
    var de = d.documentElement;
    if (!b) return;
    if (on && !lock) {
      lock = {
        y: w.pageYOffset || de.scrollTop || 0,
        ho: de.style.getPropertyValue("overflow"), hp: de.style.getPropertyPriority("overflow"),
        bo: b.style.getPropertyValue("overflow"), bop: b.style.getPropertyPriority("overflow"),
        bpos: b.style.getPropertyValue("position"), bposp: b.style.getPropertyPriority("position"),
        bt: b.style.getPropertyValue("top"), btp: b.style.getPropertyPriority("top"),
        bw: b.style.getPropertyValue("width"), bwp: b.style.getPropertyPriority("width")
      };
      css(de, { overflow: "hidden" });
      css(b, { overflow: "hidden", position: "fixed", top: -lock.y + "px", width: "100%" });
    } else if (!on && lock) {
      var l = lock;
      lock = null;
      de.style.setProperty("overflow", l.ho, l.hp);
      b.style.setProperty("overflow", l.bo, l.bop);
      b.style.setProperty("position", l.bpos, l.bposp);
      b.style.setProperty("top", l.bt, l.btp);
      b.style.setProperty("width", l.bw, l.bwp);
      w.scrollTo(0, l.y);
    }
  }

  function apply() {
    if (!frame) return;
    var L = layout();
    if (L !== sentLayout) {
      sentLayout = L;
      post({ type: "fq-chat-host", layout: L });
    }
    if (state === "loading") return;
    var full = state === "open" && L === "full";
    var m = {};
    m.visibility = "visible";
    if (full) {
      m.top = "0"; m.bottom = "0"; m.left = "0"; m.right = "0";
      m.width = "100%"; m.height = "100%";
    } else {
      var vp = viewport();
      m.top = "auto"; m[other] = "auto";
      m.bottom = OFFSET + "px"; m[side] = OFFSET + "px";
      m.width = Math.max(1, Math.min(size.w, vp.w - OFFSET * 2)) + "px";
      m.height = Math.max(1, Math.min(size.h, vp.h - OFFSET * 2)) + "px";
    }
    css(frame, m);
    lockScroll(full);
  }

  function num(v) {
    v = Number(v);
    return isFinite(v) && v > 0 ? Math.min(Math.ceil(v), 4000) : 0;
  }

  function onMessage(e) {
    if (!frame || e.origin !== ORIGIN || e.source !== frame.contentWindow) return;
    var m = e.data;
    if (!m || typeof m !== "object" || m.type !== "fq-chat") return;
    if (m.state === "disabled") {
      destroy();
      return;
    }
    if (m.state !== "open" && m.state !== "closed") return;
    if (typeof m.title === "string" && m.title) frame.setAttribute("title", m.title.slice(0, 120));
    var was = state;
    state = m.state;
    size = { w: num(m.width), h: num(m.height) };
    // Every message from the frame is answered with the layout, not just
    // changes: the frame's listener attaches when React hydrates, which can
    // be after the iframe's load event, so a layout sent only on load was
    // missed and a phone got the floating card inside a full-screen frame.
    sentLayout = null;
    apply();
    // Only when focus is still on the host page: calling focus() on a frame
    // that already holds it resets focus inside it to <body>, which undid
    // the widget moving it to the text box (seen in Chrome).
    if (state === "open" && was !== "open" && d.activeElement !== frame) {
      try { frame.focus(); } catch (err) {}
    }
  }

  function onKey(e) {
    if (state !== "open") return;
    if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) post({ type: "fq-chat-host", action: "close" });
  }

  function onResize() {
    apply();
  }

  function destroy() {
    lockScroll(false);
    w.removeEventListener("message", onMessage, false);
    w.removeEventListener("resize", onResize, false);
    d.removeEventListener("keydown", onKey, false);
    if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    frame = null;
    state = "gone";
    delete ns.instances[SLUG];
  }

  function mount() {
    if (!ns.instances[SLUG] || frame || state === "gone") return;
    frame = d.createElement("iframe");
    frame.setAttribute("title", "Chat");
    frame.setAttribute("allow", "clipboard-write");
    frame.setAttribute("allowtransparency", "true");
    css(frame, {
      position: "fixed", border: "0", margin: "0", padding: "0",
      background: "transparent", "color-scheme": "light", display: "block",
      "max-width": "none", "max-height": "none", "min-width": "0", "min-height": "0",
      "z-index": String(z), visibility: "hidden", width: "1px", height: "1px",
      bottom: OFFSET + "px", top: "auto"
    });
    frame.style.setProperty(side, OFFSET + "px", "important");
    frame.style.setProperty(other, "auto", "important");
    w.addEventListener("message", onMessage, false);
    w.addEventListener("resize", onResize, false);
    d.addEventListener("keydown", onKey, false);
    frame.src = ORIGIN + "/embed/" + encodeURIComponent(SLUG) + "/chat?host=loader" + (side === "left" ? "&side=left" : "");
    // The first layout goes out once the frame has loaded; anything posted
    // before that would land on about:blank.
    frame.addEventListener("load", function () {
      sentLayout = null;
      apply();
    }, false);
    d.body.appendChild(frame);
  }

  ns.instances[SLUG] = { destroy: destroy };

  if (d.body) mount();
  else d.addEventListener("DOMContentLoaded", mount, false);
})(window, document);
`;
}
