import React, { useRef } from 'react';
import { Calendar, X } from 'lucide-react';

interface DatePickerInputProps {
  value: string; // ISO string 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  max?: string;
  min?: string;
}

/**
 * Format ISO YYYY-MM-DD to DD.MM.YYYY (German/European standard)
 */
function formatToDisplay(isoDate: string): string {
  if (!isoDate || !isoDate.includes('-')) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  }
  return isoDate;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  placeholder = 'DD.MM.YYYY',
  className = '',
  max,
  min,
}) => {
  const nativePickerRef = useRef<HTMLInputElement>(null);

  const displayValue = formatToDisplay(value);

  const handleContainerClick = () => {
    if (nativePickerRef.current) {
      if (typeof nativePickerRef.current.showPicker === 'function') {
        try {
          nativePickerRef.current.showPicker();
          return;
        } catch {}
      }
      nativePickerRef.current.focus();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`relative flex items-center cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 transition-all hover:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 ${className}`}
    >
      {/* Hidden native date input that opens the OS/browser calendar picker */}
      <input
        ref={nativePickerRef}
        type="date"
        value={value}
        max={max}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
        tabIndex={-1}
      />

      {/* Visible display in Date.Month.Year format (DD.MM.YYYY) */}
      <span className={`flex-1 font-mono tracking-wide ${displayValue ? 'text-slate-900 font-bold' : 'text-slate-400 font-normal'}`}>
        {displayValue || placeholder}
      </span>

      {/* Clear or Calendar icon */}
      <div className="flex items-center gap-1.5 ml-2 text-slate-400">
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 hover:text-slate-700 rounded transition-colors"
            title="Datum löschen / Clear"
          >
            <X size={13} />
          </button>
        ) : null}
        <Calendar size={14} className="hover:text-brand-600 transition-colors pointer-events-none" />
      </div>
    </div>
  );
};

export default DatePickerInput;
