export const MAX_PRICE_CENTS = 1_000_000;

const priceFormatter = new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR'});

export function formatPriceCents(cents: number | null | undefined): string | null {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return null;
  return priceFormatter.format(cents / 100);
}

// Empty means "no fixed price" (Tagespreis) and is a valid state, so it returns
// null. Malformed input is a mistake the owner must see, so it throws — the
// server action catches and redirects with ?fehler=1.
export function parsePriceInput(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.trim().replace(/[\s€]/g, '');
  if (!compact) return null;
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(compact)) {
    throw new RangeError(`Ungültiger Preis: ${raw}`);
  }
  const cents = Math.round(Number(compact.replace(',', '.')) * 100);
  if (cents > MAX_PRICE_CENTS) {
    throw new RangeError(`Preis außerhalb des zulässigen Bereichs: ${raw}`);
  }
  return cents;
}
