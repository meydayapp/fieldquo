// app/components/quotes/builder/fields.js
//
// The small form parts the quote-builder screens share.
//
// These lived in TradeTakeoff.js, and PaverDesigner.js copied them because
// that file exported only its entry point. The two copies had already drifted
// before either shipped — one Num took a `prefix` for a dollar sign, the other
// a `suffix` for a unit and an `id` for a label — which is the copy-that-rots
// failure exactly: not a rename anybody would notice, just two things that
// look identical and behave differently depending on which screen you are on.
//
// One Num, doing both.
"use client";

export const inputClass =
  "w-full mt-1 border border-border rounded px-2 py-1.5 text-sm";

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const money = (v) => num(v).toFixed(2);
export const asList = (v) => (Array.isArray(v) ? v : []);

export function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/**
 * A number input.
 *
 * `prefix` sits inside the left edge (a currency symbol), `suffix` inside the
 * right (a unit). Padding is added only on the side that has one, so a field
 * with neither is not mysteriously indented.
 */
export function Num({
  value,
  onChange,
  min = 0,
  step = 1,
  prefix,
  suffix,
  id,
  disabled = false,
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {prefix}
        </span>
      )}
      <input
        id={id}
        type="number"
        min={min}
        step={step}
        disabled={disabled}
        // Two rules, both learned by rendering this rather than reading it.
        //
        // A genuine zero renders as 0 and an empty box stays empty, so this
        // is `=== 0 ? 0 : value || ""` and not `value ?? ""` — otherwise the
        // field snaps to 0 while somebody is halfway through typing.
        //
        // And a non-finite value renders as empty, never as itself. Stored
        // JSON can hold 1e400, which is Infinity by the time it reaches here,
        // and React will happily paint the word "Infinity" into a number
        // input. The pricing has always clamped it; the input did not.
        value={value === 0 ? 0 : Number.isFinite(Number(value)) ? value : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? 0 : Number(e.target.value))
        }
        className={`${inputClass} ${prefix ? "pl-5" : ""} ${suffix ? "pr-8" : ""}`}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

/**
 * A scope option: tick it and it prices itself.
 *
 * The label carries the arithmetic — "$2.50/sqft × 300 = $750" — because the
 * question an estimator is actually asking is what adding this does to the
 * number, and a bare checkbox makes them open a calculator to find out.
 */
export function OptionRow({
  checked,
  onToggle,
  label,
  hint,
  amount,
  children,
  disabled = false,
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
      <input
        type="checkbox"
        className="mt-1"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </span>
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {amount > 0 ? (
              `$${money(amount)}`
            ) : (
              <span className="font-normal text-muted-foreground">—</span>
            )}
          </span>
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        {checked && children}
      </div>
    </div>
  );
}
