import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina classes condicionais e resolve conflitos do Tailwind. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
