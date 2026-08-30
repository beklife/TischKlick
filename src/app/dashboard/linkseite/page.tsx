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

const FIELD = 'rounded-2xl border border-hair bg-shell p-3 text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none';
const ICON_BUTTON = 'rounded-lg border border-hair bg-shell-2 px-2 py-1 text-[0.6875rem] text-ash transition-colors hover:border-hair-2 hover:text-chalk';

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
      .order('position')
      .order('id'),
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
        <h1 className="display text-2xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-ash">{t('intro')}</p>
      </div>

      {sp.gespeichert ? (
        <p className="rounded-2xl border border-zest/40 bg-zest/10 p-3 text-sm text-zest">✓ {tc('saved')}</p>
      ) : null}
      {sp.fehler === 'url' ? (
        <p className="rounded-2xl border border-berry/40 bg-berry/10 p-3 text-sm text-berry">{t('invalidUrl')}</p>
      ) : null}
      {sp.fehler === 'limit' ? (
        <p className="rounded-2xl border border-berry/40 bg-berry/10 p-3 text-sm text-berry">
          {t('tooMany', {max: MAX_CUSTOM_LINKS})}
        </p>
      ) : null}

      <form action={updateHubSettings} className="space-y-3 rounded-3xl panel p-4">
        <input type="hidden" name="venueId" value={venue.id} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="hubEnabled" defaultChecked={venue.hubEnabled} className="mt-1" />
          <span>
            <span className="text-sm font-medium">{t('enabledLabel')}</span>
            <span className="block text-xs text-ash">{t('enabledHint')}</span>
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
        <button type="submit" className="rounded-2xl flame-grad px-4 py-2 font-display text-sm font-bold tracking-tight text-void transition-transform active:scale-[0.98]">
          {tc('save')}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">{t('blocksTitle')}</h2>
        <p className="text-xs text-ash">{t('builtinHint')}</p>
        {(itemCount ?? 0) === 0 ? (
          <p className="text-xs text-ash">{t('menuMissingHint')}</p>
        ) : null}

        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="rounded-3xl panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* A long custom URL must truncate rather than push the control
                    row past the viewport on a phone. */}
                <span className="min-w-0 flex-1 truncate text-xs text-ash">
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
                      <button type="submit" className={`${ICON_BUTTON} text-berry`}>{tc('delete')}</button>
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
                  <label htmlFor={`icon-${row.id}`} className="text-xs text-ash">{t('iconLabel')}</label>
                  <input id={`icon-${row.id}`} name="icon" defaultValue={row.icon ?? ''} maxLength={8} className={`w-full ${FIELD}`} />
                </div>
                <div className="min-w-32 flex-1">
                  <label htmlFor={`label-${row.id}`} className="text-xs text-ash">{t('labelLabel')}</label>
                  <input id={`label-${row.id}`} name="label" defaultValue={row.label} required maxLength={40} className={`w-full ${FIELD}`} />
                </div>
                {row.kind === 'custom' ? (
                  <div className="min-w-full">
                    <label htmlFor={`url-${row.id}`} className="text-xs text-ash">{t('urlLabel')}</label>
                    <input id={`url-${row.id}`} name="url" defaultValue={row.url ?? ''} required maxLength={500} className={`w-full ${FIELD}`} />
                  </div>
                ) : null}
                <button type="submit" className="rounded-2xl border border-hair bg-shell-2 px-4 py-3 text-sm font-semibold text-ash transition-colors hover:border-hair-2 hover:text-chalk">
                  {tc('save')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <form action={addCustomLink} className="space-y-2 rounded-3xl panel p-4">
        <h2 className="font-medium">{t('addTitle')}</h2>
        <input type="hidden" name="venueId" value={venue.id} />
        <div className="flex flex-wrap gap-2">
          <input name="icon" maxLength={8} placeholder={t('iconLabel')} aria-label={t('iconLabel')} className={`w-16 ${FIELD}`} />
          <input name="label" required maxLength={40} placeholder={t('labelLabel')} aria-label={t('labelLabel')} className={`min-w-0 flex-1 ${FIELD}`} />
        </div>
        <input name="url" required maxLength={500} placeholder={t('urlPlaceholder')} aria-label={t('urlLabel')} className={`w-full ${FIELD}`} />
        <button type="submit" className="rounded-2xl flame-grad px-4 py-2 font-display text-sm font-bold tracking-tight text-void transition-transform active:scale-[0.98]">
          {t('addButton')}
        </button>
      </form>

      {firstTable ? (
        <a
          href={`/f/${firstTable.code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-ash underline"
        >
          {t('previewButton')}
        </a>
      ) : null}
    </div>
  );
}
