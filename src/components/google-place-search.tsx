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
      <form action={searchAction} method="get" className="flex gap-2">
        <input type="hidden" name="venue" value={venueId} />
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t('searchPlaceholder')}
          className="flex-1 rounded-xl border border-line bg-card p-3"
        />
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {t('searchButton')}
        </button>
      </form>

      {searchFailed ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('searchFailed')}</p>
      ) : null}
      {query && !searchFailed && results.length === 0 ? (
        <p className="text-sm text-muted">{t('noResults')}</p>
      ) : null}

      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.placeId} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-3">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-muted">{r.address}</p>
            </div>
            <form action={selectPlace}>
              <input type="hidden" name="venueId" value={venueId} />
              <input type="hidden" name="placeId" value={r.placeId} />
              <input type="hidden" name="backPath" value={backPath} />
              <button type="submit" className="rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white">
                {t('selectButton')}
              </button>
            </form>
          </li>
        ))}
      </ul>

      <details className="rounded-xl border border-line bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium">{t('manualTitle')}</summary>
        <form action={saveManualUrl} className="mt-3 flex gap-2">
          <input type="hidden" name="venueId" value={venueId} />
          <input type="hidden" name="backPath" value={backPath} />
          <input
            name="url"
            type="url"
            required
            placeholder="https://g.page/r/..."
            aria-label={t('manualLabel')}
            className="flex-1 rounded-xl border border-line bg-card p-3 text-sm"
          />
          <button type="submit" className="rounded-xl border border-line px-3 py-2 text-sm font-medium">
            {t('manualButton')}
          </button>
        </form>
      </details>
    </div>
  );
}
