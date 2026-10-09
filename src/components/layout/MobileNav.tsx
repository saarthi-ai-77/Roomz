'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Receipt, Plus, ArrowLeftRight, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/expenses', label: 'History', icon: Receipt },
    { href: '/expenses/add', label: 'Add', icon: Plus, isAction: true },
    { href: '/settlement', label: 'Settle', icon: ArrowLeftRight },
    { href: '/settings', label: 'More', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block border-t border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur md:hidden">
      <div className="flex items-center justify-around">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          if (link.isAction) {
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative -top-4 flex flex-col items-center group"
                aria-label="Add Expense"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow-md transition-transform group-hover:scale-105 active:scale-95">
                  <Plus className="h-6 w-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-semibold text-sky-700 mt-1">Add</span>
              </Link>
            );
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex flex-col items-center gap-1 py-1 px-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive ? 'text-sky-600' : 'text-slate-400')} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
