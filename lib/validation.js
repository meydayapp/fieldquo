// lib/validation.js
export function formatPhoneInput(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);

  if (digits.length <= 3) return a;
  if (digits.length <= 6) return `${a}-${b}`;
  return `${a}-${b}-${c}`;
}

export function isValidPhone(value) {
  return /^\d{3}-\d{3}-\d{4}$/.test(value || "");
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
}
