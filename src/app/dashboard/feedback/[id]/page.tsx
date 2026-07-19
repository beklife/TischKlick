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
      <Link href="/dashboard" className="text-sm text-muted underline">← {tc('back')}</Link>
      <div className="mt-4 rounded-2xl bg-card p-6 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <span className="text-xl text-terra">
            {'★'.repeat(fb.rating)}
            <span className="text-line">{'★'.repeat(5 - fb.rating)}</span>
          </span>
          <span className="text-sm text-muted">
            {table ? `${t('table')} ${table.label} · ` : ''}
            {format.dateTime(new Date(fb.created_at), {dateStyle: 'full', timeStyle: 'short'})}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(fb.categories as string[]).map((c) => (
            <span key={c} className="rounded-full bg-cream px-3 py-1 text-sm">{tg(`categories.${c}`)}</span>
          ))}
        </div>
        <p className="mt-4 whitespace-pre-wrap">{fb.comment ?? t('noComment')}</p>
        <div className="mt-6 border-t border-line pt-4 text-sm">
          {fb.contact ? (
            <div className="flex items-center justify-between gap-3">
              <span>{fb.contact}</span>
              <form action={deleteContact}>
                <input type="hidden" name="id" value={fb.id} />
                <button type="submit" className="text-red-700 underline">{t('deleteContact')}</button>
              </form>
            </div>
          ) : (
            <span className="text-muted">{t('anonymous')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
