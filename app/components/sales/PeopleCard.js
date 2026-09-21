"use client";

// app/components/sales/PeopleCard.js
//
// The people on the floor, with a dot for who is at their desk and a Call
// button that rings their browser — and, for a rep the owner has allowed
// it, a field to dial a number that is not in the queue.
//
// ══ Where it came from ════════════════════════════════════════════════════
//
// OMniLeads' agent console has "llamar a otro agente" and "llamada fuera
// de campaña" behind two group privileges (phoneJsController.js lines
// 241–266 for the two modals, 1350–1366 for the privilege checks that
// disable the buttons; models.py Grupo.call_another_agent /
// call_off_camp). Here they are two per-rep flags set on
// /platform/sales/reps, read fresh by the dial route, and this card draws
// each control only when the server said the flag is on — a control that
// would be refused is not drawn (AGENTS.md's first rule).
//
// ══ Nothing here chooses a destination the server did not vouch for ══════
//
// A colleague is an id; the bridge turns it into a client identity. The
// off-queue number is typed, yes — that is what the privilege permits —
// and the server still runs the suppression list, our-own-numbers, the
// calling window for the state the rep names, and the 24-hour cap before
// anything rings. The state is a picker over the law table's own list, so
// a rep cannot name a place the table has not read.
//
// ══ The call is the session's ════════════════════════════════════════════
//
// The press POSTs the dial and hands the attempt to CallSession's
// connectOutbound, exactly as CallPanel does — the Twilio Device lives in
// the shell and survives navigation. LiveCallStrip draws the call; for a
// colleague it draws no transfer, no text, no write-up.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Phone, PhoneOutgoing, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { typedToE164, formatE164ForReading, cleanDialInput } from "@/lib/sales/typedNumber";
import { useCallSession } from "./CallSession";
import { useRepPresence } from "./RepStatus";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const CHIP =
  "inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60";

export default function PeopleCard() {
  const { t } = useTranslation();
  const session = useCallSession();
  const presence = useRepPresence();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [typed, setTyped] = useState("");
  const [where, setWhere] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/sales/calls/people"));
    } catch (err) {
      setError(err?.message || t("app.salesInternal.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    load();
    // The dots are presence, which moves; a minute is the heartbeat's own
    // cadence and a list a minute old is as good as one the router reads.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const onACall = Boolean(session.live) || Boolean(presence?.callLive);

  async function dial(body, target) {
    setError("");
    setBusy(body.internalToRepId || "off");
    try {
      const attempt = await fetchJson("/api/sales/calls/outside", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "browser", ...body }),
      });
      await session.connectOutbound({ attempt, target });
      setTyped("");
    } catch (err) {
      setError(err?.message || t("app.salesInternal.callFailed"));
    } finally {
      setBusy("");
    }
  }

  function callColleague(person) {
    dial({ internalToRepId: person.id }, { businessName: person.name, callLabel: person.name, phoneE164: null });
  }

  function callNumber(e) {
    e.preventDefault();
    const e164 = typedToE164(typed);
    if (!e164) {
      setError(t("app.salesInternal.notANumber"));
      return;
    }
    const sub = (data?.subdivisions || []).find((s) => s.code === where);
    if (!sub) {
      setError(t("app.salesInternal.pickWhere"));
      return;
    }
    dial(
      { offCampaign: { e164, country: sub.country, province: sub.code } },
      { businessName: null, callLabel: formatE164ForReading(e164), phoneE164: e164 },
    );
  }

  if (!data && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-people-card>
        <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.salesInternal.loading")}
      </div>
    );
  }

  const people = data?.people || [];
  const subdivisions = data?.subdivisions || [];

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3" data-people-card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">{t("app.salesInternal.heading")}</h2>
          <p className="text-xs text-muted-foreground break-words">
            {data?.canCallColleagues ? t("app.salesInternal.intro") : t("app.salesInternal.introNoCalls")}
          </p>
        </div>
        <button type="button" className={CHIP} onClick={load} aria-label={t("app.salesInternal.refresh")} title={t("app.salesInternal.refresh")}>
          <RefreshCw size={13} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300 break-words" role="alert" data-people-error>
          {error}
        </p>
      ) : null}

      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("app.salesInternal.nobody")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" data-people-list>
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2" data-person={person.id} data-reachable={person.reachable ? "yes" : "no"}>
              <span
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${person.reachable ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground break-words">
                  {person.name}
                  {person.agency ? <span className="text-xs font-normal text-muted-foreground"> · {person.agency.name}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {person.reachable
                    ? t("app.salesInternal.atDesk")
                    : person.state === "on_call"
                      ? t("app.salesInternal.onACall")
                      : person.state === "paused"
                        ? t("app.salesInternal.paused")
                        : t("app.salesInternal.away")}
                </p>
              </div>
              {data?.canCallColleagues && person.reachable ? (
                <button
                  type="button"
                  className={`${BTN} border border-border bg-card text-foreground`}
                  onClick={() => callColleague(person)}
                  disabled={busy !== "" || onACall || !session.ready}
                  title={onACall ? t("app.salesInternal.hangUpFirst") : undefined}
                  data-call-colleague={person.id}
                >
                  {busy === person.id ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Phone size={15} aria-hidden="true" />}
                  {t("app.salesInternal.call")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {data?.canCallOffCampaign ? (
        <form onSubmit={callNumber} className="space-y-2 border-t border-border pt-3" data-off-campaign-form>
          <p className="text-sm font-semibold text-foreground">{t("app.salesInternal.offQueueHeading")}</p>
          <p className="text-xs text-muted-foreground break-words">{t("app.salesInternal.offQueueIntro")}</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(cleanDialInput(e.target.value))}
              placeholder={t("app.salesInternal.numberPlaceholder")}
              aria-label={t("app.salesInternal.numberLabel")}
              className="min-h-[44px] flex-1 min-w-[12rem] rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-foreground"
              data-off-campaign-number
            />
            <select
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              aria-label={t("app.salesInternal.whereLabel")}
              className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              data-off-campaign-where
            >
              <option value="">{t("app.salesInternal.wherePlaceholder")}</option>
              {subdivisions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.country === "CA" ? "🇨🇦" : "🇺🇸"} {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className={`${BTN} bg-inverted text-inverted-foreground`} disabled={busy !== "" || onACall || !session.ready || !typed.trim() || !where} data-off-campaign-call>
              {busy === "off" ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <PhoneOutgoing size={15} aria-hidden="true" />}
              {typedToE164(typed) ? t("app.salesInternal.callNumber", { number: formatE164ForReading(typedToE164(typed)) }) : t("app.salesInternal.call")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
