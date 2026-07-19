import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {searchPlaces, type PlaceResult} from '@/lib/google';
import {GooglePlaceSearch} from '@/components/google-place-search';
import {createVenue} from './actions';

type Props = {searchParams: Promise<{venue?: string; q?: string}>};

export default async function OnboardingPage({searchParams}: Props) {
  const sp = await searchParams;
  const t = await getTranslations('onboarding');

  // Phase 1: no venue yet — name form.
  if (!sp.venue) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <form action={createVenue} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium">{t('nameLabel')}</label>
            <input id="name" name="name" required maxLength={120} placeholder={t('namePlaceholder')}
              className="mt-1 w-full rounded-xl border border-line bg-card p-3" />
          </div>
          <button type="submit" className="w-full rounded-2xl bg-terra px-6 py-3 font-semibold text-white">
            {t('createButton')}
          </button>
        </form>
      </div>
    );
  }

  // Phase 2: venue exists — connect Google.
  const supabase = await createSupabaseServerClient();
  const {data: venue} = await supabase
    .from('venues')
    .select('id, name, google_place_id, google_review_url')
    .eq('id', sp.venue)
    .maybeSingle();
  if (!venue) return null;

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

  const reviewUrl = venue.google_review_url;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">{t('googleTitle')}</h1>
      <p className="mt-2 text-muted">{t('googleHint')}</p>
      <div className="mt-6">
        <GooglePlaceSearch
          venueId={venue.id}
          query={query}
          results={results}
          searchFailed={searchFailed}
          searchAction="/dashboard/onboarding"
          backPath={`/dashboard/onboarding?venue=${venue.id}`}
        />
      </div>
      {reviewUrl ? (
        <div className="mt-6 rounded-xl border border-sage bg-card p-4">
          <p className="font-medium text-sage">✓ {t('connected')}</p>
          <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline">
            {t('testLink')}
          </a>
        </div>
      ) : null}
      <Link href="/dashboard" className="mt-8 inline-block w-full rounded-2xl bg-ink px-6 py-3 text-center font-semibold text-white">
        {t('toDashboard')}
      </Link>
    </div>
  );
}
