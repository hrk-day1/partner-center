import { type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'border-border focus:border-accent focus:ring-accent rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none placeholder:text-zinc-400 focus:ring-1',
          className,
        )}
        {...props}
      />
    </div>
  );
}
