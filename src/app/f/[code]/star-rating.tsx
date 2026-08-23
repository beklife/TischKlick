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
      <p className="text-lg font-medium text-terra">{venue.name}</p>
      <h1 className="mt-4 text-2xl font-semibold">{t('question')}</h1>
      <div className="mt-8 flex flex-row-reverse justify-center gap-2">
        {[5, 4, 3, 2, 1].map((r) => (
          <a
            key={r}
            href={`/f/${code}/${r}?t=${tapId}`}
            aria-label={t('starLabel', {count: r})}
            className="peer flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-3xl text-muted/40 shadow-sm ring-1 ring-line transition-colors hover:text-terra peer-hover:text-terra active:scale-95 active:text-terra"
          >
            ★
          </a>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">{t('ratingHint')}</p>
    </div>
  );
}
