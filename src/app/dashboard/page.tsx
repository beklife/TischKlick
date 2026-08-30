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

  const unread = (items ?? []).filter((fb) => !fb.read_at).length;

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <h1 className="display text-2xl">{t('title')}</h1>
        {unread > 0 ? (
          <span className="rounded-full bg-flame px-2.5 py-0.5 text-xs font-bold text-void tabular-nums">
            {unread}
          </span>
        ) : null}
      </div>

      {!items || items.length === 0 ? (
        <p className="mt-7 rounded-3xl panel p-6 text-sm text-ash">{t('empty')}</p>
      ) : (
        <ul className="mt-7 space-y-2.5">
          {items.map((fb) => {
            const table = fb.tables as unknown as {label: string} | null;
            return (
              <li key={fb.id}>
                <Link
                  href={`/dashboard/feedback/${fb.id}`}
                  // The detail page marks feedback read during render, so viewport/hover
                  // prefetch must never fire that request — prefetch is disabled here.
                  prefetch={false}
                  className={`block rounded-3xl border bg-shell p-4 transition-colors hover:border-hair-2 hover:bg-shell-2 ${
                    fb.read_at ? 'border-hair' : 'border-flame/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-flame"
                      aria-label={tg('starLabel', {count: fb.rating})}
                    >
                      <span aria-hidden="true" className="tracking-tight">
                        {'★'.repeat(fb.rating)}
                        <span className="text-hair-2">{'★'.repeat(5 - fb.rating)}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[0.6875rem] text-ash-2">
                      {!fb.read_at ? (
                        <span className="rounded-full bg-flame px-2 py-0.5 font-semibold text-void">
                          {t('unread')}
                        </span>
                      ) : null}
                      {table ? `${table.label} · ` : ''}
                      {format.dateTime(new Date(fb.created_at), {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>

                  <p
                    className={`mt-2.5 truncate text-sm ${
                      fb.comment ? 'text-chalk' : 'text-ash-2 italic'
                    }`}
                  >
                    {fb.comment ?? t('noComment')}
                  </p>

                  {(fb.categories as string[]).length > 0 || fb.contact ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {(fb.categories as string[]).map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-hair bg-shell-2 px-2 py-0.5 text-[0.6875rem] text-ash"
                        >
                          {tg(`categories.${c}`)}
                        </span>
                      ))}
                      {fb.contact ? (
                        <span className="rounded-full border border-zest/30 bg-zest/10 px-2 py-0.5 text-[0.6875rem] font-medium text-zest">
                          {t('contactGiven')}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
