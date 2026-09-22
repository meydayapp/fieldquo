// app/portal/[token]/JobProgressCard.js
//
// "Where are we?" — the one question a homeowner with a crew in the house
// asks. The job's plan, read-only, in the client's language: Done · In
// progress · Waiting on (with what it is waiting on named), the dates, the
// photos the crew filed against a step, and the change orders waiting on the
// client's own signature — which are the one thing on this card they can act
// on, and they act on it through the addendum page, not here.
//
// No prices per step, no internal notes, no hours: the route
// (app/api/portal/[token]/route.js) never sends them, and this component
// draws only what it is sent. Nothing here is editable.
"use client";

import { Check, Circle, Clock, HardHat } from "lucide-react";

export default function JobProgressCard({ job, token, copy, date, accent, accentOn }) {
  const c = copy.job;
  const steps = job.steps || [];
  const done = steps.filter((s) => s.status === "done");
  const inProgress = steps.filter((s) => s.status === "in_progress");
  const waiting = steps.filter((s) => s.status === "waiting");
  const upNext = steps.filter((s) => s.status === "not_started");
  const total = steps.length;

  // Day N of M from the job's own dates; nothing invented when either is
  // missing. "On schedule" is measured — no undone step past its due date —
  // not assumed.
  const now = new Date();
  const start = job.startDate ? new Date(job.startDate) : null;
  const end = job.endDate ? new Date(job.endDate) : null;
  let dayLine = null;
  if (job.status === "completed") dayLine = c.finished;
  else if (start && end && end >= start) {
    const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const day = Math.min(totalDays, Math.max(1, Math.floor((now - start) / 86400000) + 1));
    if (now >= start) dayLine = `${c.dayOf(day, totalDays)} · ${job.onSchedule ? c.onSchedule : c.runningLate}`;
  }

  const pctDone = total ? (done.length / total) * 100 : 0;
  const pctActive = total ? (inProgress.length / total) * 100 : 0;
  const timeOf = (v) => {
    try {
      return new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };
  const onSite = (job.onSite || []).slice().sort((a, b) => new Date(a.since) - new Date(b.since));
  const onSiteNames = onSite.map((o) => o.name.split(" ")[0]);
  const onSiteLine =
    onSite.length > 0
      ? c.onSiteSince(
          onSiteNames.length > 1 ? `${onSiteNames.slice(0, -1).join(", ")} & ${onSiteNames[onSiteNames.length - 1]}` : onSiteNames[0],
          timeOf(onSite[0].since),
        )
      : null;

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 mb-6" data-portal-job={job.id}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase" style={{ color: accent }}>
            {c.kicker}
          </div>
          <div className="font-semibold text-[#2d2520] text-base mt-0.5">{job.title}</div>
        </div>
        {dayLine && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: accent, color: accentOn }}>
            {dayLine}
          </span>
        )}
      </div>

      {total > 0 && (
        <>
          <div className="flex gap-1 mt-3 h-2 rounded-full overflow-hidden bg-black/[0.06]" role="img" aria-label={c.stepsDone(done.length, total)}>
            {pctDone > 0 && <div style={{ width: `${pctDone}%`, backgroundColor: "#15803d" }} />}
            {pctActive > 0 && <div style={{ width: `${pctActive}%`, backgroundColor: accent }} />}
          </div>
          <div className="flex justify-between text-[11.5px] text-[#2d2520]/50 mt-1">
            <span>{start ? c.started(date(start)) : c.datesToConfirm}</span>
            <span>{end ? c.finishPlanned(date(end)) : c.stepsDone(done.length, total)}</span>
          </div>
        </>
      )}

      {done.length > 0 && (
        <Group title={c.done} color="#15803d">
          {done.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-black/5 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <Check size={14} className="shrink-0 text-green-700" />
                <span className="text-[#2d2520] truncate">{s.title}</span>
                {s.photos.length > 0 && <span className="text-[#2d2520]/45 text-xs shrink-0">· {c.photos(s.photos.length)}</span>}
              </span>
              {s.photos.length > 0 ? (
                <span className="flex gap-1 shrink-0">
                  {s.photos.slice(0, 3).map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.id} src={p.url} alt="" className="w-9 h-7 object-cover rounded" />
                  ))}
                </span>
              ) : (
                <span className="text-[#2d2520]/50 text-xs shrink-0">{s.doneAt ? date(s.doneAt) : ""}</span>
              )}
            </div>
          ))}
        </Group>
      )}

      {inProgress.length > 0 && (
        <Group title={c.inProgress} color={accent}>
          {inProgress.map((s) => {
            const latest = s.photos[s.photos.length - 1];
            return (
              <div key={s.id} className="flex gap-3 mt-1.5 p-2.5 rounded-xl" style={{ border: `1px solid ${accent}`, backgroundColor: "rgba(0,0,0,0.02)" }}>
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-semibold text-[#2d2520] flex items-center gap-2">
                    <HardHat size={14} className="shrink-0" style={{ color: accent }} />
                    {s.title}
                  </div>
                  <div className="text-[#2d2520]/60 text-xs mt-0.5">
                    {/* "Today" only when the step's day IS today; otherwise
                        its date, or nothing — never a day nobody planned. */}
                    {[
                      s.dueDate ? (new Date(s.dueDate).toDateString() === now.toDateString() ? `${c.today}, ${date(s.dueDate)}` : date(s.dueDate)) : null,
                      onSiteLine,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {latest && <div className="text-[#2d2520]/45 text-[11.5px] mt-0.5">{c.photoAdded(timeOf(latest.at))}</div>}
                </div>
                {latest && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={latest.url} alt="" className="w-24 h-16 object-cover rounded-lg shrink-0" />
                )}
              </div>
            );
          })}
        </Group>
      )}

      {waiting.length > 0 && (
        <Group title={c.waitingOn} color="#b45309">
          {waiting.map((s) => {
            const w = s.waitingOn?.[0];
            const onClient = w?.kind === "change_order";
            return (
              <div key={s.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-black/5 text-sm">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[#2d2520]">
                    <Circle size={13} className="shrink-0 text-[#2d2520]/40" />
                    {s.title}
                  </span>
                  {w && (
                    <span className="block text-xs text-[#2d2520]/60 mt-0.5 pl-5">
                      {onClient ? (
                        <>
                          {c.waitingOnApproval(w.changeOrderLabel || "")}
                          {w.shareToken && (
                            <>
                              {" · "}
                              <a href={`/co/${w.shareToken}`} className="underline font-semibold text-[#2d2520]">
                                {c.reviewAndSign}
                              </a>
                            </>
                          )}
                        </>
                      ) : w.kind === "task" ? (
                        c.waitingOnStep(w.label)
                      ) : (
                        c.waitingOnExternal(w.label)
                      )}
                    </span>
                  )}
                </span>
                {onClient ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 shrink-0">
                    {c.waitingOnYou}
                  </span>
                ) : (
                  <span className="text-[#2d2520]/50 text-xs shrink-0">{s.dueDate ? date(s.dueDate) : ""}</span>
                )}
              </div>
            );
          })}
        </Group>
      )}

      {upNext.length > 0 && (
        <Group title={c.upNext} color="#2d2520">
          {upNext.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-black/5 text-sm">
              <span className="flex items-center gap-2 min-w-0 text-[#2d2520]">
                <Clock size={13} className="shrink-0 text-[#2d2520]/40" />
                <span className="truncate">{s.title}</span>
              </span>
              <span className="text-[#2d2520]/50 text-xs shrink-0">{s.dueDate ? date(s.dueDate) : ""}</span>
            </div>
          ))}
        </Group>
      )}

      {/* Change orders waiting on the client that are not tied to a step
          still need a way in from here. */}
      {job.changeOrders?.some((co) => !waiting.some((s) => s.waitingOn?.some((w) => w.kind === "change_order" && w.changeOrderLabel === co.label))) && (
        <Group title={c.changesHeading} color="#b45309">
          {job.changeOrders
            .filter((co) => !waiting.some((s) => s.waitingOn?.some((w) => w.kind === "change_order" && w.changeOrderLabel === co.label)))
            .map((co) => (
              <div key={co.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-black/5 text-sm">
                <span className="min-w-0 text-[#2d2520]">
                  <span className="font-semibold">{co.label}</span> · {co.description}
                </span>
                <a href={`/co/${co.shareToken}`} className="underline font-semibold text-[#2d2520] text-xs shrink-0 min-h-11 inline-flex items-center">
                  {c.reviewAndSign}
                </a>
              </div>
            ))}
        </Group>
      )}

      {total > 0 && <p className="text-[11.5px] text-[#2d2520]/45 mt-3">{c.datesNote}</p>}
      {total === 0 && <p className="text-sm text-[#2d2520]/55 mt-2">{job.startDate ? c.started(date(job.startDate)) : c.datesToConfirm}</p>}
    </div>
  );
}

function Group({ title, color, children }) {
  return (
    <div className="mt-4">
      <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase" style={{ color }}>
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
