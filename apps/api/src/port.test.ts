import { describe, expect, it } from 'vitest';

import { resolveApiPort } from './port.ts';

describe('resolveApiPort', () => {
  it('API_PORT が未設定なら 4000 を使う', () => {
    expect(resolveApiPort(undefined)).toBe(4000);
  });

  it('API_PORT が設定されていればその値を使う', () => {
    expect(resolveApiPort('4100')).toBe(4100);
  });

  it('数値として解釈できない値は不正として扱う', () => {
    expect(() => resolveApiPort('not-a-port')).toThrow(/API_PORT/);
  });
});
