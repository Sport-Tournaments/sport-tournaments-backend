import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

interface RequestContext {
  /** GA4 client id of the browser that made the request, if known. */
  gaClientId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** "GA1.1.123456789.1700000000" (the _ga cookie) -> "123456789.1700000000" */
export function parseGaCookie(value?: string): string | undefined {
  const match = value?.match(/^GA\d\.\d+\.(\d+\.\d+)$/);
  return match?.[1];
}

function readCookie(header: string | undefined, name: string) {
  return header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Remembers the visitor's GA4 client id for the duration of the request, so
 * server-side conversions are attributed to the same GA session/campaign.
 * Sent by the frontend as X-GA-Client-Id, or read from the _ga cookie.
 */
export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers['x-ga-client-id'];
  const fromHeader = (Array.isArray(header) ? header[0] : header)?.trim();
  const gaClientId =
    (fromHeader && /^\d+\.\d+$/.test(fromHeader) ? fromHeader : undefined) ??
    parseGaCookie(readCookie(req.headers.cookie, '_ga'));

  storage.run({ gaClientId }, next);
}
