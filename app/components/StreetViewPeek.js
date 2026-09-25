// app/components/StreetViewPeek.js
//
// "See the property": a button that, when tapped, puts a Street View of the
// house front on the page — and nothing before the tap.
//
// ══ Two requests, and only one of them automatic ═══════════════════════════
//
// On mount the component asks /api/street-view whether there IS outdoor
// imagery for this record. That answer comes from Google's free metadata
// request, made server-side from the record's own address, and it is what
// decides whether the button exists at all — no imagery, no key, the API
// switched off: no button, and never a grey "no imagery" box.
//
// The panorama itself is an iframe (the Maps Embed API — free and unlimited;
// see lib/maps/streetView.js) and it is inserted only when somebody taps. An
// iframe of Street View is a few megabytes of script and tiles, and this sits
// on pages opened on a phone in a driveway on one bar.
//
// ══ Two looks, one behaviour ══════════════════════════════════════════════
//
// variant "app"       the back office's own tokens (border-border, text-foreground)
// variant "document"  the client-facing quote: colours from the company's
//                     measured document theme (lib/documents/theme.js), never
//                     from the raw brand hex — theme.accentText is ensured at
//                     4.5:1 against paper, which is what this button sits on,
//                     for yellow, white, black and mid-grey brands alike.
//
// Labels are passed in by the caller: the back office reads them from the app
// catalogue, the client's quote from lib/i18n/clientDocCopy.js in the
// DOCUMENT's language. Nothing here says FieldQuo; Google's own attribution
// is drawn inside the frame by Google and is left alone.
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, ExternalLink } from "lucide-react";

export default function StreetViewPeek({ kind, id, token, labels, variant = "app", theme = null, className = "" }) {
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);

  const query = token
    ? `token=${encodeURIComponent(token)}`
    : kind && id
      ? `kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`
      : null;

  useEffect(() => {
    if (!query) return undefined;
    let alive = true;
    setInfo(null);
    setOpen(false);
    fetch(`/api/street-view?${query}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive) setInfo(data && data.available && data.embedUrl ? data : null);
      })
      // A failed check is the same as "no imagery": the button could not
      // work, so it is not drawn. Nothing on this page depends on it.
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [query]);

  if (!info) return null;

  const doc = variant === "document" && theme;
  const buttonClass = doc
    ? "inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg border text-sm font-semibold"
    : "inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent";
  const buttonStyle = doc ? { color: theme.accentText, borderColor: theme.accentText, backgroundColor: theme.paper } : undefined;
  const linkClass = doc ? "inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2" : "inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-2";
  const linkStyle = doc ? { color: theme.accentText } : undefined;

  return (
    <div className={`space-y-2 ${className}`} data-street-view>
      <button type="button" onClick={() => setOpen((v) => !v)} className={buttonClass} style={buttonStyle} aria-expanded={open}>
        {open ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {open ? labels.hide : labels.see}
      </button>
      {open && (
        <>
          <div className="w-full overflow-hidden rounded-lg border border-black/10" style={{ aspectRatio: "2 / 1", minHeight: 200 }}>
            <iframe
              src={info.embedUrl}
              title={labels.frameTitle}
              className="w-full h-full"
              style={{ border: 0 }}
              allowFullScreen
              // The browser key is referrer-restricted; the origin must reach
              // Google for the restriction to match. This is the browser
              // default, written down so nobody tightens it to no-referrer.
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          {info.mapsUrl && (
            <a href={info.mapsUrl} target="_blank" rel="noopener noreferrer" className={linkClass} style={linkStyle}>
              {labels.openInMaps}
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </>
      )}
    </div>
  );
}
