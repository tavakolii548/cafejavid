import { Request } from 'express';

/** Public origin for media URLs: env override, else request host. */
export function publicBaseUrl(req?: Request): string {
  const fromEnv = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (!req) return '';
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0]?.trim() : undefined) ||
    req.protocol ||
    'http';
  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0]?.trim() : undefined) ||
    req.get('host') ||
    '';
  if (!host) return '';
  return `${proto}://${host}`;
}

/** Prefer storing `/uploads/...` so clients can resolve against the live API host. */
export function toRelativeUploadPath(url: string | null | undefined): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/uploads\/[^?#]+/i);
  if (match) return match[0];
  if (trimmed.startsWith('/')) return trimmed;
  return trimmed;
}

/** Absolute URL for stored media; rewrites `/uploads` paths onto the public base. */
export function absolutizeMediaUrl(url: string | null | undefined, base: string): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;

  const uploadsPath = trimmed.match(/\/uploads\/[^?#]+/i)?.[0];
  if (uploadsPath) {
    if (!base) return uploadsPath;
    return `${base.replace(/\/+$/, '')}${uploadsPath}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!base) return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base.replace(/\/+$/, '')}${path}`;
}
