import Image from 'next/image';
import Link from 'next/link';
import type {HubBlock} from '@/lib/hub';

type Props = {
  code: string;
  tapId: string;
  venue: {name: string; logoUrl: string | null; hubTagline: string | null};
  blocks: HubBlock[];
};

// The review block is the point of the product, so it gets the filled treatment
// and everything else stays quiet.
const PRIMARY = 'bg-terra text-white shadow active:bg-terra-dark';
const SECONDARY = 'bg-card text-ink ring-1 ring-line active:bg-cream';

function blockHref(block: HubBlock, code: string, tapId: string): string {
  if (block.kind === 'menu') return `/f/${code}/karte?t=${tapId}`;
  if (block.kind === 'review') return `/f/${code}/bewerten?t=${tapId}`;
  return block.url!;
}

export function Hub({code, tapId, venue, blocks}: Props) {
  return (
    <div>
      <div className="text-center">
        {venue.logoUrl ? (
          <Image
            src={venue.logoUrl}
            alt={venue.name}
            width={96}
            height={96}
            className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
            unoptimized
          />
        ) : null}
        <h1 className="text-2xl font-semibold">{venue.name}</h1>
        {venue.hubTagline ? (
          <p className="mt-1 text-sm text-muted">{venue.hubTagline}</p>
        ) : null}
      </div>

      <ul className="mt-8 space-y-3">
        {blocks.map((block) => {
          const href = blockHref(block, code, tapId);
          const className = `flex items-center gap-4 rounded-2xl px-5 py-4 text-base font-medium ${
            block.kind === 'review' ? PRIMARY : SECONDARY
          }`;
          const inner = (
            <>
              {block.icon ? (
                <span aria-hidden className="text-2xl leading-none">
                  {block.icon}
                </span>
              ) : null}
              <span className="flex-1">{block.label}</span>
              <span aria-hidden className="opacity-40">
                ›
              </span>
            </>
          );
          return (
            <li key={block.id}>
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
