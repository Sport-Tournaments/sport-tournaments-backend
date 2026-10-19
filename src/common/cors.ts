import type {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Request } from 'express';

const CORS_BASE: CorsOptions = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  credentials: true,
};

export function isLocalNetworkHost(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host === 'host.containers.internal' || host === 'host.docker.internal')
    return true;
  if (/^10\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host)) return true;
  if (/^192\.168\.(\d{1,3})\.(\d{1,3})$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.(\d{1,3})\.(\d{1,3})$/.test(host))
    return true;
  return false;
}

/** Host the client addressed, honouring the reverse proxy's forwarded host. */
function requestHost(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (host?.split(',')[0] ?? req.headers.host)?.trim().toLowerCase();
}

export function isOriginAllowed(
  origin: string | undefined,
  req: Request,
  allowedOrigins: string[],
  isDevelopment: boolean,
): boolean {
  // No Origin: mobile apps, curl, server-to-server.
  if (!origin || allowedOrigins.includes(origin)) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  // Same-origin requests (browsers send Origin on same-origin POST/fetch too)
  // never need CORS; don't reject them just because the API's own domain is
  // not in CORS_ORIGINS.
  if (originHost === requestHost(req)) return true;

  return isDevelopment && isLocalNetworkHost(new URL(origin).hostname);
}

/**
 * CORS delegate. A disallowed origin gets a normal response without CORS
 * headers (the browser blocks it) instead of an error, which would surface as
 * a 500 and a logged stack trace on every request.
 */
export function corsDelegate(
  allowedOrigins: string[],
  isDevelopment: boolean,
): CorsOptionsDelegate<Request> {
  return (req, callback) => {
    const origin = req.headers.origin;
    callback(null, {
      ...CORS_BASE,
      origin: isOriginAllowed(origin, req, allowedOrigins, isDevelopment),
    });
  };
}
