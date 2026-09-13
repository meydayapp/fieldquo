"use client";

// app/components/team/AttendanceChip.js
//
// The rota's verdict on one shift, as a chip: on time, late (with the
// minutes), no-show, early out. Drawn on the day board's block and on the
// timesheet row from the same ShiftAttendance row, so the two never
// disagree. Nothing when there is no verdict — a shift the cron has not
// judged yet is not "on time", it is unjudged.
//
// A provisional verdict (the shift is still under way) is drawn hollow, a
// final one filled: "late" at 8:12 and "late" at 17:00 are the same fact, but
// only the second is the day's record.

const TONE = {
  on_time: "border-emerald-500 text-emerald-800 dark:text-emerald-200",
  late: "border-amber-500 text-amber-900 dark:text-amber-200",
  early_out: "border-amber-500 text-amber-900 dark:text-amber-200",
  no_show: "border-red-500 text-red-800 dark:text-red-200",
};
const FILL = {
  on_time: "bg-emerald-100 dark:bg-emerald-900/50",
  late: "bg-amber-100 dark:bg-amber-900/50",
  early_out: "bg-amber-100 dark:bg-amber-900/50",
  no_show: "bg-red-100 dark:bg-red-900/50",
};

export function attendanceLabel(a, t) {
  if (!a?.status) return "";
  switch (a.status) {
    case "late":
      return a.lateMinutes ? t("app.attendance.lateBy", { minutes: a.lateMinutes }) : t("app.attendance.late");
    case "early_out":
      return a.earlyMinutes ? t("app.attendance.earlyBy", { minutes: a.earlyMinutes }) : t("app.attendance.earlyOut");
    case "no_show":
      return t("app.attendance.noShow");
    case "on_time":
      return t("app.attendance.onTime");
    default:
      return "";
  }
}

export default function AttendanceChip({ attendance, t, size = "sm", className = "" }) {
  if (!attendance?.status || !TONE[attendance.status]) return null;
  const label = attendanceLabel(attendance, t);
  const title = attendance.final ? label : `${label} · ${t("app.attendance.provisional")}`;
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center rounded-full border font-semibold leading-none ${
        size === "xs" ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
      } ${TONE[attendance.status]} ${attendance.final ? FILL[attendance.status] : "bg-transparent"} ${className}`}
    >
      {label}
    </span>
  );
}
