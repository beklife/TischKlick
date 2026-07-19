import {getTranslations, getFormatter} from 'next-intl/server';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';

export default async function InboxPage() {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const t = await getTranslations('inbox');
  const tg = await getTranslations('guest');
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const {data: items} = await supabase
    .from('feedback')
    .select('id, rating, categories, comment, contact, created_at, read_at, tables (label)')
    .eq('venue_id', venue.id)
    .order('created_at', {ascending: false})
    .limit(100);

  return (
    <div>
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      {!items || items.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-card p-6 text-muted ring-1 ring-line">{t('empty')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((fb) => {
            const table = fb.tables as unknown as {label: string} | null;
            return (
              <li key={fb.id}>
                <Link
                  href={`/dashboard/feedback/${fb.id}`}
                  className="block rounded-2xl bg-card p-4 ring-1 ring-line hover:ring-terra"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-terra">
                      {'★'.repeat(fb.rating)}
                      <span className="text-line">{'★'.repeat(5 - fb.rating)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {!fb.read_at ? (
                        <span className="rounded-full bg-terra px-2 py-0.5 font-medium text-white">{t('unread')}</span>
                      ) : null}
                      {table ? `${table.label} · ` : ''}
                      {format.dateTime(new Date(fb.created_at), {dateStyle: 'medium', timeStyle: 'short'})}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm">{fb.comment ?? t('noComment')}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(fb.categories as string[]).map((c) => (
                      <span key={c} className="rounded-full bg-cream px-2 py-0.5 text-xs text-muted">
                        {tg(`categories.${c}`)}
                      </span>
                    ))}
                    {fb.contact ? (
                      <span className="rounded-full bg-sage px-2 py-0.5 text-xs text-white">{t('contactGiven')}</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
