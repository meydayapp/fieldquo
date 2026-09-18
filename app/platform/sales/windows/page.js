// app/platform/sales/windows/page.js
//
// How hard each jurisdiction's calling window and 24-hour cap are applied on
// the rep's screens.
//
// ══ What this screen is ═══════════════════════════════════════════════════
//
// lib/sales/callingRules.js holds the law — a window, a cap, a registration
// duty per state, each with its citation. This screen does not edit any of
// that. It sets, per jurisdiction, whether FieldQuo's own gate REFUSES on the
// window and cap (enforce — the default), lets the call through beside a
// warning (warn), or does not apply them (off). Three words, one row each,
// and every gate reads the row through the same resolver.
//
// ══ The one thing a radio here cannot do ══════════════════════════════════
//
// Relax a registration gate. Where a state requires a telemarketer
// registration FieldQuo has not recorded, the resolver holds the mode at
// enforce whatever the row says, and this screen prints "held" beside the
// radio rather than letting a selected "off" look like it did something. The
// row is still saved — it takes effect the day the certificate is recorded on
// the campaigns screen — because the owner's instruction was to build the
// control and not feed it to the reps until the registration is checked off.
//
// ══ Superadmin writes, everyone reads ═════════════════════════════════════
//
// The write is gated the way the registration write is, and PlatformWriteGate
// says so before a support admin fills in a form the route would refuse.
//
// ══ The test lines, on this screen because this is where the window lives ═
//
// The owner (2026-09-17) needs to test the dialler outside calling hours on
// his own mobile. Not a per-account bypass — the law protects the stranger
// whose phone rings, whoever pressed the button — but a short list of phones
// FieldQuo ITSELF owns (lib/sales/testLines.js): a dial to one is exempt from
// the window, the cap and the retry hold for every rep, never from
// do-not-contact, and is recorded as a test and left out of every count. The
// list is edited in the TestLinesCard below, superadmin-only, audit-logged.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Lock, Phone, PhoneForwarded, Save, ShieldAlert, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

const MODE_LABEL = {
  enforce: "Enforce",
  warn: "Warn only",
  off: "Off",
};

const MODE_HELP = {
  enforce: "Outside the window or over the cap, the rep gets no Call button and no Send. Today's behaviour.",
  warn: "The call or text is allowed, and the rep's screen shows a warning naming the rule it is outside.",
  off: "The window and the cap are not applied. The rep's screen still says so — nothing is silent.",
};

const REGISTRATION_WORD = {
  not_required: "not required",
  outstanding: "outstanding",
  registered: "registered",
  expired: "lapsed",
  revoked: "withdrawn",
  not_yet_effective: "not yet in effect",
};

