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
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      {sp.gespeichert ? (
        <p className="rounded-xl bg-card p-3 text-sm text-sage ring-1 ring-sage">✓ {t('saved')}</p>
      ) : null}

      {venues.length > 1 ? (
        <form action={switchVenue} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="venueId" className="text-sm font-medium">{t('venueLabel')}</label>
            <select id="venueId" name="venueId" defaultValue={venue.id}
              className="mt-1 w-full rounded-xl border border-line bg-card p-3">
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-xl border border-line px-4 py-3 text-sm font-medium">
            {t('switchButton')}
          </button>
        </form>
      ) : null}

      <form action={updateVenueName} className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">{t('nameLabel')}</label>
        <div className="flex gap-2">
          <input type="hidden" name="venueId" value={venue.id} />
          <input id="name" name="name" defaultValue={venue.name} required maxLength={120}
            className="flex-1 rounded-xl border border-line bg-card p-3" />
          <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
            {tc('save')}
          </button>
        </div>
      </form>

      <form action={uploadLogo} className="space-y-2">
        <label htmlFor="logo" className="text-sm font-medium">{t('logoLabel')}</label>
        <div className="flex gap-2">
          <input type="hidden" name="venueId" value={venue.id} />
          <input id="logo" name="logo" type="file" accept="image/png,image/jpeg" required
            className="flex-1 rounded-xl border border-line bg-card p-2 text-sm" />
          <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
            {t('logoButton')}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">{t('googleTitle')}</h2>
        {venue.googleReviewUrl ? (
          <p className="text-sm text-sage">
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

      <Link href="/dashboard/onboarding" className="inline-block text-sm text-muted underline">
        + {t('newVenue')}
      </Link>
    </div>
  );
}
