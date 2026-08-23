import {getTranslations} from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import {getTableByCode, recordTap, cleanTapId, markMenuViewed} from '@/lib/guest';
import {getVenueMenu} from '@/lib/hub';
import {buildLegend} from '@/lib/menu';
import {formatPriceCents} from '@/lib/money';
import {InvalidLink} from '../../invalid-link';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{code: string}>;
  searchParams: Promise<{t?: string}>;
};

export default async function KartePage({params, searchParams}: Props) {
  const {code} = await params;
  const sp = await searchParams;
  const table = await getTableByCode(code);
  const t = await getTranslations('guest');
  const tc = await getTranslations('common');
  if (!table) return <InvalidLink />;

  const tapId = cleanTapId(sp.t) ?? (await recordTap(table.id, table.venue.id));
  await markMenuViewed(tapId, table.id);

  const categories = await getVenueMenu(table.venue.id);
  const allItems = categories.flatMap((c) => c.items);
  const legend = buildLegend(allItems);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{t('menuTitle')}</h1>
        <Link href={`/f/${code}?t=${tapId}`} className="text-sm text-muted underline">
          {tc('back')}
        </Link>
      </div>
      <p className="mt-1 text-sm text-terra">{table.venue.name}</p>

      {allItems.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-card p-6 text-muted ring-1 ring-line">
          {t('menuEmpty')}
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {categories
            .filter((category) => category.items.length > 0)
            .map((category) => (
              <section key={category.id}>
                <h2 className="border-b border-line pb-2 text-sm font-semibold tracking-wide text-muted uppercase">
                  {category.name}
                </h2>
                <ul className="mt-3 space-y-4">
                  {category.items.map((item) => {
                    const price = formatPriceCents(item.priceCents);
                    const codes = [...item.allergens, ...item.additives];
                    return (
                      <li
                        key={item.id}
                        className={`flex gap-3 ${item.soldOut ? 'opacity-50' : ''}`}
                      >
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            width={72}
                            height={72}
                            className="h-18 w-18 shrink-0 rounded-xl object-cover"
                            unoptimized
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="font-medium">
                              {item.name}
                              {codes.length > 0 ? (
                                <sup className="ml-1 text-xs font-normal text-muted">
                                  {codes.join(',')}
                                </sup>
                              ) : null}
                            </p>
                            {price ? (
                              <p className="shrink-0 tabular-nums">{price}</p>
                            ) : null}
                          </div>
                          {item.description ? (
                            <p className="mt-0.5 text-sm text-muted">{item.description}</p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.dietTags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-sage/10 px-2 py-0.5 text-xs text-sage"
                              >
                                {t(`diet.${tag}`)}
                              </span>
                            ))}
                            {item.soldOut ? (
                              <span className="rounded-full bg-line px-2 py-0.5 text-xs text-muted">
                                {t('soldOut')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}

      {legend.allergens.length > 0 || legend.additives.length > 0 ? (
        <section className="mt-10 border-t border-line pt-4">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t('legendTitle')}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {[...legend.allergens, ...legend.additives]
              .map(([code, label]) => `${code} ${label}`)
              .join(' · ')}
          </p>
        </section>
      ) : null}
    </div>
  );
}
