import {getTranslations} from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import {notFound, redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';
import {ADDITIVES, ALLERGENS, DIET_TAGS} from '@/lib/menu';
import {ImageUploadField} from '@/components/image-upload-field';
import {
  addMenuItem,
  deleteMenuItem,
  moveMenuItem,
  removeItemImage,
  updateMenuItem,
  uploadItemImage
} from './actions';

type Props = {
  params: Promise<{categoryId: string}>;
  searchParams: Promise<{gespeichert?: string; fehler?: string}>;
};

const FIELD = 'rounded-xl border border-line bg-card p-3';
const ICON_BUTTON = 'rounded-lg border border-line px-2 py-1 text-xs';

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  diet_tags: string[];
  allergens: string[];
  additives: string[];
  image_url: string | null;
  sold_out: boolean;
  position: number;
};

export default async function KategoriePage({params, searchParams}: Props) {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const {categoryId} = await params;
  const sp = await searchParams;
  const t = await getTranslations('menu');
  const tc = await getTranslations('common');

  const supabase = await createSupabaseServerClient();
  // RLS scopes this to the owner's venues, but not to the active venue — an
  // owner with several venues could otherwise load a category from venue B
  // while venue A is active. Scoping to venue.id here makes a stale category
  // page 404 instead of silently posting into the wrong venue.
  const {data: category} = await supabase
    .from('menu_categories')
    .select('id, name')
    .eq('id', categoryId)
    .eq('venue_id', venue.id)
    .maybeSingle();
  if (!category) notFound();

  const {data: items} = await supabase
    .from('menu_items')
    .select('id, name, description, price_cents, diet_tags, allergens, additives, image_url, sold_out, position')
    .eq('category_id', categoryId)
    .order('position')
    .order('id');
  const rows = (items ?? []) as ItemRow[];

  // Shared between the "new item" form and every edit form. Named itemFields
  // rather than fieldset so it doesn't shadow the JSX intrinsic <fieldset>.
  function itemFields(item?: ItemRow) {
    const key = item?.id ?? 'neu';
    return (
      <>
        <div>
          <label htmlFor={`name-${key}`} className="text-xs text-muted">{t('nameLabel')}</label>
          <input id={`name-${key}`} name="name" defaultValue={item?.name ?? ''} required maxLength={120}
            placeholder={t('namePlaceholder')} className={`w-full ${FIELD}`} />
        </div>
        <div>
          <label htmlFor={`desc-${key}`} className="text-xs text-muted">{t('descriptionLabel')}</label>
          <textarea id={`desc-${key}`} name="description" defaultValue={item?.description ?? ''} rows={2} maxLength={400}
            placeholder={t('descriptionPlaceholder')} className={`w-full ${FIELD}`} />
        </div>
        <div>
          <label htmlFor={`price-${key}`} className="text-xs text-muted">{t('priceLabel')}</label>
          <input id={`price-${key}`} name="price"
            defaultValue={item?.price_cents == null ? '' : (item.price_cents / 100).toFixed(2).replace('.', ',')}
            inputMode="decimal" placeholder={t('pricePlaceholder')} className={`w-full ${FIELD}`} />
          <p className="text-xs text-muted">{t('priceHint')}</p>
        </div>
        <fieldset>
          <legend className="text-xs text-muted">{t('dietLabel')}</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {DIET_TAGS.map((tag) => (
              <label key={tag} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="dietTags" value={tag} defaultChecked={item?.diet_tags.includes(tag)} />
                {t(`diet.${tag}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor={`allergens-${key}`} className="text-xs text-muted">{t('allergensLabel')}</label>
            <select id={`allergens-${key}`} name="allergens" multiple size={5} defaultValue={item?.allergens ?? []}
              className={`w-full ${FIELD}`}>
              {Object.entries(ALLERGENS).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`additives-${key}`} className="text-xs text-muted">{t('additivesLabel')}</label>
            <select id={`additives-${key}`} name="additives" multiple size={5} defaultValue={item?.additives ?? []}
              className={`w-full ${FIELD}`}>
              {Object.entries(ADDITIVES).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">{t('multiSelectHint')}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="soldOut" defaultChecked={item?.sold_out ?? false} />
          {t('soldOutLabel')}
        </label>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/speisekarte" className="text-sm text-muted underline">
        {t('backToCategories')}
      </Link>
      <h1 className="text-xl font-semibold">{category.name}</h1>

      {sp.gespeichert ? (
        <p className="rounded-xl bg-card p-3 text-sm text-sage ring-1 ring-sage">✓ {tc('saved')}</p>
      ) : null}
      {sp.fehler === 'preis' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('invalidPrice')}</p>
      ) : null}
      {sp.fehler === 'name' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('invalidName')}</p>
      ) : null}
      {sp.fehler === 'foto' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('uploadFailed')}</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-muted ring-1 ring-line">{t('emptyItems')}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((item, index) => (
            <li key={item.id} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line">
              <div className="flex items-start justify-between gap-2">
                {item.image_url ? (
                  <Image src={item.image_url} alt={t('photoAlt', {name: item.name})} width={64} height={64}
                    className="h-16 w-16 rounded-xl object-cover" unoptimized />
                ) : null}
                <div className="flex shrink-0 gap-1">
                  <form action={moveMenuItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={index === 0} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveUp')}>▲</button>
                  </form>
                  <form action={moveMenuItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={index === rows.length - 1} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveDown')}>▼</button>
                  </form>
                  <form action={deleteMenuItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <button type="submit" className={`${ICON_BUTTON} text-red-700`}>{tc('delete')}</button>
                  </form>
                </div>
              </div>

              <form action={updateMenuItem} className="space-y-3">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="categoryId" value={categoryId} />
                {itemFields(item)}
                <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
                  {tc('save')}
                </button>
              </form>

              <form action={uploadItemImage} className="border-t border-line pt-3">
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="categoryId" value={categoryId} />
                <ImageUploadField
                  name="photo"
                  id={`photo-${item.id}`}
                  label={t('photoLabel')}
                  hint={t('photoHint')}
                  buttonLabel={t('photoButton')}
                />
              </form>
              {item.image_url ? (
                <form action={removeItemImage}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="categoryId" value={categoryId} />
                  <button type="submit" className="text-xs text-red-700 underline">{t('photoRemove')}</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form action={addMenuItem} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="font-medium">{t('addItemTitle')}</h2>
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="venueId" value={venue.id} />
        {itemFields()}
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {t('addItemButton')}
        </button>
      </form>
    </div>
  );
}
