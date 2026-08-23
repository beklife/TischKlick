import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';
import {MAX_CUSTOM_LINKS} from '@/lib/links';
import {
  addCustomLink,
  deleteLink,
  moveLink,
  setLinkEnabled,
  updateBuiltinLink,
  updateCustomLink,
  updateHubSettings
} from './actions';

type Props = {searchParams: Promise<{gespeichert?: string; fehler?: string}>};

const FIELD = 'rounded-xl border border-line bg-card p-3';
const ICON_BUTTON = 'rounded-lg border border-line px-2 py-1 text-xs';

export default async function LinkseitePage({searchParams}: Props) {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const sp = await searchParams;
  const t = await getTranslations('hub');
  const tc = await getTranslations('common');

  const supabase = await createSupabaseServerClient();
  const [{data: links}, {count: itemCount}, {data: firstTable}] = await Promise.all([
    supabase
      .from('venue_links')
      .select('id, kind, label, icon, url, enabled, position')
      .eq('venue_id', venue.id)
      .order('position'),
    supabase
      .from('menu_items')
      .select('id', {count: 'exact', head: true})
      .eq('venue_id', venue.id),
    supabase.from('tables').select('code').eq('venue_id', venue.id).order('created_at').limit(1).maybeSingle()
  ]);

  const rows = links ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('intro')}</p>
      </div>

      {sp.gespeichert ? (
        <p className="rounded-xl bg-card p-3 text-sm text-sage ring-1 ring-sage">✓ {tc('saved')}</p>
      ) : null}
      {sp.fehler === 'url' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('invalidUrl')}</p>
      ) : null}
      {sp.fehler === 'limit' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {t('tooMany', {max: MAX_CUSTOM_LINKS})}
        </p>
      ) : null}

      <form action={updateHubSettings} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line">
        <input type="hidden" name="venueId" value={venue.id} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="hubEnabled" defaultChecked={venue.hubEnabled} className="mt-1" />
          <span>
            <span className="text-sm font-medium">{t('enabledLabel')}</span>
            <span className="block text-xs text-muted">{t('enabledHint')}</span>
          </span>
        </label>
        <div>
          <label htmlFor="hubTagline" className="text-sm font-medium">{t('taglineLabel')}</label>
          <input
            id="hubTagline"
            name="hubTagline"
            defaultValue={venue.hubTagline ?? ''}
            maxLength={160}
            placeholder={t('taglinePlaceholder')}
            className={`mt-1 w-full ${FIELD}`}
          />
        </div>
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {tc('save')}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">{t('blocksTitle')}</h2>
        <p className="text-xs text-muted">{t('builtinHint')}</p>
        {(itemCount ?? 0) === 0 ? (
          <p className="text-xs text-muted">{t('menuMissingHint')}</p>
        ) : null}

        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {row.kind === 'custom' ? row.url : `/${row.kind}`}
                  {row.enabled ? '' : ` · ${t('hidden')}`}
                </span>
                <div className="flex shrink-0 gap-1">
                  <form action={moveLink}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={index === 0} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveUp')}>▲</button>
                  </form>
                  <form action={moveLink}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={index === rows.length - 1} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveDown')}>▼</button>
                  </form>
                  <form action={setLinkEnabled}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="enabled" value={row.enabled ? 'false' : 'true'} />
                    <button type="submit" className={ICON_BUTTON}>
                      {row.enabled ? t('hide') : t('show')}
                    </button>
                  </form>
                  {row.kind === 'custom' ? (
                    <form action={deleteLink}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className={`${ICON_BUTTON} text-red-700`}>{tc('delete')}</button>
                    </form>
                  ) : null}
                </div>
              </div>

              <form
                action={row.kind === 'custom' ? updateCustomLink : updateBuiltinLink}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={row.id} />
                <div className="w-16">
                  <label htmlFor={`icon-${row.id}`} className="text-xs text-muted">{t('iconLabel')}</label>
                  <input id={`icon-${row.id}`} name="icon" defaultValue={row.icon ?? ''} maxLength={8} className={`w-full ${FIELD}`} />
                </div>
                <div className="min-w-32 flex-1">
                  <label htmlFor={`label-${row.id}`} className="text-xs text-muted">{t('labelLabel')}</label>
                  <input id={`label-${row.id}`} name="label" defaultValue={row.label} required maxLength={40} className={`w-full ${FIELD}`} />
                </div>
                {row.kind === 'custom' ? (
                  <div className="min-w-full">
                    <label htmlFor={`url-${row.id}`} className="text-xs text-muted">{t('urlLabel')}</label>
                    <input id={`url-${row.id}`} name="url" defaultValue={row.url ?? ''} required maxLength={500} className={`w-full ${FIELD}`} />
                  </div>
                ) : null}
                <button type="submit" className="rounded-xl border border-line px-4 py-3 text-sm font-medium">
                  {tc('save')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <form action={addCustomLink} className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="font-medium">{t('addTitle')}</h2>
        <input type="hidden" name="venueId" value={venue.id} />
        <div className="flex gap-2">
          <input name="icon" maxLength={8} placeholder={t('iconLabel')} aria-label={t('iconLabel')} className={`w-16 ${FIELD}`} />
          <input name="label" required maxLength={40} placeholder={t('labelLabel')} aria-label={t('labelLabel')} className={`flex-1 ${FIELD}`} />
        </div>
        <input name="url" required maxLength={500} placeholder={t('urlPlaceholder')} aria-label={t('urlLabel')} className={`w-full ${FIELD}`} />
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {t('addButton')}
        </button>
      </form>

      {firstTable ? (
        <a
          href={`/f/${firstTable.code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-muted underline"
        >
          {t('previewButton')}
        </a>
      ) : null}
    </div>
  );
}
