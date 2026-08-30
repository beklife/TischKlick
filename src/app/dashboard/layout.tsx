import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {getActiveVenue} from '@/lib/venues';
import {signOut} from '@/app/login/actions';
import {DashboardNav} from './nav';

export default async function DashboardLayout({children}: {children: React.ReactNode}) {
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const ta = await getTranslations('auth');
  const venue = await getActiveVenue();

  const items = [
    {href: '/dashboard', label: t('feedback')},
    {href: '/dashboard/tische', label: t('tables')},
    {href: '/dashboard/speisekarte', label: t('menu')},
    {href: '/dashboard/linkseite', label: t('hub')},
    {href: '/dashboard/statistik', label: t('stats')},
    {href: '/dashboard/einstellungen', label: t('settings')}
  ];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link href="/dashboard" className="display-tight shrink-0 text-lg">
            {tc('appName')}
            <span className="text-flame">.</span>
          </Link>
          {venue ? (
            <span className="truncate text-sm text-ash">{venue.name}</span>
          ) : null}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="shrink-0 rounded-full border border-hair bg-shell px-3.5 py-1.5 text-xs font-semibold text-ash transition-colors hover:border-hair-2 hover:text-chalk"
          >
            {ta('signOut')}
          </button>
        </form>
      </header>

      <DashboardNav items={items} />

      <main className="mt-8 pb-16">{children}</main>
    </div>
  );
}
