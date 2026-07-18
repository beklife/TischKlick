import {getTranslations} from 'next-intl/server';
import Image from 'next/image';
import {getTableByCode, recordTap} from '@/lib/guest';
import {InvalidLink} from '../invalid-link';

export const dynamic = 'force-dynamic';

export default async function GuestRatingPage({params}: {params: Promise<{code: string}>}) {
  const {code} = await params;
  const table = await getTableByCode(code);
  const t = await getTranslations('guest');
  if (!table) return <InvalidLink />;

  const tapId = await recordTap(table.id, table.venue.id);

  return (
    <div className="text-center">
      {table.venue.logoUrl ? (
        <Image
          src={table.venue.logoUrl}
          alt={table.venue.name}
          width={96}
          height={96}
          className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
          unoptimized
        />
      ) : null}
      <p className="text-lg font-medium text-terra">{table.venue.name}</p>
      <h1 className="mt-4 text-2xl font-semibold">{t('question')}</h1>
      <div className="mt-8 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((r) => (
          <a
            key={r}
            href={`/f/${code}/${r}?t=${tapId}`}
            aria-label={t('starLabel', {count: r})}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-3xl text-terra shadow-sm ring-1 ring-line active:scale-95"
          >
            ★
          </a>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">{t('ratingHint')}</p>
    </div>
  );
}
