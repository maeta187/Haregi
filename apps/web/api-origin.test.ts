import { describe, expect, it } from 'vitest';

import { resolveApiOrigin } from './api-origin.ts';

describe('resolveApiOrigin', () => {
  it('何も指定がなければ http://localhost:4000 を使う', () => {
    expect(resolveApiOrigin({})).toBe('http://localhost:4000');
  });

  it('API_PORT が指定されていればプロキシ先がそのポートへ追従する', () => {
    expect(resolveApiOrigin({ API_PORT: '4100' })).toBe(
      'http://localhost:4100',
    );
  });

  it('API_ORIGIN が指定されていれば API_PORT より優先する', () => {
    expect(
      resolveApiOrigin({
        API_ORIGIN: 'http://127.0.0.1:4200',
        API_PORT: '4100',
      }),
    ).toBe('http://127.0.0.1:4200');
  });

  it('URL として成立しない値は不正として扱う', () => {
    expect(() => resolveApiOrigin({ API_PORT: 'not-a-port' })).toThrow(
      /API_PORT/,
    );
    expect(() => resolveApiOrigin({ API_ORIGIN: 'not-a-url' })).toThrow(
      /API_ORIGIN/,
    );
  });
});
