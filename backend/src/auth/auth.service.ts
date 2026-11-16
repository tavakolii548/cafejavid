import { createHash, randomBytes, randomInt } from 'crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StaffRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ApiException } from '../common/api.exception';
import { ensureCustomerCode, nextCustomerCode } from '../common/customer-code';
import { normalizePhone, otpAttemptResult } from '../common/phone';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms.provider';

export interface AccessPayload {
  sub: string;
  typ: 'customer' | 'staff';
  role?: StaffRole;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async requestOtp(phoneRaw: string) {
    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_PHONE', 'شماره موبایل معتبر نیست');
    }
    const now = Date.now();
    const recent = await this.prisma.otpCode.findMany({
      where: { phone, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent.length >= 5) {
      const oldest = recent[recent.length - 1];
      const retry = Math.ceil((oldest.createdAt.getTime() + 60 * 60 * 1000 - now) / 1000);
      return { retryAfterSeconds: Math.max(retry, 1) };
    }
    if (recent[0]) {
      const elapsed = (now - recent[0].createdAt.getTime()) / 1000;
      if (elapsed < 60) {
        return { retryAfterSeconds: Math.ceil(60 - elapsed) };
      }
    }
    const code = String(randomInt(0, 10000)).padStart(4, '0');
    const codeHash = await bcrypt.hash(code, 8);
    await this.prisma.otpCode.create({
      data: { phone, codeHash, expiresAt: new Date(now + 120_000) },
    });
    await this.sms.sendOtp(phone, code);
    return { retryAfterSeconds: 60 };
  }

  async customerLogin(input: {
    phone: string;
    password: string;
    register?: boolean;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
  }) {
    const phone = normalizePhone(input.phone);
    if (!phone) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_PHONE', 'شماره موبایل معتبر نیست');
    }
    const password = input.password.trim();
    if (password.length < 4) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'WEAK_PASSWORD', 'رمز عبور حداقل ۴ کاراکتر باشد');
    }
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (input.register) {
      if (existing) {
        throw new ApiException(HttpStatus.CONFLICT, 'ALREADY_REGISTERED', 'این شماره قبلاً ثبت‌نام شده؛ وارد شو');
      }
      const firstName = input.firstName?.trim() || null;
      const lastName = input.lastName?.trim() || null;
      const birthDate = input.birthDate?.trim() || null;
      const name = [firstName, lastName].filter(Boolean).join(' ') || null;
      const passwordHash = await bcrypt.hash(password, 10);
      const customerCode = await nextCustomerCode(this.prisma);
      const user = await this.prisma.user.create({
        data: { phone, passwordHash, firstName, lastName, birthDate, name, customerCode },
      });
      return this.issueCustomer(user.id, user);
    }
    if (!existing || !existing.passwordHash) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'NOT_REGISTERED', 'حسابی با این شماره نیست؛ ثبت‌نام کن');
    }
    if (!(await bcrypt.compare(password, existing.passwordHash))) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'WRONG_PASSWORD', 'رمز عبور اشتباه است');
    }
    return this.issueCustomer(existing.id, existing);
  }

  async verifyOtp(phoneRaw: string, code: string) {
    const phone = normalizePhone(phoneRaw);
    if (!phone || !/^\d{4}$/.test(code)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CODE', 'کد واردشده درست نیست');
    }
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CODE', 'کد واردشده درست نیست');
    }
    const matches = await bcrypt.compare(code, otp.codeHash);
    const result = otpAttemptResult(otp.attempts, matches);
    if (result === 'locked') {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'OTP_LOCKED', 'تعداد تلاش‌ها بیش از حد مجاز است');
    }
    if (result === 'invalid') {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CODE', 'کد واردشده درست نیست');
    }
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      const customerCode = await nextCustomerCode(this.prisma);
      user = await this.prisma.user.create({ data: { phone, customerCode } });
    } else if (!user.customerCode) {
      const customerCode = await ensureCustomerCode(this.prisma, user.id, user.customerCode);
      user = { ...user, customerCode };
    }
    return this.issueCustomer(user.id, user);
  }

  async refresh(refreshToken: string) {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'نشست شما منقضی شده است');
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    if (row.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
      if (!user) throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'نشست شما منقضی شده است');
      return this.issueCustomer(user.id, user);
    }
    if (row.staffId) {
      const staff = await this.prisma.staffUser.findUnique({ where: { id: row.staffId } });
      if (!staff || !staff.active) {
        throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'نشست شما منقضی شده است');
      }
      return this.issueStaff(staff.id, staff.role, staff.username);
    }
    throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'نشست شما منقضی شده است');
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async staffLogin(username: string, password: string) {
    const staff = await this.prisma.staffUser.findUnique({ where: { username } });
    if (!staff || !staff.active || !(await bcrypt.compare(password, staff.passwordHash))) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_LOGIN', 'نام کاربری یا رمز عبور نادرست است');
    }
    return this.issueStaff(staff.id, staff.role, staff.username);
  }

  private async issueCustomer(
    userId: string,
    user: {
      id: string;
      phone: string;
      name: string | null;
      firstName?: string | null;
      lastName?: string | null;
      birthDate?: string | null;
      customerCode?: string | null;
    },
  ) {
    let customerCode = user.customerCode ?? null;
    if (!customerCode) {
      try {
        customerCode = await ensureCustomerCode(this.prisma, userId, customerCode);
      } catch {
        customerCode = null;
      }
    }
    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: 'customer' } satisfies AccessPayload,
      { expiresIn: '15m' },
    );
    const refreshToken = await this.storeRefresh({ userId });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        birthDate: user.birthDate ?? null,
        customerCode,
      },
    };
  }

  private async issueStaff(staffId: string, role: StaffRole, username: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: staffId, typ: 'staff', role } satisfies AccessPayload,
      { expiresIn: '15m' },
    );
    const refreshToken = await this.storeRefresh({ staffId });
    return { accessToken, refreshToken, staff: { id: staffId, username, role } };
  }

  private async storeRefresh(owner: { userId?: string; staffId?: string }) {
    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: sha256(refreshToken),
        userId: owner.userId,
        staffId: owner.staffId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return refreshToken;
  }
}
