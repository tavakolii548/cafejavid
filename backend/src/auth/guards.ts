import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StaffRole } from '@prisma/client';
import { Request } from 'express';
import { ApiException } from '../common/api.exception';
import { extractToken } from '../common/auth-token';
import { AccessPayload } from './auth.service';

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AccessPayload }>();
    req.user = verify(this.jwt, req, 'customer');
    return true;
  }
}

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AccessPayload }>();
    req.user = verify(this.jwt, req, 'staff');
    return true;
  }
}

export function assertOwner(req: Request & { user?: AccessPayload }) {
  if (req.user?.role !== StaffRole.OWNER) {
    throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'فقط مدیر به این بخش دسترسی دارد');
  }
}

function verify(jwt: JwtService, req: Request, typ: 'customer' | 'staff'): AccessPayload {
  const token = extractToken(req);
  if (!token) {
    throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'وارد حساب نشده‌اید');
  }
  try {
    const payload = jwt.verify<AccessPayload>(token);
    if (payload.typ !== typ) {
      throw new Error('typ');
    }
    return payload;
  } catch {
    throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'نشست شما منقضی شده است');
  }
}
