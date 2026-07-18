import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

export default async function GuestLayout({children}: {children: React.ReactNode}) {
  const t = await getTranslations('guest');
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <main className="flex flex-1 flex-col justify-center">{children}</main>
      <footer className="mt-10 flex justify-center gap-6 text-xs text-muted">
        <Link href="/datenschutz">{t('footerPrivacy')}</Link>
        <Link href="/impressum">{t('footerImpressum')}</Link>
      </footer>
    </div>
  );
}
