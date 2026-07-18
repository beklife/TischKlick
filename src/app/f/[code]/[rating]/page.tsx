import {getTranslations} from 'next-intl/server';
import {getTableByCode, GUEST_CATEGORIES} from '@/lib/guest';
import {ratingBranch} from '@/lib/rating';
import {InvalidLink} from '../../invalid-link';
import {goToGoogle, sendFeedback} from '../actions';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{code: string; rating: string}>;
  searchParams: Promise<{t?: string; fehler?: string; k?: string; c?: string; cat?: string}>;
};

export default async function BranchPage({params, searchParams}: Props) {
  const {code, rating: ratingParam} = await params;
  const sp = await searchParams;
  const rating = Number(ratingParam);
  const table = await getTableByCode(code);
  const t = await getTranslations('guest');
  const tc = await getTranslations('common');
  if (!table) return <InvalidLink />;

  let branch: 'google' | 'private';
  try {
    branch = ratingBranch(rating);
  } catch {
    return <InvalidLink />;
  }

  if (branch === 'google') {
    return (
      <div className="text-center">
        <p className="text-4xl">🎉</p>
        <h1 className="mt-4 text-2xl font-semibold">{t('googleTitle')}</h1>
        <p className="mt-3 text-muted">{t('googleBody')}</p>
        <form action={goToGoogle} className="mt-8">
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="tapId" value={sp.t ?? ''} />
          <button
            type="submit"
            className="w-full rounded-2xl bg-terra px-6 py-4 text-lg font-semibold text-white shadow active:bg-terra-dark"
          >
            {t('googleButton')}
          </button>
        </form>
      </div>
    );
  }

  const preCategories = new Set((sp.cat ?? '').split(',').filter(Boolean));

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('feedbackTitle')}</h1>
      <p className="mt-2 text-muted">{t('feedbackBody')}</p>
      {sp.fehler ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{tc('error')}</p> : null}
      <form action={sendFeedback} className="mt-6 space-y-6">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="tapId" value={sp.t ?? ''} />
        <input type="hidden" name="rating" value={rating} />
        <fieldset>
          <legend className="text-sm font-medium">{t('categoriesLabel')}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {GUEST_CATEGORIES.map((cat) => (
              <label key={cat} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="categories"
                  value={cat}
                  defaultChecked={preCategories.has(cat)}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full border border-line bg-card px-4 py-2 text-sm peer-checked:border-terra peer-checked:bg-terra peer-checked:text-white">
                  {t(`categories.${cat}`)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="comment" className="text-sm font-medium">{t('commentLabel')}</label>
          <textarea
            id="comment"
            name="comment"
            rows={4}
            maxLength={2000}
            defaultValue={sp.k ?? ''}
            placeholder={t('commentPlaceholder')}
            className="mt-2 w-full rounded-xl border border-line bg-card p-3"
          />
        </div>
        <div>
          <label htmlFor="contact" className="text-sm font-medium">{t('contactLabel')}</label>
          <input
            id="contact"
            name="contact"
            type="text"
            maxLength={200}
            defaultValue={sp.c ?? ''}
            placeholder={t('contactPlaceholder')}
            className="mt-2 w-full rounded-xl border border-line bg-card p-3"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-2xl bg-terra px-6 py-4 text-lg font-semibold text-white shadow active:bg-terra-dark"
        >
          {t('submit')}
        </button>
      </form>
    </div>
  );
}
