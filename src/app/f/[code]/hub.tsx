import Image from 'next/image';
import Link from 'next/link';
import type {HubBlock} from '@/lib/hub';

type Props = {
  code: string;
  tapId: string;
  venue: {name: string; logoUrl: string | null; hubTagline: string | null};
  blocks: HubBlock[];
};

function blockHref(block: HubBlock, code: string, tapId: string): string {
  if (block.kind === 'menu') return `/f/${code}/karte?t=${tapId}`;
  if (block.kind === 'review') return `/f/${code}/bewerten?t=${tapId}`;
  return block.url!;
}

// Fallback mark when a venue has no logo: its initials, so the page never
// opens with a hole where the identity should be.
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => [...w][0]!.toUpperCase())
    .join('');
}

export function Hub({code, tapId, venue, blocks}: Props) {
  return (
    <div className="relative">
      {/* Heat bloom behind the identity — the page's only light source. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[min(22rem,100%)] -translate-x-1/2 rounded-full bg-flame/25 blur-[80px] animate-glow"
      />

      <div className="relative text-center">
        {venue.logoUrl ? (
          <div className="mx-auto mb-5 w-fit rounded-full flame-grad p-[2px] flame-glow">
            <Image
              src={venue.logoUrl}
              alt={venue.name}
              width={104}
              height={104}
              className="h-26 w-26 rounded-full object-cover ring-4 ring-void"
              unoptimized
            />
          </div>
        ) : (
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-hair-2 bg-shell-2 display text-2xl text-flame">
            {initials(venue.name)}
          </div>
        )}

        <h1 className="display text-[2rem] leading-[1.05] text-balance">{venue.name}</h1>

        {venue.hubTagline ? (
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ash text-balance">
            {venue.hubTagline}
          </p>
        ) : null}
      </div>

      <ul className="mt-9 space-y-3">
        {blocks.map((block, i) => {
          const href = blockHref(block, code, tapId);
          const isReview = block.kind === 'review';

          // The review block is the point of the product, so it carries the
          // heat. Everything else stays quiet and lets it lead.
          const shell = isReview
            ? 'flame-grad flame-glow text-void'
            : 'panel text-chalk transition-[transform,border-color,background-color] hover:border-hair-2 hover:bg-shell-2';

          const inner = (
            <>
              <span
                aria-hidden
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${
                  isReview ? 'bg-void/15' : 'bg-shell-2 group-hover:bg-shell-3'
                }`}
              >
                {block.icon}
              </span>
              <span className="flex-1 text-left text-[0.975rem] font-semibold tracking-tight">
                {block.label}
              </span>
              <span
                aria-hidden
                className={`text-lg transition-transform group-hover:translate-x-0.5 ${
                  isReview ? 'text-void/55' : 'text-ash-2'
                }`}
              >
                →
              </span>
            </>
          );

          const className = `group flex w-full items-center gap-3.5 rounded-3xl px-4 py-3.5 active:scale-[0.985] transition-transform ${shell}`;

          return (
            <li key={block.id} className="rise-in" style={{'--i': i + 1} as React.CSSProperties}>
              {block.kind === 'custom' ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                  {inner}
                </a>
              ) : (
                <Link href={href} className={className}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
