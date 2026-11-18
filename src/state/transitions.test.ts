import { describe, expect, it } from 'vitest';
import { transitionFor, type Route } from './routes';

const list: Route = { name: 'records' };
const recovery: Route = { name: 'recovery' };
const record = (id: number): Route => ({ name: 'record', id, version: null, from: null });

describe('transitionFor', () => {
  it('slides the pane when it arrives or leaves on a desktop', () => {
    expect(transitionFor(list, record(1), false)).toBe('pane');
    expect(transitionFor(record(1), list, false)).toBe('pane');
  });

  it('leaves the pane to the sheet on a phone', () => {
    expect(transitionFor(list, record(1), true)).toBeNull();
    expect(transitionFor(record(1), list, true)).toBeNull();
  });

  it('cross-fades the results when the view changes', () => {
    expect(transitionFor(list, recovery, false)).toBe('results');
    expect(transitionFor(list, recovery, true)).toBe('results');
  });

  it('changes content in place from one record to the next', () => {
    expect(transitionFor(record(1), record(2), false)).toBeNull();
    expect(transitionFor(list, list, false)).toBeNull();
  });
});
