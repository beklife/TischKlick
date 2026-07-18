import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tc = await getTranslations('common');
  const tg = await getTranslations('guest');
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold text-terra">{tc('appName')}</span>
        <Link href="/login" className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium">
          {t('login')}
        </Link>
      </header>
      <section className="flex flex-1 flex-col justify-center text-center">
        <h1 className="text-4xl font-semibold leading-tight">{t('claim')}</h1>
        <p className="mt-4 text-lg text-muted">{t('sub')}</p>
      </section>
      <footer className="flex justify-center gap-6 text-xs text-muted">
        <Link href="/datenschutz">{tg('footerPrivacy')}</Link>
        <Link href="/impressum">{tg('footerImpressum')}</Link>
      </footer>
    </main>
  );
}
