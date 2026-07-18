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
    <div className="text-center">
      <p className="text-4xl">🙏</p>
      <h1 className="mt-4 text-2xl font-semibold">{t('thanksTitle')}</h1>
      <p className="mt-3 text-muted">{t('thanksBody', {venue: table.venue.name})}</p>
    </div>
  );
}
