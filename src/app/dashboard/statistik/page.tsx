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
    {label: t('google'), value: stats.google},
    {label: t('feedback'), value: stats.feedback}
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <span className="text-sm text-muted">{t('period')}</span>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl bg-card p-4 text-center ring-1 ring-line">
            <p className="text-3xl font-semibold text-terra">{tile.value}</p>
            <p className="mt-1 text-xs text-muted">{tile.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 rounded-2xl bg-card p-4 text-center text-sm text-muted ring-1 ring-line">
        {t('conversion', {percent: stats.conversionPercent})}
      </p>
    </div>
  );
}
