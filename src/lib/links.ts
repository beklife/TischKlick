// Owner-supplied hub link URLs. The owner is trusted-ish, but their guests are
// not: a pasted javascript:/data: URL would execute in every guest's browser,
// so validation happens once, on save, and the stored value is the safe one.
export const MAX_LINK_URL_LENGTH = 500;

// Lives here rather than in the server-action file: a module with the
// 'use server' directive may only export async functions, so a plain constant
// exported from actions.ts would fail the build.
export const MAX_CUSTOM_LINKS = 12;

const MAILTO_RE = /^mailto:[^\s@]+@[^\s@.]+\.[^\s@]+$/i;
const TEL_RE = /^tel:\+?[0-9][0-9\s()/-]{2,30}$/i;
const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeLinkUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_LINK_URL_LENGTH) return null;

  // Protocol-relative: it would silently inherit our scheme. Ambiguous enough
  // that rejecting it and letting the owner retype is the honest answer.
  if (trimmed.startsWith('//')) return null;

  if (/^mailto:/i.test(trimmed)) return MAILTO_RE.test(trimmed) ? trimmed : null;
  if (/^tel:/i.test(trimmed)) {
    return TEL_RE.test(trimmed) ? trimmed.replace(/[\s()/-]/g, '') : null;
  }

  const candidate = HAS_SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  // Rejects http:, javascript:, data:, vbscript:, file: in one check.
  if (url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;

  const href = url.toString();
  return href.length <= MAX_LINK_URL_LENGTH ? href : null;
}
