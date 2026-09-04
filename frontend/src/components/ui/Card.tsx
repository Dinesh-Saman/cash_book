import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-card', className)}>
      {children}
    </div>
  );
}
