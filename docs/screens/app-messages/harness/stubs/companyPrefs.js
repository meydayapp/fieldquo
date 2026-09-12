// Harness stub for @/app/providers/CompanyPreferencesProvider.
const fmt = (v) => { const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA"); };
export function useCompanyPreferences() {
  return { dateFormat: "YYYY-MM-DD", weekStartsOn: 1, currency: "CAD", formatDate: fmt, formatDateTime: (v) => fmt(v) + " " + new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), money: (n) => "CA$" + Number(n).toFixed(2) };
}
export function useCompanyMoney() { return (n) => "CA$" + Number(n).toFixed(2); }
export default function CompanyPreferencesProvider({ children }) { return children; }
