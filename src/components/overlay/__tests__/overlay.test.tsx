import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Overlay,
  ConfirmDialog,
  DiscardChangesDialog,
  resolveDismissal,
  type DismissReason,
  type DismissResult,
} from '..';

const noop = () => {};

/** The rule table from the 11.1 spec, written out independently of the implementation. */
function expected(reason: DismissReason, dirty: boolean, busy: boolean, dismissible: boolean): DismissResult {
  if (busy) return 'ignore';
  if (!dismissible && reason !== 'button') return 'ignore';
  return dirty ? 'confirm' : 'close';
}

describe('resolveDismissal', () => {
  const reasons: DismissReason[] = ['backdrop', 'escape', 'button'];
  const bools = [false, true];
  const cases = reasons.flatMap(reason =>
    bools.flatMap(dirty => bools.flatMap(busy => bools.map(dismissible => ({ reason, dirty, busy, dismissible }))))
  );

  it('covers all 24 combinations', () => {
    expect(cases).toHaveLength(24);
  });

  it.each(cases)('$reason dirty=$dirty busy=$busy dismissible=$dismissible', ({ reason, dirty, busy, dismissible }) => {
    expect(resolveDismissal(reason, { dirty, busy, dismissible })).toBe(expected(reason, dirty, busy, dismissible));
  });

  it('spot-checks the rule table', () => {
    expect(resolveDismissal('backdrop', { dirty: false, busy: false, dismissible: true })).toBe('close');
    expect(resolveDismissal('escape', { dirty: true, busy: false, dismissible: true })).toBe('confirm');
    expect(resolveDismissal('button', { dirty: true, busy: true, dismissible: true })).toBe('ignore');
    expect(resolveDismissal('backdrop', { dirty: false, busy: false, dismissible: false })).toBe('ignore');
    expect(resolveDismissal('button', { dirty: true, busy: false, dismissible: false })).toBe('confirm');
  });
});

describe('Overlay', () => {
  it('renders nothing when closed', () => {
    expect(renderToStaticMarkup(<Overlay open={false} onClose={noop}>x</Overlay>)).toBe('');
  });

  it('renders an accessible dialog panel when open', () => {
    const html = renderToStaticMarkup(
      <Overlay open onClose={noop} panelTestId="test-panel">
        content
      </Overlay>
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-testid="test-panel"');
    expect(html).toContain('content');
  });
});

describe('ConfirmDialog', () => {
  it('renders title, body and both button labels', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Delete thing?"
        body={<p>This cannot be undone.</p>}
        cancelLabel="Never mind"
        confirmLabel="Delete Forever"
        onConfirm={noop}
        onCancel={noop}
      />
    );
    expect(html).toContain('Delete thing?');
    expect(html).toContain('This cannot be undone.');
    expect(html).toContain('Never mind');
    expect(html).toContain('Delete Forever');
  });
});

describe('DiscardChangesDialog', () => {
  it('renders the discard prompt', () => {
    const html = renderToStaticMarkup(<DiscardChangesDialog open onKeepEditing={noop} onDiscard={noop} />);
    expect(html).toContain('Discard unsaved changes?');
    expect(html).toContain('Keep Editing');
    expect(html).toContain('Discard Changes');
  });
});
