import React from 'react';
import { cn } from '@/lib/utils';

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}) {
  const percentage = Math.min(Math.max((value / (max || 1)) * 100, 0), 100);

  let defaultBarColor = 'bg-sky-600';
  if (percentage >= 100) {
    defaultBarColor = 'bg-rose-600';
  } else if (percentage >= 80) {
    defaultBarColor = 'bg-amber-500';
  }

  return (
    <div
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100',
        className
      )}
    >
      <div
        className={cn(
          'h-full transition-all duration-300 rounded-full',
          defaultBarColor,
          barClassName
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
