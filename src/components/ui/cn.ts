import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['3xs', '2xs', 'caption', 'hero'],
      radius: ['2xs'],
      shadow: ['gold', 'gold-sm', 'gold-hover', 'gold-glow'],
      blur: ['overlay'],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts (later classes win). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
