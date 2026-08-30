import {getTranslations} from 'next-intl/server';
import Image from 'next/image';

type Props = {
  code: string;
  tapId: string;
  venue: {name: string; logoUrl: string | null};
};

export async function StarRating({code, tapId, venue}: Props) {
  const t = await getTranslations('guest');
  return (
    <div className="relative text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-80 -translate-x-1/2 rounded-full bg-flame/20 blur-[70px] animate-glow"
      />

      <div className="relative">
        {venue.logoUrl ? (
          <div className="mx-auto mb-5 w-fit rounded-full flame-grad p-[2px]">
            <Image
              src={venue.logoUrl}
              alt={venue.name}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover ring-4 ring-void"
              unoptimized
            />
          </div>
        ) : null}

        <p className="eyebrow">{venue.name}</p>
        <h1 className="mt-3 display text-[1.85rem] text-balance">{t('question')}</h1>

        {/* Reverse row + peer selectors: hovering a star lights every star to
            its left, the way a real rating control behaves. */}
        <div className="mt-9 flex flex-row-reverse justify-center gap-1.5">
          {[5, 4, 3, 2, 1].map((r) => (
            <a
              key={r}
              href={`/f/${code}/${r}?t=${tapId}`}
              aria-label={t('starLabel', {count: r})}
              className="peer flex h-15 w-15 items-center justify-center rounded-2xl border border-hair-2 bg-shell-2 text-[2rem] leading-none text-ash-2 transition-all duration-150 hover:scale-110 hover:border-flame hover:bg-flame/15 hover:text-flame peer-hover:border-flame peer-hover:bg-flame/15 peer-hover:text-flame active:scale-95"
            >
              ★
            </a>
          ))}
        </div>

        <p className="mx-auto mt-7 max-w-[17rem] text-sm leading-relaxed text-ash text-balance">
          {t('ratingHint')}
        </p>
      </div>
    </div>
  );
}
