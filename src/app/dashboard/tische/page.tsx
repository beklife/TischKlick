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
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('qrHint')}</p>

      <form action={addTable} className="mt-6 flex gap-2">
        <input type="hidden" name="venueId" value={venue.id} />
        <input
          name="label"
          required
          maxLength={60}
          placeholder={t('addPlaceholder')}
          aria-label={t('addLabel')}
          className="flex-1 rounded-xl border border-line bg-card p-3"
        />
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {t('addButton')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-card p-6 text-muted ring-1 ring-line">{t('empty')}</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
              <div className="flex items-start justify-between">
                <p className="font-medium">{row.label}</p>
                <form action={deleteTable}>
                  <input type="hidden" name="id" value={row.id} />
                  <button type="submit" className="text-xs text-red-700 underline">{tc('delete')}</button>
                </form>
              </div>
              <div className="mt-3 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.qr} alt={t('qrAlt', {label: row.label})} className="h-24 w-24 rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-muted">{row.url}</p>
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
