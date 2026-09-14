// app/components/sales/PlaybookMount.js
//
// The one place the playbook is fetched and drawn, whichever dial state the
// prospect is in.
//
// ══ Why this left CallPanel ═══════════════════════════════════════════════
//
// CallPanel's header says "the playbook loads WITH the prospect, never on the
// press" — and it did, but CallPanel itself only mounted on DIAL_READY
// (DialRegion's one Call-control branch). So a rep who opened a New York lead
// at 07:40 ET saw a closed calling window on the Dialer card and an EMPTY
// Script tab: the fetch lived inside the component the closed window kept
// off the screen. Nothing loaded, nothing said why. That is the "control
// that appears to work and doesn't" AGENTS.md ranks above everything else,
// on the tab a rep reads to prepare.
//
// The fetch, the language switch and its memory, and the <CallPlaybook>
// render moved HERE — extracted, not copied, because a second loader in
// DialRegion is AGENTS.md failure class 4: two spellings of one route and one
// memory key, and the copy nobody looks at is the one that rots. CallPanel
// mounts this in the READY state exactly as before; DialRegion mounts it in
// every other state that has a prospect (do-not-contact excepted — a hard
// stop gets no script to read ahead on). One fetch path. The dial is not
// touched: this file has no href, no place(), no Twilio device.
//
// ══ What the caller can ask for ═══════════════════════════════════════════
//
//   slot      the console's Script-tab node, when the queue registered one —
//             the playbook is portalled into it; inline otherwise (the lead
//             screen, an older console). Same rule as CallPanel's other slots.
//   note      one line above the script — the closed-window "read ahead"
//             sentence. Null draws nothing extra.
//   onData    told the playbook body whenever one arrives. CallPanel reads
//             the prospect's published email off it for the Contact card;
//             kept as a callback rather than lifting the state back up,
//             because lifting it is how the fetch ended up gated on the dial.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import CallPlaybook from "./CallPlaybook";
import { rememberScriptLanguage, rememberedScriptLanguage } from "@/lib/sales/scriptLanguageMemory";

export default function PlaybookMount({
  prospectId = null,
  // The prospect whose PLAYBOOK to read when the dial target is a lead. The
  // dial itself never uses it — see DialRegion — so a lead's call is logged
  // on the lead and its script comes from the business discovery found.
  playbookProspectId = null,
  slot = null,
  layout = null,
  note = null,
  onData = null,
}) {
  // The rep's own language, not the prospect's. The words they SAY come from
  // the playbook, which is a separate catalogue in a separate language.
  const { t } = useTranslation();

  // The script, in its own three fields rather than folded into the calling
  // setup, because the two are different failures: Twilio being unconfigured
  // must not hide the playbook, and a playbook that will not load must not
  // stop the rep dialling.
  const [playbook, setPlaybook] = useState(null);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [playbookError, setPlaybookError] = useState("");
  // The script's language switch. Null means "the default" — the route
  // decides what that is for this lead and this rep — and a code means the
  // rep flipped it. Its own loading flag: switching language re-reads the
  // playbook UNDER the script that is already on screen, and the whole
  // panel must not blank while a rep is mid-call.
  const [scriptLanguage, setScriptLanguage] = useState(null);
  const [scriptLanguageLoading, setScriptLanguageLoading] = useState(false);

  // Read through a ref so a caller passing an inline arrow does not re-run
  // the effect below — and re-fetch the script — on every render.
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  useEffect(() => {
    onDataRef.current?.(playbook);
  }, [playbook]);

  // Why there is no script, when there is no script. A lead the rep typed in
  // has no discovery behind it, so lib/sales/playbook has nothing to build one
  // from — that is a fact about the record, not a failure, and it gets said
  // rather than rendered as an empty space.
  const scriptProspectId = prospectId || playbookProspectId || null;
  const playbookUnavailable = scriptProspectId ? "" : t("app.salesCall.playbookUnavailableLead");

  // `t` is deliberately NOT a dependency of this callback or of the loader
  // below. Both dep arrays are what re-runs the effects that call them, and a
  // rep changing language mid-call would otherwise re-fetch the script
  // underneath a live conversation. The only cost is that the fallback
  // sentence for a fetch that fails immediately after a language switch is a
  // beat behind; the alternative is a refetch during a call.
  const playbookUrl = useCallback(
    (language) =>
      `/api/sales/playbook?prospectId=${encodeURIComponent(scriptProspectId)}${language ? `&language=${encodeURIComponent(language)}` : ""}`,
    [scriptProspectId],
  );

  const loadPlaybook = useCallback(async () => {
    if (!scriptProspectId) return;
    setPlaybookLoading(true);
    setPlaybookError("");
    try {
      // The first read is the default language. If this rep chose another
      // language for leads of this kind before (remembered per rep, per
      // language-of-lead — a Quebec lead and a Texas lead are two habits),
      // the same read is made again in that language, under the default
      // that is already on screen. Two reads only when there is a habit.
      const first = await fetchJson(playbookUrl(null));
      setPlaybook(first);
      const remembered = rememberedScriptLanguage(first?.scriptLanguage);
      if (remembered && remembered !== first?.scriptLanguage?.current && first?.scriptLanguage?.available?.includes(remembered)) {
        setScriptLanguage(remembered);
        setScriptLanguageLoading(true);
        try {
          setPlaybook(await fetchJson(playbookUrl(remembered)));
        } catch {
          // The default is on screen and is a true script; a habit that
          // could not be honoured is not a failure of the panel.
        } finally {
          setScriptLanguageLoading(false);
        }
      } else {
        setScriptLanguage(null);
      }
    } catch (err) {
      // Its own error, never the dial's. A failed script must not read as a
      // failed call setup, and it must not clear the dial button.
      setPlaybook(null);
      setPlaybookError(err?.message || t("app.salesCall.playbookFetchFailed"));
    } finally {
      setPlaybookLoading(false);
    }
  }, [scriptProspectId, playbookUrl]);

  useEffect(() => {
    loadPlaybook();
  }, [loadPlaybook]);

  // The switch. The script that is on screen stays there, dimmed, until the
  // other language arrives; a failure leaves it and says nothing new — the
  // route's own fallback sentence covers the case where it answered with
  // the default instead.
  const changeScriptLanguage = useCallback(
    async (language) => {
      if (!scriptProspectId || !language) return;
      setScriptLanguage(language);
      setScriptLanguageLoading(true);
      try {
        const next = await fetchJson(playbookUrl(language));
        setPlaybook(next);
        rememberScriptLanguage(next?.scriptLanguage, language);
      } catch (err) {
        setPlaybookError(err?.message || t("app.salesCall.playbookFetchFailed"));
      } finally {
        setScriptLanguageLoading(false);
      }
    },
    [scriptProspectId, playbookUrl],
  );

  const node = (
    <div className="space-y-2" data-playbook-mount>
      {note ? (
        <p className="text-xs text-muted-foreground break-words" data-playbook-note>
          {note}
        </p>
      ) : null}
      <CallPlaybook
        loading={playbookLoading}
        error={playbookError}
        data={playbook}
        unavailable={playbookUnavailable}
        onRetry={loadPlaybook}
        layout={layout || (slot ? "console" : "stack")}
        scriptLanguage={scriptLanguage}
        scriptLanguageLoading={scriptLanguageLoading}
        onScriptLanguage={changeScriptLanguage}
      />
    </div>
  );

  // Drawn in the console's slot when it has one, inline otherwise.
  return slot ? createPortal(node, slot) : node;
}
