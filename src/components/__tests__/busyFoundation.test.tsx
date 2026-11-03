import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  IconButton,
  BusyContext,
  FeedbackBanner,
  raceWithTimeout,
  executeAction,
  ActionTimeoutError,
  ACTION_TIMEOUT_MS,
  ACTION_TIMEOUT_MESSAGE,
  ACTION_FAILED_MESSAGE,
} from '../ui';
import { nextBusyCount } from '../ui/busy';
import { ConfirmDialog } from '../overlay';

const noop = () => {};

afterEach(() => {
  vi.useRealTimers();
});

function makeDeps(timeoutMs?: number) {
  const calls: string[] = [];
  const deps = {
    begin: vi.fn(() => { calls.push('begin'); }),
    end: vi.fn(() => { calls.push('end'); }),
    showError: vi.fn(),
    timeoutMs,
  };
  return { deps, calls };
}

describe('raceWithTimeout', () => {
  it('resolves with the value', async () => {
    await expect(raceWithTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it("rejects with the promise's error", async () => {
    const err = new Error('nope');
    await expect(raceWithTimeout(Promise.reject(err), 1000)).rejects.toBe(err);
  });

  it('rejects with ActionTimeoutError after ACTION_TIMEOUT_MS for a promise that never settles', async () => {
    vi.useFakeTimers();
    const result = raceWithTimeout(new Promise<never>(() => {}), ACTION_TIMEOUT_MS);
    const assertion = expect(result).rejects.toBeInstanceOf(ActionTimeoutError);
    await vi.advanceTimersByTimeAsync(ACTION_TIMEOUT_MS);
    await assertion;
  });
});

describe('executeAction', () => {
  it('returns the value and calls begin then end once each, with no error', async () => {
    const { deps, calls } = makeDeps();
    await expect(executeAction(async () => 'ok', deps)).resolves.toBe('ok');
    expect(calls).toEqual(['begin', 'end']);
    expect(deps.showError).not.toHaveBeenCalled();
  });

  it('shows the error message of a thrown Error and still ends', async () => {
    const { deps } = makeDeps();
    const result = await executeAction(async () => { throw new Error('boom'); }, deps);
    expect(result).toBeUndefined();
    expect(deps.showError).toHaveBeenCalledWith('boom');
    expect(deps.end).toHaveBeenCalledTimes(1);
  });

  it('shows ACTION_FAILED_MESSAGE for a thrown non-Error', async () => {
    const { deps } = makeDeps();
    const result = await executeAction(() => { throw 'string failure'; }, deps);
    expect(result).toBeUndefined();
    expect(deps.showError).toHaveBeenCalledWith(ACTION_FAILED_MESSAGE);
  });

  it('shows ACTION_TIMEOUT_MESSAGE on timeout and ends', async () => {
    vi.useFakeTimers();
    const { deps } = makeDeps(50);
    const pending = executeAction(() => new Promise<never>(() => {}), deps);
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBeUndefined();
    expect(deps.showError).toHaveBeenCalledWith(ACTION_TIMEOUT_MESSAGE);
    expect(deps.end).toHaveBeenCalledTimes(1);
  });
});

describe('nextBusyCount', () => {
  it('begin increments', () => {
    expect(nextBusyCount(0, 'begin')).toBe(1);
    expect(nextBusyCount(2, 'begin')).toBe(3);
  });

  it('end decrements', () => {
    expect(nextBusyCount(2, 'end')).toBe(1);
  });

  it('end at 0 stays 0', () => {
    expect(nextBusyCount(0, 'end')).toBe(0);
  });
});

describe('Button loading state', () => {
  it('renders the spinner and loading text instead of the label, disabled and aria-busy', () => {
    const html = renderToStaticMarkup(<Button loading loadingText="Saving…">Save</Button>);
    expect(html).toContain('data-testid="button-spinner"');
    expect(html).toContain('Saving…');
    expect(html).not.toContain('>Save<');
    expect(html).toMatch(/<button[^>]* disabled=""/);
    expect(html).toContain('aria-busy="true"');
  });
});

describe('global busy lock', () => {
  const busyValue = { busy: true, begin() {}, end() {} };

  it('disables a plain Button while busy', () => {
    const html = renderToStaticMarkup(
      <BusyContext.Provider value={busyValue}>
        <Button>Save</Button>
      </BusyContext.Provider>
    );
    expect(html).toMatch(/<button[^>]* disabled=""/);
  });

  it('leaves an ignoreBusy Button enabled while busy', () => {
    const html = renderToStaticMarkup(
      <BusyContext.Provider value={busyValue}>
        <Button ignoreBusy>Dismiss</Button>
      </BusyContext.Provider>
    );
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
  });

  it('disables an IconButton while busy', () => {
    const html = renderToStaticMarkup(
      <BusyContext.Provider value={busyValue}>
        <IconButton aria-label="Close">x</IconButton>
      </BusyContext.Provider>
    );
    expect(html).toMatch(/<button[^>]* disabled=""/);
  });

  it('leaves a plain Button enabled outside any provider', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
  });
});

describe('FeedbackBanner', () => {
  it('renders an alert with the message', () => {
    const html = renderToStaticMarkup(<FeedbackBanner message="Save failed" onDismiss={noop} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Save failed');
  });

  it('renders nothing without a message', () => {
    expect(renderToStaticMarkup(<FeedbackBanner message={null} onDismiss={noop} />)).toBe('');
  });
});

describe('ConfirmDialog', () => {
  it('still renders its title and buttons with a synchronous onConfirm', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog open title="Delete tier?" body="This cannot be undone." confirmLabel="Delete" onConfirm={noop} onCancel={noop} />
    );
    expect(html).toContain('Delete tier?');
    expect(html).toContain('Cancel');
    expect(html).toContain('Delete');
    expect(html).not.toContain('button-spinner');
  });
});
