import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';
import {addCategory, deleteCategory, moveCategory, renameCategory} from './actions';

const FIELD = 'rounded-xl border border-line bg-card p-3';
const ICON_BUTTON = 'rounded-lg border border-line px-2 py-1 text-xs';

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
    .order('position');

  const rows = (categories ?? []) as Array<{
    id: string;
    name: string;
    position: number;
    menu_items: Array<{id: string}>;
  }>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('intro')}</p>
      </div>

      <form action={addCategory} className="flex gap-2">
        <input type="hidden" name="venueId" value={venue.id} />
        <input
          name="name"
          required
          maxLength={60}
          placeholder={t('addCategoryPlaceholder')}
          aria-label={t('addCategoryLabel')}
          className={`flex-1 ${FIELD}`}
        />
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {t('addCategoryButton')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-muted ring-1 ring-line">
          {t('emptyCategories')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
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
                      className={`${ICON_BUTTON} disabled:opacity-30`}
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
                      className={`${ICON_BUTTON} disabled:opacity-30`}
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
                      className={`${ICON_BUTTON} text-red-700`}
                    >
                      {tc('delete')}
                    </button>
                  </form>
                </div>
              </div>

              <form action={renameCategory} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={row.id} />
                <input
                  name="name"
                  defaultValue={row.name}
                  required
                  maxLength={60}
                  aria-label={t('categoryNameLabel')}
                  className={`flex-1 ${FIELD}`}
                />
                <button type="submit" className="rounded-xl border border-line px-4 py-3 text-sm font-medium">
                  {tc('save')}
                </button>
              </form>

              <Link
                href={`/dashboard/speisekarte/${row.id}`}
                className="mt-3 inline-block text-sm text-terra underline"
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
