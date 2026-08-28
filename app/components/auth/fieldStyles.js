// app/components/auth/fieldStyles.js
//
// One input style, shared by /login and every step of /signup.
//
// It was three copies of the same string — the login form, CompanyFields and
// the account step each carried their own `w-full mt-1 border rounded-lg px-4
// py-2.5 text-sm`, and they had already drifted: only some of them turned red
// on an error, none of them said anything on focus, and the readonly city and
// province boxes were the only ones with a background. The copy is the one that
// rots, so there is now one.
//
// Two things this adds that no copy had:
//
//   · a FOCUS state. A field that looks identical whether or not the caret is
//     in it is the single cheapest way to make a form feel unfinished, and on a
//     keyboard it is an accessibility failure rather than a taste one.
//   · `--destructive` instead of `border-red-400`. Both themes define
//     --destructive (#c62828 / #ef5350); `red-400` is one value chosen against
//     a white card, and these pages already ship a dark palette even though
//     ThemeProvider's allow-list does not currently switch them (see AuthShell).
//
// `bg-background` rather than transparent: the card is --card and the field is
// --background, so the input is a recess in the panel in light mode and in
// dark. Both are palette values, so neither is guessed.

const BASE =
  "w-full mt-1 rounded-lg border px-4 py-2.5 text-sm bg-background text-foreground " +
  "placeholder:text-muted-foreground transition-colors " +
  "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

/**
 * The class list for a text input or select.
 *
 * @param invalid  this field currently has an error under it. The border is the
 *                 only thing that changes — the message underneath is what says
 *                 what is wrong, and a red border with no sentence is a puzzle.
 */
export function fieldClass(invalid = false) {
  return `${BASE} ${invalid ? "border-destructive" : "border-border"}`;
}

/** Read-only boxes (city, province) — filled in from the address, not typed. */
export const READONLY_FIELD =
  "w-full mt-1 rounded-lg border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground";

/** The label above a field. */
export const FIELD_LABEL = "text-sm font-medium text-foreground";

/** The message under a field that failed validation. */
export const FIELD_ERROR = "text-xs text-red-600 dark:text-red-400 mt-1";

/** The one primary action on a form. */
export const PRIMARY_BUTTON =
  "w-full bg-inverted text-inverted-foreground py-3 rounded-lg text-sm font-semibold " +
  "transition-opacity hover:opacity-90 disabled:opacity-60";
