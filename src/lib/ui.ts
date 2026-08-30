// Shared class vocabulary for the dashboard. These screens are all the same
// handful of shapes — a field, a button, a panel — and keeping the strings in
// one place is what stops six pages from drifting into six dialects.

export const FIELD =
  'rounded-2xl border border-hair bg-shell p-3 text-[0.9375rem] text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none';

export const BTN_PRIMARY =
  'rounded-2xl flame-grad px-5 py-3 font-display text-sm font-bold tracking-tight text-white transition-transform active:scale-[0.98] disabled:opacity-50';

export const BTN_GHOST =
  'rounded-2xl border border-hair bg-shell-2 px-4 py-3 text-sm font-semibold text-ash transition-colors hover:border-hair-2 hover:text-chalk';

export const BTN_ICON =
  'rounded-lg border border-hair bg-shell-2 px-2 py-1 text-[0.6875rem] text-ash transition-colors hover:border-hair-2 hover:text-chalk disabled:opacity-30 disabled:hover:border-hair';

export const BTN_DANGER =
  'rounded-lg px-2 py-1 text-[0.6875rem] font-medium text-ash-2 transition-colors hover:text-berry';

export const PANEL = 'rounded-3xl panel p-4';

export const H1 = 'display text-2xl';

export const LABEL = 'text-sm font-semibold tracking-tight text-chalk';

export const HINT = 'text-sm leading-relaxed text-ash';
