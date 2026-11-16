import { Request } from 'express';

export function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const q = req.query?.token;
  if (typeof q === 'string' && q.length > 0) return q;
  return null;
}
