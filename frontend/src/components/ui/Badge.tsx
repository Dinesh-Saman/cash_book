import React from 'react';
import { cn } from '../../lib/utils';

export function Badge({
  className,
  variant = 'gray',
  children,
}: {
  className?: string;
  variant?: 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'purple';
  children: React.ReactNode;
}) {
  const variants = {
    gray: 'bg-slate-100 text-slate-700 border border-slate-200',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    red: 'bg-rose-50 text-rose-700 border border-rose-200',
    yellow: 'bg-amber-50 text-amber-700 border border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
    purple: 'bg-brand-50 text-brand-700 border border-brand-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
