'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

type Item = {href: string; label: string};

export function DashboardNav({items}: {items: Item[]}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className="-mx-5 mt-6 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max min-w-full gap-1 rounded-2xl border border-hair bg-shell p-1">
        {items.map((item) => {
          // /dashboard is the inbox and must not light up for every child route.
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-xl px-3.5 py-2 text-center text-[0.8125rem] font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-flame text-void shadow-[0_2px_10px_-2px_var(--color-flame)]'
                    : 'text-ash hover:bg-shell-2 hover:text-chalk'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
