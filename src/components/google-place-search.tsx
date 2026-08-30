import {getTranslations} from 'next-intl/server';
import type {PlaceResult} from '@/lib/google';
import {selectPlace, saveManualUrl} from '@/app/dashboard/onboarding/actions';

type Props = {
  venueId: string;
  query: string;
  results: PlaceResult[];
  searchFailed: boolean;
  searchAction: string; // path of the page rendering this component (GET form target)
  backPath: string;
};

export async function GooglePlaceSearch({venueId, query, results, searchFailed, searchAction, backPath}: Props) {
  const t = await getTranslations('onboarding');
  return (
    <div className="space-y-6">
      <form action={searchAction} method="get" className="flex flex-wrap gap-2">
        <input type="hidden" name="venue" value={venueId} />
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t('searchPlaceholder')}
          className="min-w-0 flex-1 rounded-2xl border border-hair bg-shell p-3 text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none"
        />
        <button type="submit" className="shrink-0 rounded-2xl flame-grad px-4 py-2 font-display text-sm font-bold tracking-tight text-void transition-transform active:scale-[0.98]">
          {t('searchButton')}
        </button>
      </form>

      {searchFailed ? (
        <p className="rounded-2xl border border-berry/40 bg-berry/10 p-3 text-sm text-berry">{t('searchFailed')}</p>
      ) : null}
      {query && !searchFailed && results.length === 0 ? (
        <p className="text-sm text-ash">{t('noResults')}</p>
      ) : null}

      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.placeId} className="flex items-center justify-between gap-3 rounded-2xl border border-hair bg-shell p-3 text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-ash">{r.address}</p>
            </div>
            <form action={selectPlace}>
              <input type="hidden" name="venueId" value={venueId} />
              <input type="hidden" name="placeId" value={r.placeId} />
              <input type="hidden" name="backPath" value={backPath} />
              <button type="submit" className="rounded-lg bg-zest px-3 py-2 text-sm font-bold text-void transition-opacity hover:opacity-90">
                {t('selectButton')}
              </button>
            </form>
          </li>
        ))}
      </ul>

      <details className="rounded-2xl border border-hair bg-shell p-3 text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none">
        <summary className="cursor-pointer text-sm font-medium">{t('manualTitle')}</summary>
        <form action={saveManualUrl} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="venueId" value={venueId} />
          <input type="hidden" name="backPath" value={backPath} />
          <input
            name="url"
            type="url"
            required
            placeholder="https://g.page/r/..."
            aria-label={t('manualLabel')}
            className="min-w-0 flex-1 rounded-2xl border border-hair bg-shell p-3 text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none text-sm"
          />
          <button type="submit" className="shrink-0 rounded-xl border border-hair bg-shell-2 px-3 py-2 text-sm font-semibold text-ash transition-colors hover:border-hair-2 hover:text-chalk">
            {t('manualButton')}
          </button>
        </form>
      </details>
    </div>
  );
}
