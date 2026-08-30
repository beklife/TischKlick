import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import QRCode from 'qrcode';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';
import {CopyButton} from '@/components/copy-button';
import {addTable, deleteTable} from './actions';

export default async function TischePage() {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const t = await getTranslations('tables');
  const tc = await getTranslations('common');
  const supabase = await createSupabaseServerClient();
  const {data: tables} = await supabase
    .from('tables')
    .select('id, label, code')
    .eq('venue_id', venue.id)
    .order('created_at');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const rows = await Promise.all(
    (tables ?? []).map(async (table) => ({
      ...table,
      url: `${baseUrl}/f/${table.code}`,
      qr: await QRCode.toDataURL(`${baseUrl}/f/${table.code}`, {width: 160, margin: 1})
    }))
  );

  return (
    <div>
      <h1 className="display text-2xl">{t('title')}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ash">{t('qrHint')}</p>

      <form action={addTable} className="mt-7 flex flex-wrap gap-2">
        <input type="hidden" name="venueId" value={venue.id} />
        <input
          name="label"
          required
          maxLength={60}
          placeholder={t('addPlaceholder')}
          aria-label={t('addLabel')}
          className="min-w-0 flex-1 rounded-2xl border border-hair bg-shell p-3 text-[0.9375rem] text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-2xl flame-grad px-5 font-display text-sm font-bold tracking-tight text-void transition-transform active:scale-[0.98]"
        >
          {t('addButton')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-7 rounded-3xl panel p-6 text-sm text-ash">{t('empty')}</p>
      ) : (
        <ul className="mt-7 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-3xl panel p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold tracking-tight">{row.label}</p>
                <form action={deleteTable}>
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    className="text-[0.6875rem] font-medium text-ash-2 transition-colors hover:text-berry"
                  >
                    {tc('delete')}
                  </button>
                </form>
              </div>
              <div className="mt-3.5 flex items-center gap-3.5">
                {/* The QR stays black-on-white on its own light plate: inverting it
                    for the dark UI would cost scanner reliability. */}
                <div className="shrink-0 rounded-xl bg-white p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.qr} alt={t('qrAlt', {label: row.label})} className="h-20 w-20" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-mono text-[0.6875rem] text-ash">{row.url}</p>
                  <div className="mt-2">
                    <CopyButton text={row.url} label={t('copy')} copiedLabel={t('copied')} />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
