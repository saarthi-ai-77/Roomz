'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Receipt,
  PlusCircle,
  PiggyBank,
  ArrowLeftRight,
  BarChart3,
  Settings,
  LogOut,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/actions/auth';
import type { Household, Profile } from '@/types/database';

interface NavbarProps {
  household?: Household | null;
  profile?: Profile | null;
}

export function Navbar({ household, profile }: NavbarProps) {
  const pathname = usePathname();

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/expenses/add', label: 'Add Expense', icon: PlusCircle },
    { href: '/expenses', label: 'History', icon: Receipt },
    { href: '/budget', label: 'Budgets', icon: PiggyBank },
    { href: '/settlement', label: 'Settlement', icon: ArrowLeftRight },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand / Household */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                Room Manager
              </span>
              {household && (
                <span className="mt-0.5 text-xs font-medium text-slate-500 truncate max-w-[140px] sm:max-w-[200px]">
                  {household.name}
                </span>
              )}
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-sky-50 text-sky-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className={cn('h-4 w-4', isActive ? 'text-sky-600' : 'text-slate-400')} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile & Sign out */}
        <div className="flex items-center gap-2">
          {profile && (
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700 truncate max-w-[120px]">
                {profile.full_name || profile.email}
              </span>
            </div>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
