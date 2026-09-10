// app/platform/crew-lines/page.js
//
// Crew texting, from the side that owns the Twilio account.
//
// ── Why this page exists ───────────────────────────────────────────────────
//
// Every fact on it used to be on the CONTRACTOR's screen, under a "Setup
// details" disclosure on /app/crew-inbox: the number's raw Twilio smsUrl, and
// this deployment's `/api/crew/inbound` webhook URL rendered as if it were a
// link. The owner clicked it and got a blank page — it is POST-only — and then
// asked the better question: why is a contractor being shown FieldQuo's
// internal plumbing at all? He isn't, any more. FieldQuo buys the numbers and
// lends them, the way it does with Retell on the voice side.
//
// ── The failure it is really here for ──────────────────────────────────────
//
// Webhook drift. A number whose smsUrl points at a preview deployment keeps a
// green tick in our own row and delivers a tenant's crew photos into a branch
// database — invisible from inside the tenant account, invisible from our row,
// visible only by asking Twilio and comparing. The voice side learned this the
// expensive way. The comparison is lib/crew/lineAudit.js, executed by
// check:crew-inbox rather than trusted to a person opening this page.
"use client";

import { useCallback, useEffect, useState } from "react";
import { countryForRegion } from "@/lib/voice/nanp";
import Link from "next/link";
import {
  Loader2, AlertCircle, AlertTriangle, MessageSquare, Check, Copy, ShieldAlert,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function CrewLinesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/platform/crew-lines"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function copy(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  if (loading) return <div className="animate-pulse h-96 bg-accent rounded-xl" />;

  if (!data)
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-3">
        <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">{error || "Couldn't load crew lines."}</p>
      </div>
    );

  // Which number's release is one press from happening. Empty is the normal
  // state: a confirm that survives a reload is a confirm nobody meant.
  const { deployment, lines, orphans, counts, numbersError } = data;
  // Reps who could be given a sales line. Empty until one is hired, which is
  // why the picker renders only when there is somebody to pick.
  const reps = data.salesReps || [];
  const admins = data.platformAdmins || [];

  /** POST one action and reload, or surface the server's own sentence. */
  async function send(body, failure) {
    setError("");
    try {
      const res = await fetch("/api/platform/crew-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(b?.error || failure);
        return;
      }
      await load();
    } catch (err) {
      setError(err?.message || failure);
    }
  }

  /**
   * `rep:<id>` / `admin:<id>` / "" — the option carries its own kind.
   *
   * An id alone would need a lookup on every change to work out which list it
   * came from, and a lookup that missed would silently unassign the number.
   */
  function assignHolder(e164, value) {
    const [kind, id] = String(value || "").split(":");
    return send(
      {
        action: "assign",
        e164,
        salesRepId: kind === "rep" ? id : null,
        platformAdminId: kind === "admin" ? id : null,
      },
      "Couldn't assign that number.",
    );
  }

  async function releaseNumber(e164) {
    setReleasing("");
    await send({ action: "release", e164 }, "Couldn't release that number.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare size={20} /> Crew lines
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The numbers FieldQuo&apos;s Twilio account holds, who is holding each one, and
          where its texts are actually being delivered. Read-only — repointing a number
          decides which tenant receives which crew&apos;s photos, so it is done through the
          claim flow, not from here.
        </p>
      </div>

      {/* ── Can this deployment run the feature at all ──────────────────────
          The blocker a contractor now reads as "FieldQuo is still getting it set
          up". This is the same state with the cause attached, in front of the
          person who can clear it. */}
      {!deployment.signatureConfigured && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3">
          <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground space-y-1">
            <p className="font-bold">
              Crew texting is off for EVERY tenant on this deployment.
            </p>
            <p>
              <code className="px-1 py-0.5 rounded bg-background border border-border">
                {deployment.missingEnv.join(", ")}
              </code>{" "}
              isn&apos;t set, so <code>/api/crew/inbound</code> refuses every inbound
              message with a 401. An API key can send texts and manage numbers but
              cannot verify an inbound signature — it is an HMAC keyed on the
              account&apos;s auth token specifically — which is why this is checked
              apart from the rest of the Twilio credentials.
            </p>
            <p className="text-muted-foreground">
              Set it in Vercel and redeploy. Until then no number can be claimed:
              claiming would repoint it at an endpoint that rejects everything.
            </p>
          </div>
        </div>
      )}

      {!deployment.twilioConfigured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
          No Twilio credentials on this deployment, so the number list below could not
          be read at all. It is empty because nothing was asked, not because the account
          is empty.
        </div>
      )}

      {numbersError && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
          {numbersError.message}
        </div>
      )}

      {/* ── The address to paste into Twilio ────────────────────────────────
          Not a link, and labelled with what it is. It is a POST-only webhook
          endpoint: a browser opening it renders nothing, which is exactly how it
          came to look like a broken page on the tenant screen. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-foreground">Inbound webhook</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Paste this into a number&apos;s <em>A message comes in</em> field in the Twilio
          console (method POST). It is an API endpoint, not a page — opening it in a
          browser correctly shows nothing. Claiming a number from a tenant&apos;s crew
          inbox sets it automatically; this is here for a number wired by hand.
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <code className="px-2 py-1 rounded bg-background border border-border text-xs break-all">
            {deployment.webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => copy(deployment.webhookUrl, "hook")}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground"
          >
            {copied === "hook" ? <Check size={13} /> : <Copy size={13} />}
            {copied === "hook" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Numbers held" value={counts.held} />
        <Stat label="Claimed" value={counts.claimed} />
        <Stat label="Free to lend" value={counts.free} />
        <Stat label="Drifting" value={counts.drifting} bad={counts.drifting > 0} />
        <Stat label="Orphaned" value={counts.orphaned} bad={counts.orphaned > 0} />
      </div>

      <BuyNumberPanel onChanged={load} />

      {/* The env var names a number; naming is not owning. This used to state
          that fact and stop, which the owner reasonably answered with "I have no
          idea what to do with that information". Three things are possible —
          buy it, repoint it, unset it — and which one is right depends on what
          FieldQuo has actually bought, so the decision is made in
          lib/crew/sharedLineAdvice.js rather than left on the screen. */}
      {deployment.sharedLine && (
        <div
          className={`rounded-xl border p-4 text-sm text-foreground ${
            deployment.sharedLine.tone === "warn"
              ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
              : "border-border bg-card"
          }`}
        >
          <p className="font-bold">
            <code className="px-1 py-0.5 rounded bg-background border border-border text-xs">
              TWILIO_PHONE_NUMBER
            </code>{" "}
            — {deployment.sharedLine.headline}
          </p>
          <p className="mt-1.5 text-muted-foreground">{deployment.sharedLine.why}</p>
          <p className="mt-1.5">{deployment.sharedLine.action}</p>
        </div>
      )}

      {lines.length === 0 && !orphans.length ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MessageSquare size={20} className="mx-auto text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mt-3">
            This Twilio account holds no SMS-capable numbers.
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Every tenant&apos;s crew inbox correctly says FieldQuo hasn&apos;t got a
            number to give them. Buy one above and it appears here and on their
            screens — the row and the carrier are written by the same action, so
            they cannot disagree the way configuration did.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...lines, ...orphans].map((l) => (
            <LineRow
              key={l.e164}
              line={l}
              reps={reps}
              admins={admins}
              assignHolder={assignHolder}
              releaseNumber={releaseNumber}
              releasing={releasing}
              setReleasing={setReleasing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, bad }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div
        className={`text-xl font-bold tabular-nums ${
          bad ? "text-red-600 dark:text-red-400" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function LineRow({ line, reps = [], admins = [], assignHolder, releaseNumber, releasing, setReleasing }) {
  const alarm = line.drift || line.missingAtProvider;
  return (
    <div
      className={`rounded-xl border p-4 ${
        alarm
          ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold text-foreground tabular-nums">{line.e164}</span>
        {/* null is "we couldn't ask", not "no". Padding an unknown with a
            default is how an absent statement becomes an invented one. */}
        {line.mms === false && (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            SMS only — no MMS, so no photos
          </span>
        )}
        {line.claim ? (
          <Link
            href={`/platform/companies/${line.claim.companyId}`}
            className="text-xs text-muted-foreground underline"
          >
            {line.claim.companyName || line.claim.companyId}
          </Link>
        ) : line.purpose === "sales" || line.purpose === "sales_voice" ? (
          // ── A sales line is not spare capacity ────────────────────────────
          //
          // "free to lend" is about the shared TEST line, which exists to be
          // handed to one company at a time. A sales number is FieldQuo's own
          // and is never lent to anybody — the owner bought one, read "free to
          // lend" under it, and reasonably asked whether it had gone in as the
          // wrong kind. It had not; the label was answering a different
          // question, because the only branch here was "claimed by a company or
          // not".
          <span className="text-xs text-muted-foreground">
            {line.assignedRepName || line.assignedAdminName
              ? `${line.assignedRepName || line.assignedAdminName} uses this`
              : "FieldQuo's own — shared across the sales team"}
          </span>
        ) : (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            free to lend
          </span>
        )}
        {/* ── Who calls from it ────────────────────────────────────────────
            Only on a sales line: a system or shared-test number belongs to a
            job, not a person. The owner bought a number and asked where he
            assigns it — the column existed and nothing wrote it. */}
        {(line.purpose === "sales" || line.purpose === "sales_voice") && (
          <select
            className="text-xs border border-border rounded-lg px-2 py-1.5 min-h-[44px] bg-card text-foreground"
            // One value, two kinds of person, so the option carries its own
            // kind rather than the handler guessing from which list an id came
            // out of. `rep:<id>` / `admin:<id>` — an id alone would need a
            // lookup on every change, and a lookup that missed would silently
            // unassign.
            value={
              line.assignedRepId
                ? `rep:${line.assignedRepId}`
                : line.assignedAdminId
                  ? `admin:${line.assignedAdminId}`
                  : ""
            }
            onChange={(e) => assignHolder(line.e164, e.target.value)}
            aria-label={`Who uses ${line.e164}`}
          >
            <option value="">Unassigned — shared across the team</option>
            {reps.length > 0 && (
              <optgroup label="Sales reps">
                {reps.map((r) => (
                  <option key={r.id} value={`rep:${r.id}`}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            )}
            {admins.length > 0 && (
              <optgroup label="FieldQuo staff">
                {admins.map((a) => (
                  <option key={a.id} value={`admin:${a.id}`}>
                    {a.email}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
        {/* ── Hand it back ─────────────────────────────────────────────────
            The route has had a `release` action since it was written and
            nothing ever called it, so a number FieldQuo had stopped needing
            could only be released in the Twilio console — leaving our row
            saying we hold something we do not.

            Two presses, because it is irreversible at the carrier: the number
            goes back on the shelf and cannot be recovered. Never offered on a
            number a tenant is holding — releasing that takes a contractor's
            crew inbox away mid-job, and the claim has to be moved first. */}
        {!line.claim && !line.missingAtProvider && (
          releasing === line.e164 ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => releaseNumber(line.e164)}
                className="text-xs font-semibold min-h-[44px] px-3 rounded-lg bg-red-600 text-white"
              >
                Yes, hand it back
              </button>
              <button
                type="button"
                onClick={() => setReleasing("")}
                className="text-xs min-h-[44px] px-3 rounded-lg border border-border text-foreground"
              >
                Keep it
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setReleasing(line.e164)}
              className="text-xs min-h-[44px] px-3 rounded-lg border border-border text-muted-foreground"
            >
              Release
            </button>
          )
        )}
        {line.claim?.source === "shared_test" && (
          <span className="text-xs text-muted-foreground">
            shared test loan
            {line.claim.expiresAt
              ? ` · ${line.claim.expired ? "expired" : "until"} ${new Date(
                  line.claim.expiresAt,
                ).toLocaleDateString()}`
              : ""}
          </span>
        )}
      </div>

      {line.missingAtProvider && (
        <p className="text-sm text-foreground mt-2 flex items-start gap-1.5">
          <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
          Claimed by a company, and Twilio does not list it. Either it was released at
          the provider without releasing the row, or these credentials now point at a
          different Twilio account. Their crew line can never receive anything.
        </p>
      )}

      {/* The drift sentence comes from the audit, not from the capability
          verdict. In a drift the verdict reads "ready" — our row says connected,
          to the URL we expect — and that agreement with itself IS the failure. */}
      {line.driftMessage && (
        <p className="text-sm text-foreground mt-2 flex items-start gap-1.5">
          <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
          {line.driftMessage}
        </p>
      )}

      <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline font-medium">Twilio delivers to: </dt>
          <dd className="inline break-all">
            {line.smsUrl || (
              <span className="italic">
                nothing — no message webhook is set on this number
              </span>
            )}
          </dd>
        </div>
        {line.claim && (
          <div>
            <dt className="inline font-medium">Verdict: </dt>
            <dd className="inline">
              {line.claim.ready ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  <Check size={11} className="inline" /> {line.claim.opsMessage}
                </span>
              ) : (
                <span>
                  {line.claim.reason} — {line.claim.opsMessage}
                </span>
              )}
            </dd>
          </div>
        )}
        {line.claim && !line.claim.enabled && (
          <div className="text-amber-700 dark:text-amber-400">
            Company.crewInboxEnabled is false, so the inbound webhook drops their
            messages even when everything else lines up.
          </div>
        )}
        {line.sid && (
          <div>
            <dt className="inline font-medium">SID: </dt>
            <dd className="inline break-all">{line.sid}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * Buying a number for FieldQuo itself.
 *
 * ── Why this is here and not in the Twilio console ────────────────────────
 *
 * Because the console route needed four steps outside the product — buy by
 * hand, copy the number, edit a Vercel variable, redeploy — and one of them was
 * silently wrong for months: TWILIO_PHONE_NUMBER named +17372212163, which this
 * account has never owned. Every send that fell back to it failed at the
 * carrier, and no screen anywhere could say so, because naming a number in
 * configuration is not owning it.
 *
 * Buying it here writes the row the sender actually reads, so the purchase and
 * the fact are the same event.
 *
 * The purpose selector is not cosmetic. `system` is the outbound From for a
 * company that has no number of its own; `shared_test` is the line lent to one
 * company at a time. On a small deployment one number is usually both, which is
 * exactly what the single env var used to be — but they are bought as separate
 * rows so splitting them later is a purchase, not a migration.
 *
 * `sales` is the one that must NOT be shared with either. FieldQuo's reps text
 * their signup link from it, and a STOP arriving at a sales number means "stop
 * selling me software" where a STOP at the system number means "stop texting me
 * about my kitchen quote". One number carrying both makes those two
 * indistinguishable at the moment they arrive. It is also the only purpose
 * whose inbound webhook points at /api/sms/inbound rather than the crew
 * endpoint — see webhookUrlFor in lib/crew/platformNumber.js.
 */
function BuyNumberPanel({ onChanged }) {
  const [areaCode, setAreaCode] = useState("");
  // A two-letter state or province. An area code wins when both are given —
  // searchLocalNumbers says so, and combining them would silently drop results.
  const [region, setRegion] = useState("");
  const [purpose, setPurpose] = useState("system");
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(null);

  async function post(action, extra) {
    const res = await fetch("/api/platform/crew-lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  }

  async function search() {
    setBusy("search");
    setErr("");
    setFound(null);
    try {
      setFound(
        await post("search", {
          areaCode: areaCode.trim() || null,
          region: region.trim() || null,
          // Stated only for a region search, where there is no area code to
          // derive it from. An area-code search deliberately sends no country:
          // the server derives it, which is what stopped every US search
          // silently returning nothing.
          country: !areaCode.trim() && region.trim() ? countryForRegion(region.trim()) : null,
        }),
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  async function buy(e164) {
    setBusy(e164);
    setErr("");
    try {
      await post("buy", { e164, purpose });
      setConfirming(null);
      setFound(null);
      setAreaCode("");
      await onChanged();
    } catch (e) {
      setErr(e.message);
      setConfirming(null);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">Buy a number for FieldQuo</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Bought here, the number is recorded and its inbound webhook is set in the same
        call — it is never live and pointing nowhere. This spends FieldQuo&apos;s money
        at the carrier, not a tenant&apos;s credit.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Area code
          <input
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="343"
            inputMode="numeric"
            className="mt-1 block w-24 px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
          />
        </label>
        {/* ── Or the whole province/state ──────────────────────────────────
            Searching one area code at a time is guessing, and the owner said
            so: he tried six Manhattan codes for a list of Buffalo contractors
            and concluded Twilio had nothing. A region search answers "what IS
            available" in one request and returns the area codes with it, which
            is the question somebody actually has. */}
        <label className="text-xs text-muted-foreground">
          …or a whole region
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
            placeholder="NY"
            className="mt-1 block w-24 px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Purpose
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="mt-1 block px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
          >
            <option value="system">System — outbound From</option>
            <option value="shared_test">Shared test line — lent out</option>
            <option value="sales">Sales — the team&apos;s number: reps call and text from it; contractors ring it back</option>
            <option value="sales_voice">Sales voice — call-only, for a second number in another area code</option>
          </select>
        </label>
        <button
          type="button"
          onClick={search}
          disabled={busy === "search"}
          className="px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50"
        >
          {busy === "search" ? "Searching…" : "Search"}
        </button>
      </div>

      {err && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>
      )}

      {/* "We looked and found nothing" and "we had nothing to look with" are
          different answers, and an empty list dressed up as one is how an area
          code with no inventory comes to look like a broken connection. */}
      {found && found.numbers.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {found.searched?.areaCode
            ? `No numbers free in ${found.searched.areaCode} right now — that is Twilio's inventory, not an error. Some codes are genuinely exhausted: Manhattan's 212 and 646 almost never have any. Try the region box instead to see what the whole state has.`
            : found.searched?.region
              ? `Nothing free anywhere in ${found.searched.region} right now.`
              : "Nothing to search on — enter an area code, or a two-letter region."}
        </p>
      )}

      {found && found.numbers.length > 0 && (
        <ul className="mt-3 divide-y divide-border border border-border rounded-lg">
          {found.numbers.map((n) => (
            <li key={n.e164} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{n.display || n.e164}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[n.locality, n.region].filter(Boolean).join(", ") || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirming(n)}
                disabled={busy === n.e164}
                className="text-xs px-2.5 py-1 rounded-full border border-border text-foreground hover:bg-accent disabled:opacity-50"
              >
                {busy === n.e164 ? "Buying…" : "Buy"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Money, and a carrier. Named in full before it happens — a one-click buy
          on a row that looks like every other row is how the wrong number gets
          bought. */}
      {confirming && (
        <div className="mt-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-sm text-foreground">
            Buy <strong>{confirming.display || confirming.e164}</strong> as the{" "}
            <strong>
              {purpose === "system"
                ? "system outbound number"
                : purpose === "sales"
                  ? "sales team's number — reps call AND text from it, and contractors ring it back"
                  : purpose === "sales_voice"
                    ? "call-only sales number (another area code) — texts to it are not delivered, reps text from the Sales number"
                    : "shared test line"}
            </strong>
            ?
            FieldQuo is billed monthly by Twilio from the moment it exists.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => buy(confirming.e164)}
              className="px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium"
            >
              Buy it
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
