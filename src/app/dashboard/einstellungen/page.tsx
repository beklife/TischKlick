import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getActiveVenue, getOwnerVenues} from '@/lib/venues';
import {searchPlaces, type PlaceResult} from '@/lib/google';
import {GooglePlaceSearch} from '@/components/google-place-search';
import {switchVenue} from '@/app/dashboard/venue-actions';
import {updateVenueName, uploadLogo} from './actions';

type Props = {searchParams: Promise<{q?: string; gespeichert?: string}>};

export default async function EinstellungenPage({searchParams}: Props) {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const sp = await searchParams;
  const t = await getTranslations('settings');
  const to = await getTranslations('onboarding');
  const tc = await getTranslations('common');
  const venues = await getOwnerVenues();

  const query = (sp.q ?? '').trim();
  let results: PlaceResult[] = [];
  let searchFailed = false;
  if (query) {
    try {
      results = await searchPlaces(query);
    } catch {
      searchFailed = true;
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="display text-2xl">{t('title')}</h1>
      {sp.gespeichert ? (
        <p className="rounded-2xl border border-zest/40 bg-zest/10 p-3 text-sm text-zest">✓ {t('saved')}</p>
      ) : null}

      {venues.length > 1 ? (
        <form action={switchVenue} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="venueId" className="text-sm font-medium">{t('venueLabel')}</label>
            <select id="venueId" name="venueId" defaultValue={venue.id}
              className="mt-1 w-full rounded-2xl border border-hair bg-shell p-3 text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none">
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-2xl border border-hair bg-shell-2 px-4 py-3 text-sm font-semibold text-ash transition-colors hover:border-hair-2 hover:text-chalk">
            {t('switchButton')}
          </button>
        </form>
      ) : null}

      <form action={updateVenueName} className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">{t('nameLabel')}</label>
        <div className="flex flex-wrap gap-2">
          <input type="hidden" name="venueId" value={venue.id} />
          <input id="name" name="name" defaultValue={venue.name} required maxLength={120}
            className="min-w-0 flex-1 rounded-2xl border border-hair bg-shell p-3 text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none" />
          <button type="submit" className="rounded-2xl flame-grad px-4 py-2 font-display text-sm font-bold tracking-tight text-void transition-transform active:scale-[0.98]">
            {tc('save')}
          </button>
        </div>
      </form>

      <form action={uploadLogo} className="space-y-2">
        <label htmlFor="logo" className="text-sm font-medium">{t('logoLabel')}</label>
        {/* A file input will not shrink below its native button, so the row
            stacks on narrow screens rather than pushing the page sideways. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="venueId" value={venue.id} />
          <input id="logo" name="logo" type="file" accept="image/png,image/jpeg" required
            className="w-full min-w-0 rounded-xl border border-hair bg-shell p-2 text-sm text-chalk transition-colors focus:border-flame/60 focus:outline-none sm:flex-1" />
          <button type="submit" className="rounded-2xl flame-grad px-4 py-2 font-display text-sm font-bold tracking-tight text-void transition-transform active:scale-[0.98]">
            {t('logoButton')}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">{t('googleTitle')}</h2>
        {venue.googleReviewUrl ? (
          <p className="text-sm text-zest">
            ✓ {to('connected')} ·{' '}
            <a href={venue.googleReviewUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {to('testLink')}
            </a>
          </p>
        ) : null}
        <GooglePlaceSearch
          venueId={venue.id}
          query={query}
          results={results}
          searchFailed={searchFailed}
          searchAction="/dashboard/einstellungen"
          backPath="/dashboard/einstellungen?gespeichert=1"
        />
      </section>

      <Link href="/dashboard/onboarding" className="inline-block text-sm text-ash underline">
        + {t('newVenue')}
      </Link>
    </div>
  );
}
