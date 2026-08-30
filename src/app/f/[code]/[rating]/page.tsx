import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {cleanTapId, getTableByCode, setTapOutcome, GUEST_CATEGORIES} from '@/lib/guest';
import {googleReviewUrl} from '@/lib/google';
import {ratingBranch} from '@/lib/rating';
import {InvalidLink} from '../../invalid-link';
import {sendFeedback} from '../actions';

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
    const tapId = cleanTapId(sp.t);
    const url =
      table.venue.googleReviewUrl ??
      (table.venue.googlePlaceId ? googleReviewUrl(table.venue.googlePlaceId) : null);
    if (!url) redirect(`/f/${code}/danke`);
    if (tapId) await setTapOutcome(tapId, 'google_redirect');
    redirect(url);
  }

  const preCategories = new Set((sp.cat ?? '').split(',').filter(Boolean));

  const field =
    'mt-2 w-full rounded-2xl border border-hair bg-shell p-3.5 text-[0.9375rem] text-chalk placeholder:text-ash-2 transition-colors focus:border-flame/60 focus:outline-none';
  // German form labels run long, so they stay sentence case — an uppercase
  // eyebrow at that length becomes a wall.
  const label = 'text-sm font-semibold tracking-tight text-chalk';

  return (
    <div className="py-2">
      <h1 className="display text-[1.85rem] text-balance">{t('feedbackTitle')}</h1>
      <p className="mt-2.5 text-sm leading-relaxed text-ash">{t('feedbackBody')}</p>

      {sp.fehler ? (
        <p className="mt-5 rounded-2xl border border-berry/40 bg-berry/10 p-3.5 text-sm text-berry">
          {tc('error')}
        </p>
      ) : null}

      <form action={sendFeedback} className="mt-7 space-y-7">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="tapId" value={sp.t ?? ''} />
        <input type="hidden" name="rating" value={rating} />

        <fieldset>
          <legend className={label}>{t('categoriesLabel')}</legend>
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
                {/* Selected chips invert to the flame gradient — the one place
                    the guest gets tactile confirmation before submitting. */}
                <span className="inline-block rounded-full border border-hair bg-shell px-4 py-2 text-sm font-medium text-ash transition-all peer-checked:border-transparent peer-checked:bg-flame peer-checked:text-void peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-flame peer-focus-visible:outline-offset-2 hover:border-hair-2 hover:text-chalk">
                  {t(`categories.${cat}`)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="comment" className={label}>
            {t('commentLabel')}
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={4}
            maxLength={2000}
            defaultValue={sp.k ?? ''}
            placeholder={t('commentPlaceholder')}
            className={`${field} resize-none leading-relaxed`}
          />
        </div>

        <div>
          <label htmlFor="contact" className={label}>
            {t('contactLabel')}
          </label>
          <input
            id="contact"
            name="contact"
            type="text"
            maxLength={200}
            defaultValue={sp.c ?? ''}
            placeholder={t('contactPlaceholder')}
            className={field}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-3xl flame-grad flame-glow px-6 py-4 font-display text-lg font-bold tracking-tight text-void transition-transform active:scale-[0.985]"
        >
          {t('submit')}
        </button>
      </form>
    </div>
  );
}
