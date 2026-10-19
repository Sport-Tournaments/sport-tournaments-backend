import type { Request } from 'express';
import { corsDelegate, isOriginAllowed } from './cors';

const req = (headers: Record<string, string>) =>
  ({ headers }) as unknown as Request;

describe('CORS', () => {
  const allowed = ['https://tournamente.com'];
  const apiReq = req({ host: 'api.tournamente.com' });

  it('allows listed origins and requests without an Origin', () => {
    expect(
      isOriginAllowed('https://tournamente.com', apiReq, allowed, false),
    ).toBe(true);
    expect(isOriginAllowed(undefined, apiReq, allowed, false)).toBe(true);
  });

  it('allows same-origin requests even when not listed', () => {
    expect(
      isOriginAllowed('https://api.tournamente.com', apiReq, allowed, false),
    ).toBe(true);
  });

  it('uses the forwarded host behind a proxy', () => {
    const proxied = req({
      host: 'backend:3000',
      'x-forwarded-host': 'api.tournamente.com',
    });
    expect(
      isOriginAllowed('https://api.tournamente.com', proxied, allowed, false),
    ).toBe(true);
  });

  it('rejects other origins; local network only in development', () => {
    expect(
      isOriginAllowed('https://evil.example', apiReq, allowed, false),
    ).toBe(false);
    expect(
      isOriginAllowed('http://192.168.1.5:3000', apiReq, allowed, false),
    ).toBe(false);
    expect(
      isOriginAllowed('http://192.168.1.5:3000', apiReq, allowed, true),
    ).toBe(true);
    expect(isOriginAllowed('not a url', apiReq, allowed, true)).toBe(false);
  });

  it('rejects without an error so no 500 is returned', () => {
    const cb = jest.fn();
    corsDelegate(allowed, false)(
      req({ host: 'api.tournamente.com', origin: 'https://evil.example' }),
      cb,
    );
    expect(cb).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ origin: false, credentials: true }),
    );
  });
});
