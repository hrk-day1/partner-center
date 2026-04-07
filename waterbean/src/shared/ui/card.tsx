import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-border rounded-lg border bg-white p-6 shadow-sm', className)} {...props} />;
}
