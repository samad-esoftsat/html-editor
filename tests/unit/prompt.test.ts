import { describe, expect, it, beforeEach } from 'vitest';
import { promptDialog, subscribe, type PromptState } from '@/lib/utils/prompt';

describe('promptDialog', () => {
  let states: (PromptState | null)[] = [];
  let unsub: () => void;

  beforeEach(() => {
    states = [];
    unsub?.();
    unsub = subscribe((s) => states.push(s));
    // first emission is the initial state (null)
    states = [];
  });

  it('emits a state when opened and resolves the trimmed value on confirm', async () => {
    const p = promptDialog({ title: 'T', defaultValue: 'x' });
    expect(states.length).toBe(1);
    const state = states[0]!;
    expect(state.title).toBe('T');
    expect(state.defaultValue).toBe('x');
    state.resolve('  hello  ');
    await expect(p).resolves.toBe('hello');
    // state cleared after resolve
    expect(states.at(-1)).toBeNull();
  });

  it('resolves to null when cancelled', async () => {
    const p = promptDialog({ title: 'T' });
    states[0]!.resolve(null);
    await expect(p).resolves.toBeNull();
  });

  it('treats an all-whitespace string as empty (returns empty string, not null)', async () => {
    const p = promptDialog({ title: 'T' });
    states[0]!.resolve('   ');
    await expect(p).resolves.toBe('');
  });
});
