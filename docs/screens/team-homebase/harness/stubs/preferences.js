// Harness stub for CompanyPreferencesProvider: CAD money, nothing else.
export function useCompanyMoney() {
  return (n) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(n) || 0);
}
export function useCompanyPreferences() {
  return { currency: "CAD", timezone: "America/Toronto", dateFormat: "MDY" };
}
