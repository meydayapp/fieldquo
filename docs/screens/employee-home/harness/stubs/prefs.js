// Harness stub of CompanyPreferencesProvider: Monday weeks, CAD money.
const money = (n) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(n) || 0);
const prefs = { currency: "CAD", dateFormat: "MM/DD/YYYY", weekStartsOn: 1, money, formatDate: (v) => new Date(v).toLocaleDateString(), formatDateTime: (v) => new Date(v).toLocaleString() };
export function useCompanyPreferences() { return prefs; }
export function useCompanyMoney() { return money; }
export function CompanyPreferencesProvider({ children }) { return children; }
