import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cn, Button, buttonClasses, Chip, Badge, useMediaQuery } from '..';

describe('cn', () => {
  it('keeps a custom font size alongside a text color', () => {
    const result = cn('text-2xs', 'text-fg');
    expect(result).toContain('text-2xs');
    expect(result).toContain('text-fg');
  });

  it('resolves conflicting font sizes to the later one', () => {
    expect(cn('text-xs', 'text-2xs')).toBe('text-2xs');
  });

  it('resolves conflicting padding to the later one', () => {
    expect(cn('px-4', 'px-5')).toBe('px-5');
  });
});

describe('Button', () => {
  it('renders type="button" by default and primary includes the gold gradient', () => {
    expect(renderToStaticMarkup(<Button>Go</Button>)).toContain('type="button"');
    expect(renderToStaticMarkup(<Button variant="primary">Go</Button>)).toContain('from-gold-bright');
  });

  it('buttonClasses applies the variant and size', () => {
    const classes = buttonClasses({ variant: 'danger', size: 'sm' });
    expect(classes).toContain('bg-red-soft');
    expect(classes).toContain('text-xs');
  });
});

describe('Chip', () => {
  it('passes the accent as CSS variables and marks itself pressed', () => {
    const html = renderToStaticMarkup(
      <Chip active accent={{ color: '#ff0000', textColor: '#000000' }}>
        Gold
      </Chip>
    );
    expect(html).toContain('--chip-accent:#ff0000');
    expect(html).toContain('aria-pressed="true"');
  });
});

describe('Badge', () => {
  it('gold variant uses the bright gold text', () => {
    expect(renderToStaticMarkup(<Badge variant="gold">Gold</Badge>)).toContain('text-gold-bright');
  });
});

describe('useMediaQuery', () => {
  it('returns false without a window', () => {
    const Probe = () => <span>{String(useMediaQuery('(max-width: 767.98px)'))}</span>;
    expect(renderToStaticMarkup(<Probe />)).toBe('<span>false</span>');
  });
});
