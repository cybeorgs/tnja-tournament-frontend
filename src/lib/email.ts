// Email address checks for the forms. The backend applies the same rules again
// (Tnja-backend/src/lib/emailAddress.ts): this copy only gives quicker feedback.

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;

/** Trimmed and lower-cased, as the address is stored. */
export const normaliseEmail = (email: string) => email.trim().toLowerCase();

const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Why the address (as typed) is malformed, or null if its format is fine. */
export function emailProblem(raw: string): string | null {
  const email = normaliseEmail(raw);
  if (!email) return "Please enter your email address.";
  if (/\s/.test(email)) return "Email address can't contain spaces.";
  if (email.length > MAX_EMAIL_LENGTH) return "Email address is too long.";
  const at = email.indexOf("@");
  if (at === -1) return "Email address must contain @, e.g. name@gmail.com.";
  if (email.indexOf("@", at + 1) !== -1) return "Email address can only contain one @.";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local) return "Enter the part before @, e.g. name@gmail.com.";
  if (!domain || !domain.includes(".")) return "Email address is missing the domain, e.g. name@gmail.com.";
  if (local.length > MAX_LOCAL_LENGTH) return "Email address is too long.";
  const labels = domain.split(".");
  const tld = labels[labels.length - 1]!;
  if (!LOCAL.test(local) || !labels.every((l) => LABEL.test(l)) || !/^[a-z]{2,}$/.test(tld)) return "Enter a valid email address.";
  return null;
}

const KNOWN_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com", "rocketmail.com",
  "outlook.com", "outlook.in", "hotmail.com", "live.com", "live.in", "msn.com", "icloud.com", "me.com",
  "rediffmail.com", "protonmail.com", "proton.me", "zoho.com", "zohomail.in", "aol.com", "mail.com", "gmx.com", "yandex.com",
];
const KNOWN = new Set(KNOWN_DOMAINS);

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/** hari@gamil.com → hari@gmail.com when the domain looks like a typo of a common provider, else null. */
export function suggestEmail(raw: string): string | null {
  const email = normaliseEmail(raw);
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1);
  if (!domain || KNOWN.has(domain)) return null;
  const maxDistance = domain.length <= 7 ? 1 : 2;
  let best: { domain: string; d: number } | null = null;
  for (const known of KNOWN_DOMAINS) {
    const d = distance(domain, known);
    if (d <= maxDistance && (!best || d < best.d)) best = { domain: known, d };
  }
  return best ? `${email.slice(0, at)}@${best.domain}` : null;
}
