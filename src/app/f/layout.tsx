import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

export const metadata = {robots: {index: false, follow: false}};

export default async function GuestLayout({children}: {children: React.ReactNode}) {
  const t = await getTranslations('guest');
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-10">
      <main className="relative flex flex-1 flex-col justify-center">{children}</main>
      <footer className="relative mt-12 flex justify-center gap-5 text-[0.6875rem] tracking-wide text-ash-2">
        <Link href="/datenschutz" className="transition-colors hover:text-ash">
          {t('footerPrivacy')}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/impressum" className="transition-colors hover:text-ash">
          {t('footerImpressum')}
        </Link>
      </footer>
    </div>
  );
}
