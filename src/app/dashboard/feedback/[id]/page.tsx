import {getTranslations, getFormatter} from 'next-intl/server';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {deleteContact} from './actions';

export default async function FeedbackDetailPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const t = await getTranslations('inbox');
  const tg = await getTranslations('guest');
  const tc = await getTranslations('common');
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();

  const {data: fb} = await supabase
    .from('feedback')
    .select('id, rating, categories, comment, contact, created_at, read_at, tables (label)')
    .eq('id', id)
    .maybeSingle();
  if (!fb) notFound();

  if (!fb.read_at) {
    await supabase.from('feedback').update({read_at: new Date().toISOString()}).eq('id', id);
  }

  const table = fb.tables as unknown as {label: string} | null;

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/dashboard" className="text-sm text-ash underline">← {tc('back')}</Link>
      <div className="mt-4 rounded-3xl panel p-6">
        <div className="flex items-center justify-between">
          <span className="text-xl text-flame" aria-label={tg('starLabel', {count: fb.rating})}>
            <span aria-hidden="true">
              {'★'.repeat(fb.rating)}
              <span className="text-line">{'★'.repeat(5 - fb.rating)}</span>
            </span>
          </span>
          <span className="text-sm text-ash">
            {table ? `${t('table')} ${table.label} · ` : ''}
            {format.dateTime(new Date(fb.created_at), {dateStyle: 'full', timeStyle: 'short'})}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(fb.categories as string[]).map((c) => (
            <span key={c} className="rounded-full border border-hair bg-shell-2 px-3 py-1 text-sm text-ash">{tg(`categories.${c}`)}</span>
          ))}
        </div>
        <p className="mt-4 whitespace-pre-wrap">{fb.comment ?? t('noComment')}</p>
        <div className="mt-6 border-t border-hair pt-4 text-sm">
          {fb.contact ? (
            <div className="flex items-center justify-between gap-3">
              <span>{fb.contact}</span>
              <form action={deleteContact}>
                <input type="hidden" name="id" value={fb.id} />
                <button type="submit" className="text-berry underline">{t('deleteContact')}</button>
              </form>
            </div>
          ) : (
            <span className="text-ash">{t('anonymous')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
