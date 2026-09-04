import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150 focus:outline-none disabled:opacity-50 disabled:pointer-events-none';
    const variants = {
      primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-xs active:bg-brand-800',
      secondary: 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-xs',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs active:bg-rose-800',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs active:bg-emerald-800',
      ghost: 'text-slate-600 hover:text-brand-700 hover:bg-brand-50',
    };
    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 py-2 text-sm gap-2',
      lg: 'h-11 px-6 text-base gap-2.5',
    };
    return <button ref={ref} className={cn(baseStyles, variants[variant], sizes[size], className)} {...props} />;
  }
);
Button.displayName = 'Button';
