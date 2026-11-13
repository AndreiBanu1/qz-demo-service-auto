const TEST_ADDRESS = /^[^\s@]+@[^\s@]+\.test$/;

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function isTestAddress(s: string): boolean {
  return TEST_ADDRESS.test(normalizeEmail(s));
}

export function maskEmail(s: string): string {
  const at = s.indexOf('@');
  if (at < 1) return s;
  return `${s[0]}***${s.slice(at)}`;
}
