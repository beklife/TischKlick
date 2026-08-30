import {getTranslations} from 'next-intl/server';
import {getTableByCode} from '@/lib/guest';
import {InvalidLink} from '../../invalid-link';

export const dynamic = 'force-dynamic';

export default async function DankePage({params}: {params: Promise<{code: string}>}) {
  const {code} = await params;
  const table = await getTableByCode(code);
  const t = await getTranslations('guest');
  if (!table) return <InvalidLink />;
  return (
    <div className="relative text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-zest/15 blur-[70px]"
      />
      <div className="relative">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-zest/30 bg-zest/10 text-3xl">
          🙏
        </div>
        <h1 className="mt-6 display text-[1.85rem] text-balance">{t('thanksTitle')}</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ash text-balance">
          {t('thanksBody', {venue: table.venue.name})}
        </p>
      </div>
    </div>
  );
}
