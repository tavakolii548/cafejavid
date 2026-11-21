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

/** Absolute URL for stored media; leaves http(s) and empty values alone. */
export function absolutizeMediaUrl(url: string | null | undefined, base: string): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  if (!base) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base.replace(/\/+$/, '')}${path}`;
}
