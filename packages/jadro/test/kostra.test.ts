import { describe, expect, it } from 'vitest';
import { VERZE_FORMATU } from '../src/index.js';

describe('kostra balíku', () => {
  it('exportuje verzi formátu', () => {
    expect(VERZE_FORMATU).toBe(1);
  });
});
