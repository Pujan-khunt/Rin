import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '@/http';

describe('Origin validation', () => {
  it.each([
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
    'moz-extension://e7f53a99-4d92-4f3d-82d1-039c647b5921',
    'http://localhost',
    'http://localhost:8787',
    'http://127.0.0.1',
    'http://127.0.0.1:8787',
  ])('accepts a valid extension or local development origin: %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true);
  });

  it.each([
    null,
    '',
    'null',
    'http://localhost.example.com',
    'http://localhostevil.com',
    'http://127.0.0.1.example.com',
    'http://127.0.0.10',
    'http://localhost@evil.com',
    'http://user:password@localhost',
    'http://localhost:invalid',
    'http://localhost/solve',
    'http://localhost?query=1',
    'http://localhost#fragment',
    'http://localhost http://127.0.0.1',
    'https://localhost',
    'https://example.com',
    'chrome-extension://',
    'chrome-extension://example.com',
    'chrome-extension://abcdefghijklmnopqrstuvwxyz123456',
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop:8787',
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop/solve',
    'moz-extension://',
    'moz-extension://example.com',
    'moz-extension://not-a-uuid',
    'moz-extension://e7f53a99-4d92-4f3d-82d1-039c647b5921?query=1',
  ])('rejects an untrusted or malformed origin: %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });
});
