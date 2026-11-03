import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} aria-hidden="true" data-testid="button-spinner" className={cn('shrink-0 animate-spin', className)} />;
}
