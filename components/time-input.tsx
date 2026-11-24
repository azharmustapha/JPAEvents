'use client';

import { Clock } from 'lucide-react';
import { formatTime } from '@/lib/date';

export function TimeInput({ id, value, onChange, required = false, disabled = false }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-[#003053] focus-within:border-black transition-all">
      <span aria-hidden="true">{value ? formatTime(value) : 'Pilih masa'}</span>
      <Clock aria-hidden="true" className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
      <input
        id={id}
        type="time"
        required={required}
        disabled={disabled}
        value={value}
        onChange={event => onChange(event.target.value)}
        onClick={event => event.currentTarget.showPicker?.()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}
