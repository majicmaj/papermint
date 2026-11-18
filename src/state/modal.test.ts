import { describe, expect, it, vi } from 'vitest';
import { createLayerStack } from './modal';

function setup() {
  const opener = { isConnected: true, focus: vi.fn() } as unknown as HTMLElement;
  const later: (() => void)[] = [];
  const stack = createLayerStack({
    activeElement: () => opener,
    later: (run) => void later.push(run),
  });
  return { stack, opener, flush: () => later.splice(0).forEach((run) => run()) };
}

describe('layer stack', () => {
  it('reports open while any layer is open, so shortcuts stay suspended', () => {
    const { stack } = setup();
    expect(stack.isOpen()).toBe(false);
    const menu = stack.push(false);
    const dialog = stack.push(true);
    stack.pop(dialog);
    expect(stack.isOpen()).toBe(true);
    stack.pop(menu);
    expect(stack.isOpen()).toBe(false);
  });

  it('is modal only while a modal layer is open', () => {
    const { stack } = setup();
    const menu = stack.push(false);
    expect(stack.isModal()).toBe(false);
    const palette = stack.push(true);
    expect(stack.isModal()).toBe(true);
    stack.pop(palette);
    expect(stack.isModal()).toBe(false);
    stack.pop(menu);
  });

  it('restores focus to the opener captured at open, after the page is focusable', () => {
    const { stack, opener, flush } = setup();
    const id = stack.push(true);
    stack.pop(id);
    expect(opener.focus).not.toHaveBeenCalled();
    flush();
    expect(opener.focus).toHaveBeenCalledTimes(1);
  });

  it('does not restore focus for menus or when asked not to', () => {
    const { stack, opener, flush } = setup();
    stack.pop(stack.push(false));
    stack.pop(stack.push(true), false);
    flush();
    expect(opener.focus).not.toHaveBeenCalled();
  });

  it('ignores a layer that is already closed', () => {
    const { stack } = setup();
    const id = stack.push(true);
    stack.pop(id);
    expect(() => stack.pop(id)).not.toThrow();
  });
});
