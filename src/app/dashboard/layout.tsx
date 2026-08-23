import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {getActiveVenue} from '@/lib/venues';
import {signOut} from '@/app/login/actions';

export default async function DashboardLayout({children}: {children: React.ReactNode}) {
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const ta = await getTranslations('auth');
  const venue = await getActiveVenue();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-6">
      <header className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-terra">{tc('appName')}</span>
          {venue ? <span className="ml-3 text-sm text-muted">{venue.name}</span> : null}
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted underline">{ta('signOut')}</button>
        </form>
      </header>
      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-2xl bg-card p-1 ring-1 ring-line">
        <Link href="/dashboard" className="flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-medium hover:bg-cream">{t('feedback')}</Link>
        <Link href="/dashboard/tische" className="flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-medium hover:bg-cream">{t('tables')}</Link>
        <Link href="/dashboard/speisekarte" className="flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-medium hover:bg-cream">{t('menu')}</Link>
        <Link href="/dashboard/linkseite" className="flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-medium hover:bg-cream">{t('hub')}</Link>
        <Link href="/dashboard/statistik" className="flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-medium hover:bg-cream">{t('stats')}</Link>
        <Link href="/dashboard/einstellungen" className="flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-medium hover:bg-cream">{t('settings')}</Link>
      </nav>
      <main className="mt-8">{children}</main>
    </div>
  );
}
