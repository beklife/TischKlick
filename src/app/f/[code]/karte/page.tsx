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
    <div className="py-2">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-[1.75rem]">{t('menuTitle')}</h1>
          <p className="mt-1.5 text-sm font-medium text-flame">{table.venue.name}</p>
        </div>
        <Link
          href={`/f/${code}?t=${tapId}`}
          className="mt-1 shrink-0 rounded-full border border-hair bg-shell px-3.5 py-1.5 text-xs font-semibold text-ash transition-colors hover:border-hair-2 hover:text-chalk"
        >
          {tc('back')}
        </Link>
      </header>

      {allItems.length === 0 ? (
        <p className="mt-10 rounded-3xl panel p-6 text-sm text-ash">{t('menuEmpty')}</p>
      ) : (
        <div className="mt-9 space-y-10">
          {categories
            .filter((category) => category.items.length > 0)
            .map((category) => (
              <section key={category.id}>
                <div className="flex items-center gap-3">
                  <h2 className="eyebrow text-flame">{category.name}</h2>
                  <span aria-hidden className="h-px flex-1 bg-hair" />
                </div>

                <ul className="mt-4 space-y-1">
                  {category.items.map((item) => {
                    const price = formatPriceCents(item.priceCents);
                    const codes = [...item.allergens, ...item.additives];
                    return (
                      <li
                        key={item.id}
                        className={`flex gap-3.5 rounded-2xl p-2.5 transition-colors ${
                          item.soldOut ? 'opacity-45' : 'hover:bg-shell/70'
                        }`}
                      >
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            width={72}
                            height={72}
                            className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-hair"
                            unoptimized
                          />
                        ) : null}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="font-semibold tracking-tight">
                              {item.name}
                              {codes.length > 0 ? (
                                <sup className="ml-1 text-[0.625rem] font-normal text-ash-2">
                                  {codes.join(',')}
                                </sup>
                              ) : null}
                            </p>
                            {/* Dotted leader: the classic menu device that ties a
                                dish to its price without a hard column rule. */}
                            <span
                              aria-hidden
                              className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-hair-2"
                            />
                            {price ? (
                              <p className="shrink-0 font-display text-sm font-semibold tabular-nums text-chalk">
                                {price}
                              </p>
                            ) : null}
                          </div>

                          {item.description ? (
                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ash">
                              {item.description}
                            </p>
                          ) : null}

                          {item.dietTags.length > 0 || item.soldOut ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.dietTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-zest/25 bg-zest/10 px-2 py-0.5 text-[0.6875rem] font-medium text-zest"
                                >
                                  {t(`diet.${tag}`)}
                                </span>
                              ))}
                              {item.soldOut ? (
                                <span className="rounded-full border border-hair-2 px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide text-ash-2 uppercase">
                                  {t('soldOut')}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
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
        <section className="mt-12 rounded-3xl border border-hair bg-shell/50 p-4">
          <h2 className="eyebrow">{t('legendTitle')}</h2>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-ash">
            {[...legend.allergens, ...legend.additives]
              .map(([code, label]) => `${code} ${label}`)
              .join(' · ')}
          </p>
        </section>
      ) : null}
    </div>
  );
}
