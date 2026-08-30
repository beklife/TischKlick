import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue, getVenueStats} from '@/lib/venues';

export default async function StatistikPage() {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const t = await getTranslations('stats');
  const supabase = await createSupabaseServerClient();
  const stats = await getVenueStats(supabase, venue.id);

  const tiles = [
    {label: t('taps'), value: stats.taps},
    {label: t('menuViews'), value: stats.menuViews},
    {label: t('google'), value: stats.google},
    {label: t('feedback'), value: stats.feedback}
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="display text-2xl">{t('title')}</h1>
        <span className="text-xs text-ash-2">{t('period')}</span>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-3xl panel p-4">
            <p className="display text-[2rem] tabular-nums text-flame">{tile.value}</p>
            <p className="mt-1 text-[0.6875rem] leading-snug text-ash">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-3xl border border-zest/25 bg-zest/[0.07] p-5 text-center">
        <p className="text-sm text-chalk">{t('conversion', {percent: stats.conversionPercent})}</p>
      </div>
    </div>
  );
}
