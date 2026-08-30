import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';
import {addCategory, deleteCategory, moveCategory, renameCategory} from './actions';
import {BTN_DANGER, BTN_GHOST, BTN_ICON, BTN_PRIMARY, FIELD, H1, HINT} from '@/lib/ui';

export default async function SpeisekartePage() {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const t = await getTranslations('menu');
  const tc = await getTranslations('common');

  const supabase = await createSupabaseServerClient();
  const {data: categories} = await supabase
    .from('menu_categories')
    // Embed resolves through menu_items_category_same_venue; if PostgREST ever
    // calls it ambiguous, write `menu_items!menu_items_category_same_venue (id)`.
    .select('id, name, position, menu_items (id)')
    .eq('venue_id', venue.id)
    .order('position')
    .order('id');

  const rows = (categories ?? []) as Array<{
    id: string;
    name: string;
    position: number;
    menu_items: Array<{id: string}>;
  }>;

  // Split on the literal so "Link-Seite" can link to /dashboard/linkseite
  // without introducing rich-text message syntax for a single call site.
  const [hubHintBefore, hubHintAfter] = t('hubDisabledHint').split('Link-Seite');

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className={H1}>{t('title')}</h1>
        <p className={`mt-2 ${HINT}`}>{t('intro')}</p>
        {!venue.hubEnabled ? (
          <p className="mt-2 text-xs leading-relaxed text-ash-2">
            {hubHintBefore}
            <Link href="/dashboard/linkseite" className="text-flame underline underline-offset-2">Link-Seite</Link>
            {hubHintAfter}
          </p>
        ) : null}
      </div>

      <form action={addCategory} className="flex flex-wrap gap-2">
        <input type="hidden" name="venueId" value={venue.id} />
        <input
          name="name"
          required
          maxLength={60}
          placeholder={t('addCategoryPlaceholder')}
          aria-label={t('addCategoryLabel')}
          className={`min-w-0 flex-1 ${FIELD}`}
        />
        <button type="submit" className={`shrink-0 ${BTN_PRIMARY}`}>
          {t('addCategoryButton')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-3xl panel p-6 text-sm text-ash">{t('emptyCategories')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="rounded-3xl panel p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-ash-2">
                  {t('itemCount', {count: row.menu_items.length})}
                </span>
                <div className="flex shrink-0 gap-1">
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={index === 0}
                      className={BTN_ICON}
                      aria-label={t('moveUp')}
                    >
                      ▲
                    </button>
                  </form>
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={index === rows.length - 1}
                      className={BTN_ICON}
                      aria-label={t('moveDown')}
                    >
                      ▼
                    </button>
                  </form>
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      title={t('deleteCategoryHint')}
                      className={BTN_DANGER}
                    >
                      {tc('delete')}
                    </button>
                  </form>
                </div>
              </div>

              <form action={renameCategory} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={row.id} />
                <input
                  name="name"
                  defaultValue={row.name}
                  required
                  maxLength={60}
                  aria-label={t('categoryNameLabel')}
                  className={`min-w-0 flex-1 ${FIELD}`}
                />
                <button type="submit" className={`shrink-0 ${BTN_GHOST}`}>
                  {tc('save')}
                </button>
              </form>

              <Link
                href={`/dashboard/speisekarte/${row.id}`}
                className="mt-3.5 inline-flex items-center gap-1 text-sm font-semibold text-flame transition-colors hover:text-flame-lit"
              >
                {t('editItems')} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
