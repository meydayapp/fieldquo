"use client";

// app/sales/voicemail/page.js
//
// The messages left for this rep.
//
// ══ Why this screen had to exist ══════════════════════════════════════════
//
// A voicemail left on a rep's own number was written to the database and
// played on exactly one screen: /platform/sales/floor, the superadmin board.
// So a contractor could ring the number a rep gave them, leave that rep a
// message, and the rep had no way to hear it. Written and never read, in its
// reachability form — and what it loses is a callback from somebody who
// already wanted to talk.
//
// ══ Why a zero-second message is shown ════════════════════════════════════
//
// Because it means something. The recorder fires after a few seconds of
// silence, so a zero-length recording is a contractor who rang back, heard the
// beep and thought better of speaking. Warmer than a missed call, colder than
// a message, and worth a callback — hiding it as "empty" throws away the
// warmest signal on the screen.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Voicemail, PhoneMissed } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

// `t` is a parameter on the two helpers that say something rather than format
// something: they run at module scope, where a hook cannot be called.
function pretty(e164, t) {
  const s = String(e164 || "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : s || t("app.salesDial.anUnknownNumber");
}

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function spoken(seconds, t) {
  if (seconds === null || seconds === undefined) return null;
  if (seconds === 0) return t("app.salesDial.noWordsSpoken");
  return t("app.salesDial.secondsSpoken", { seconds });
}

export default function SalesVoicemailPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Read through a ref rather than closed over, so `load` keeps its empty
  // dependency list: making it depend on the language would re-fetch the whole
  // list every time a rep changes language, which is a request nobody asked
  // for.
  const sayRef = useRef(t);
  sayRef.current = t;

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/sales/voicemail"));
      setError("");
    } catch (err) {
      setError(err?.message || sayRef.current("app.salesDial.voicemailLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return <p className="text-sm text-muted-foreground">{t("app.salesDial.voicemailLoading")}</p>;

  const list = data?.voicemails || [];

  return (
    <div className="space-y-6 max-w-3xl" data-tour="sales-voicemail">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesDial.voicemail")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("app.salesDial.voicemailIntro")}
          {data?.numbers?.length
            ? ` ${t("app.salesDial.yourNumberIs", {
                numbers: data.numbers.map((n) => pretty(n, t)).join(", "),
              })}`
            : ""}
        </p>
      </header>

      {error ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 break-words">{error}</p>
      ) : null}

      {list.length === 0 && !error ? (
        <div className="rounded-xl border border-border p-6 text-center">
          <Voicemail size={22} className="mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {t("app.salesDial.noMessages")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.numbers?.length
              ? t("app.salesDial.noMessagesWithNumber")
              : t("app.salesDial.noMessagesNoNumber")}
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {list.map((v) => (
          <li key={v.id} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold text-foreground break-words">
                  {v.businessName || pretty(v.fromE164, t)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.businessName ? `${pretty(v.fromE164, t)} · ` : ""}
                  {when(v.leftAt)}
                  {spoken(v.seconds, t) ? ` · ${spoken(v.seconds, t)}` : ""}
                </div>
              </div>
              {v.href ? (
                <Link href={v.href} className="text-sm font-medium text-primary hover:underline">
                  {t("app.salesDial.openTheRecord")}
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("app.salesDial.notMatchedToBusiness")}
                </span>
              )}
            </div>

            {v.silent ? (
              <p className="text-sm text-muted-foreground flex gap-2">
                <PhoneMissed size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
                {t("app.salesDial.silentVoicemail")}
              </p>
            ) : null}

            {/* Served by FieldQuo, never the provider\'s URL — see
                lib/sales/calls/voicemail.js. */}
            <audio controls preload="none" className="w-full" src={v.audioHref}>
              <a href={v.audioHref}>{t("app.salesDial.playTheMessage")}</a>
            </audio>
          </li>
        ))}
      </ul>
    </div>
  );
}