function when(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function PlatformSalesWindowsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Per-row drafts: { mode, note }. A row with no draft shows what the
  // server said; Save appears only when the draft differs from it.
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/windows"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();

  const rows = useMemo(() => data?.jurisdictions || [], [data]);

  function draftFor(row) {
    const d = drafts[row.key];
    return { mode: d?.mode ?? row.requestedMode, note: d?.note ?? (row.note || "") };
  }

  function dirty(row) {
    const d = draftFor(row);
    return d.mode !== row.requestedMode || (d.note || "") !== (row.note || "");
  }

  function setDraft(row, patch) {
    setDrafts((all) => ({ ...all, [row.key]: { ...draftFor(row), ...patch } }));
  }

  async function save(row) {
    const d = draftFor(row);
    if (
      d.mode !== "enforce" &&
      !row.registrationGated &&
      !confirm(
        `Set ${row.name} to "${MODE_LABEL[d.mode]}"?\n\n${MODE_HELP[d.mode]}\n\n` +
          "The law is unchanged; only what the rep's screen refuses changes. This is logged with your name.",
      )
    ) {
      return;
    }
    setBusy(row.key);
    setError("");
    setNotice("");
    try {
      const next = await fetchJson("/api/platform/sales/windows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: row.country, region: row.region || null, mode: d.mode, note: d.note }),
      });
      setData(next);
      setDrafts((all) => {
        const copy = { ...all };
        delete copy[row.key];
        return copy;
      });
      const saved = next.jurisdictions.find((j) => j.key === row.key);
      setNotice(
        saved?.heldByRegistration
          ? `${row.name} saved as "${MODE_LABEL[d.mode]}" — HELD at enforce until its registration is recorded.`
          : `${row.name} is now "${MODE_LABEL[d.mode]}".`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const relaxed = rows.filter((r) => r.mode !== "enforce").length;
  const held = rows.filter((r) => r.heldByRegistration).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calling windows</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          How hard each state&apos;s calling window and 24-hour cap are applied on the rep&apos;s
          screens. The law itself lives in lib/sales/callingRules.js and is not edited here; a row
          here decides whether FieldQuo&apos;s own gate refuses on it, warns beside a working button,
          or leaves it unapplied. Every dial, every batch claim and every text reads the same answer.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
        <p>
          <strong>A registration gate is never relaxed by this screen.</strong> Where a state requires a
          telemarketer registration that has not been recorded on the Discovery campaigns screen, the
          resolver holds the window at <em>enforce</em> whatever is chosen below, and the row shows{" "}
          <em>held</em>. The choice is kept and takes effect the day the certificate is recorded.
          Prohibitions (Arizona&apos;s ban on mobiles) and unread states are not windows and are not
          touched either.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Changing how hard a calling window is applied"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      <TestLinesCard canEdit={isSuperadmin} />

      <TransferNumbersCard canEdit={isSuperadmin} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {rows.length} jurisdictions · {relaxed} relaxed
            {held ? ` · ${held} held by an outstanding registration` : ""}
          </p>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Jurisdiction</th>
                  <th className="px-3 py-2">Window</th>
                  <th className="px-3 py-2">Cap / 24 h</th>
                  <th className="px-3 py-2">Registration</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Set by</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const d = draftFor(row);
                  const isDirty = dirty(row);
                  const canEdit = isSuperadmin && !row.prohibition && row.verified;
                  return (
                    <tr key={row.key} className="align-top">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-medium text-foreground">{row.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{row.key}</div>
                      </td>
                      <td className="px-3 py-2 min-w-[14rem]">
                        {row.prohibition ? (
                          <span className="text-red-700 dark:text-red-300">Flat prohibition — not a window</span>
                        ) : !row.verified ? (
                          <span className="text-muted-foreground">Unread — refuses as unknown</span>
                        ) : row.window ? (
                          <span>{row.window}</span>
                        ) : (
                          <span className="text-muted-foreground">None in law — FieldQuo&apos;s courtesy 08:00–20:00</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.cap ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.registrationRequired ? (
                          <span className={row.registrationGated ? "text-amber-800 dark:text-amber-300 font-medium" : ""}>
                            {row.registrationGated ? <Lock size={12} className="inline mr-1" /> : null}
                            {REGISTRATION_WORD[row.registrationState] || row.registrationState}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">not required</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.prohibition || !row.verified ? (
                          <span className="text-muted-foreground text-xs">n/a</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {data.modes.map((mode) => (
                              <label key={mode} className={`inline-flex items-center gap-1.5 ${canEdit ? "" : "opacity-70"}`}>
                                <input
                                  type="radio"
                                  name={`mode-${row.key}`}
                                  value={mode}
                                  checked={d.mode === mode}
                                  disabled={!canEdit || busy === row.key}
                                  onChange={() => setDraft(row, { mode })}
                                  title={MODE_HELP[mode]}
                                />
                                <span>{MODE_LABEL[mode]}</span>
                              </label>
                            ))}
                            {row.heldByRegistration ? (
                              <span className="text-xs text-amber-800 dark:text-amber-300 font-medium" data-held>
                                Held at enforce — registration outstanding
                              </span>
                            ) : row.mode !== "enforce" ? (
                              <span className="text-xs text-amber-800 dark:text-amber-300" data-relaxed>
                                In force: {MODE_LABEL[row.mode]}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 min-w-[14rem]">
                        {row.prohibition || !row.verified ? null : canEdit ? (
                          <textarea
                            value={d.note}
                            onChange={(e) => setDraft(row, { note: e.target.value })}
                            disabled={busy === row.key}
                            rows={2}
                            maxLength={500}
                            placeholder={d.mode === "enforce" ? "Optional" : "Why — shown to the rep"}
                            className="w-full text-sm rounded-md border border-border bg-background px-2 py-1"
                          />
                        ) : (
                          <span className="text-muted-foreground">{row.note || "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {row.setBy ? (
                          <>
                            {row.setBy}
                            <br />
                            {when(row.updatedAt)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {canEdit && isDirty ? (
                          <button
                            onClick={() => save(row)}
                            disabled={busy === row.key}
                            className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                          >
                            {busy === row.key ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Save
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The phones FieldQuo owns for testing the dialler at any hour.
 *
 * Its own load and its own save, against /api/platform/sales/test-lines,
 * rather than folded into the jurisdiction payload: the list is one row and
 * a different kind of fact from a per-state mode, and a save here must not
 * re-send forty jurisdictions. A number that fails the route's normaliser
 * comes back as a refusal naming it, never saved short.
 */
function TestLinesCard({ canEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/test-lines"));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const numbers = data?.numbers || [];
  const max = data?.max || 10;

  async function save(next) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await fetchJson("/api/platform/sales/test-lines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: next }),
      });
      setData(body);
      setDraft("");
      setNotice(
        body.numbers.length
          ? `${body.numbers.length} test line${body.numbers.length === 1 ? "" : "s"} on the list. Every rep may ring ${body.numbers.length === 1 ? "it" : "them"} at any hour; the dials are recorded as tests and counted nowhere.`
          : "The list is empty. Every number is judged by its calling window.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function add(e) {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    if (
      !confirm(
        `Add ${value} as a test line?\n\nEvery rep will be able to ring it outside every calling window. Only a phone FieldQuo itself owns belongs here — never a customer's, never a prospect's. This is logged with your name.`,
      )
    ) {
      return;
    }
    save([...numbers, value]);
  }

  function remove(n) {
    save(numbers.filter((x) => x !== n));
  }

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3" data-test-lines>
      <div className="flex items-start gap-2">
        <Phone size={16} className="shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">Test lines — FieldQuo&apos;s own phones</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            A number here may be rung by any rep at any hour: the calling window, the 24-hour cap and
            the retry pool&apos;s hold are not applied, because the phone is ours. Do-not-contact and the
            suppression list still apply. Every dial to one is recorded with jurisdiction{" "}
            <code className="text-xs">test</code> and left out of the floor board, the funnel, the badge
            counts, the agency view and the growth model. Nothing about anybody&apos;s account changes — to
            test from your own rep login, add your own mobile here.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {!data && !error ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {numbers.length ? (
            <ul className="flex flex-wrap gap-2" data-test-lines-list>
              {numbers.map((n) => (
                <li key={n} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-mono text-foreground">
                  {n}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      disabled={busy}
                      aria-label={`Remove ${n} from the test lines`}
                      className="inline-flex items-center justify-center min-h-[28px] min-w-[28px] -mr-1 rounded-full hover:bg-background disabled:opacity-60"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground" data-test-lines-empty>
              No test lines. Every number is judged by its calling window.
            </p>
          )}

          {canEdit && numbers.length < max ? (
            <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="tel"
                inputMode="tel"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                placeholder="+14165550100"
                aria-label="A phone FieldQuo owns, in E.164"
                className="w-full sm:max-w-xs text-sm rounded-md border border-border bg-background px-3 min-h-[44px] font-mono"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 rounded-lg disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Add test line
              </button>
            </form>
          ) : canEdit ? (
            <p className="text-xs text-muted-foreground">At most {max} test lines. Remove one to add another.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * The phones a live caller may be handed to.
 *
 * The same shape as TestLinesCard and next to it on purpose: both are short
 * lists of FieldQuo's own phones, both are superadmin-only and audited, and
 * both are read on a live call. The difference is what a number here DOES —
 * every rep's transfer picker offers it, by label, and a press places an
 * outbound leg to it on FieldQuo's account (lib/sales/transferNumbers.js).
 * The rep never sees the number; this card is the only screen that shows it.
 *
 * FIELDQUO_SALES_TRANSFER_TO is shown, not edited: it is a deployment
 * variable, and a control that pretended to change one would be the dead
 * button AGENTS.md forbids. It sits behind the list as one more entry.
 */
function TransferNumbersCard({ canEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftNumber, setDraftNumber] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/transfer-numbers"));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const numbers = data?.numbers || [];
  const max = data?.max || 10;
  const maxLabel = data?.maxLabel || 40;
  const standing = data?.standing || null;
  const standingOnList = Boolean(standing && numbers.some((n) => n.e164 === standing.e164));

  async function save(next) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await fetchJson("/api/platform/sales/transfer-numbers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: next.map(({ e164, label }) => ({ e164, label })) }),
      });
      setData(body);
      setDraftLabel("");
      setDraftNumber("");
      setNotice(
        body.numbers.length
          ? `${body.numbers.length} phone${body.numbers.length === 1 ? "" : "s"} on the list. Every rep's transfer picker offers ${body.numbers.length === 1 ? "it" : "them"} by label under "A phone".`
          : "The list is empty. The transfer picker offers no phone" + (body.standing ? " but the standing number from the environment." : "."),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function add(e) {
    e.preventDefault();
    const label = draftLabel.trim();
    const e164 = draftNumber.trim();
    if (!label || !e164) return;
    if (
      !confirm(
        `Add "${label}" (${e164}) as a transfer phone?\n\nEvery rep will be able to hand a live caller to it, and the call is placed on FieldQuo's account. Only a phone FieldQuo itself trusts belongs here — the owner's mobile, an office line — never a customer's, never a prospect's. This is logged with your name.`,
      )
    ) {
      return;
    }
    save([...numbers, { e164, label }]);
  }

  function remove(entry) {
    save(numbers.filter((x) => x.e164 !== entry.e164));
  }

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3" data-transfer-numbers>
      <div className="flex items-start gap-2">
        <PhoneForwarded size={16} className="shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">Transfer phones — where a live caller can be handed</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            A phone here appears in every rep&apos;s transfer picker, by its label, under &ldquo;A phone&rdquo;
            — warm (the rep speaks to it first) or cold (straight through). The rep never sees or types the
            number: the picker sends back an id and the server dials what is on this list. A phone that does
            not answer within {data?.ringSeconds || "the ring timeout"}{data?.ringSeconds ? " seconds" : ""} hands the{" "}
            caller back to the rep. A phone&apos;s own voicemail counts as an answer, and the picker says so.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {!data && !error ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {numbers.length ? (
            <ul className="flex flex-wrap gap-2" data-transfer-numbers-list>
              {numbers.map((n) => (
                <li key={n.e164} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-foreground">
                  <span className="font-medium">{n.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{n.e164}</span>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      disabled={busy}
                      aria-label={`Remove ${n.label} (${n.e164}) from the transfer phones`}
                      className="inline-flex items-center justify-center min-h-[28px] min-w-[28px] -mr-1 rounded-full hover:bg-background disabled:opacity-60"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground" data-transfer-numbers-empty>
              No transfer phones. The picker offers reps and the hold queue only
              {standing ? ", plus the standing number below" : ""}.
            </p>
          )}

          {standing ? (
            <p className="text-xs text-muted-foreground" data-transfer-standing>
              <code className="text-xs">FIELDQUO_SALES_TRANSFER_TO</code> is set to{" "}
              <span className="font-mono">{standing.e164}</span>
              {standingOnList
                ? " — already on the list above under its own label, so it is offered once."
                : ` — offered after the list as “${standing.label}”. It is a deployment variable and cannot be edited here; add it above to give it a name.`}
            </p>
          ) : null}

          {canEdit && numbers.length < max ? (
            <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="text"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                disabled={busy}
                maxLength={maxLabel}
                placeholder="Emilio’s mobile"
                aria-label="What the rep sees on the button"
                className="w-full sm:max-w-xs text-sm rounded-md border border-border bg-background px-3 min-h-[44px]"
              />
              <input
                type="tel"
                inputMode="tel"
                value={draftNumber}
                onChange={(e) => setDraftNumber(e.target.value)}
                disabled={busy}
                placeholder="+14165550100"
                aria-label="The phone, in E.164"
                className="w-full sm:max-w-xs text-sm rounded-md border border-border bg-background px-3 min-h-[44px] font-mono"
              />
              <button
                type="submit"
                disabled={busy || !draftLabel.trim() || !draftNumber.trim()}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 rounded-lg disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Add transfer phone
              </button>
            </form>
          ) : canEdit ? (
            <p className="text-xs text-muted-foreground">At most {max} transfer phones. Remove one to add another.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
