'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@hse/shared';

export interface AdminTab {
  href: string;
  label: string;
}

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <nav className="flex min-w-max items-center gap-1 rounded-full border border-ink-200 bg-white p-1">
        {tabs.map((tab) => {
          const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'rounded-full px-3.5 py-2 text-xs font-semibold transition-colors',
                active
                  ? 'bg-ink-950 text-sand-50'
                  : 'text-ink-500 hover:bg-sand-100 hover:text-ink-900',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
