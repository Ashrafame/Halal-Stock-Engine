'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  BellRing,
  BriefcaseBusiness,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@hse/shared';

export type NavIcon = 'overview' | 'screener' | 'alerts' | 'portfolio' | 'settings' | 'admin';

const icons: Record<NavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  screener: Search,
  alerts: BellRing,
  portfolio: BriefcaseBusiness,
  settings: Settings,
  admin: ShieldCheck,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: number;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-white text-ink-950 shadow-sm ring-1 ring-ink-200/60'
                : 'text-sand-100/60 hover:bg-white/5 hover:text-sand-50',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span
              className={cn(
                'grid size-8 place-items-center rounded-xl transition-colors',
                active ? 'bg-brand-50 text-brand-700' : 'bg-white/5 text-sand-100/50',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="grid grid-cols-5 border-t border-ink-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      {items.slice(0, 5).map((item) => {
        const Icon = icons[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium',
              active ? 'text-brand-700' : 'text-ink-400',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden />
              {item.badge ? (
                <span className="absolute -end-2 -top-1 grid size-3.5 place-items-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </span>
            <span className="truncate px-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
