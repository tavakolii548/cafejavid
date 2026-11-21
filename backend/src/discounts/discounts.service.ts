import { HttpStatus, Injectable } from '@nestjs/common';
import { DiscountCode, DiscountType, Prisma } from '@prisma/client';
import { ApiException } from '../common/api.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiscountCodeDto, UpdateDiscountCodeDto } from './dto';

type CodeUserBrief = {
  id: string;
  phone: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  customerCode: string | null;
};

type CodeWithUser = DiscountCode & {
  user: CodeUserBrief | null;
};

const userSelect = {
  id: true,
  phone: true,
  name: true,
  firstName: true,
  lastName: true,
  customerCode: true,
} as const;

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.discountCode
      .findMany({
        include: { user: { select: userSelect } },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map((row) => this.present(row)));
  }

  async create(dto: CreateDiscountCodeDto, createdById?: string) {
    const code = normalizeCode(dto.code);
    if (!code) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CODE', 'کد تخفیف معتبر نیست');
    }
    this.assertValue(dto.type, dto.value, dto.maxDiscount);
    const userId = dto.userId?.trim() || null;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new ApiException(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'عضو باشگاه پیدا نشد');
      }
    }
    const existing = await this.prisma.discountCode.findUnique({ where: { code } });
    if (existing) {
      throw new ApiException(HttpStatus.CONFLICT, 'CODE_EXISTS', 'این کد قبلاً ثبت شده است');
    }
    const created = await this.prisma.discountCode.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        minOrder: dto.minOrder ?? null,
        maxDiscount: dto.type === DiscountType.PERCENT ? dto.maxDiscount ?? null : null,
        userId,
        active: dto.active !== false,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        maxUses: dto.maxUses ?? 1,
        createdById: createdById ?? null,
      },
      include: { user: { select: userSelect } },
    });
    return this.present(created);
  }

  async update(id: string, dto: UpdateDiscountCodeDto) {
    const current = await this.prisma.discountCode.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!current) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'کد تخفیف پیدا نشد');
    }
    const data: Prisma.DiscountCodeUpdateInput = {};
    if (typeof dto.active === 'boolean') data.active = dto.active;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.endsAt !== undefined) {
      data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }
    const updated = await this.prisma.discountCode.update({
      where: { id },
      data,
      include: { user: { select: userSelect } },
    });
    return this.present(updated);
  }

  async validateForUser(userId: string, rawCode: string, subtotal: number) {
    const code = await this.findUsable(userId, rawCode, subtotal);
    const discountAmount = computeDiscount(code, subtotal);
    return {
      code: code.code,
      type: code.type,
      value: code.value,
      discountAmount,
      subtotal,
      totalAfterDiscount: Math.max(0, subtotal - discountAmount),
    };
  }

  async applyInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    rawCode: string | undefined,
    subtotal: number,
  ): Promise<{ discountAmount: number; discountCode: string | null; codeId: string | null; maxUses: number }> {
    if (!rawCode?.trim()) {
      return { discountAmount: 0, discountCode: null, codeId: null, maxUses: 0 };
    }
    const code = await this.findUsable(userId, rawCode, subtotal, tx);
    const discountAmount = computeDiscount(code, subtotal);
    return { discountAmount, discountCode: code.code, codeId: code.id, maxUses: code.maxUses };
  }

  async recordRedemption(
    tx: Prisma.TransactionClient,
    params: { userId: string; codeId: string; orderId: string; maxUses: number },
  ) {
    const bumped = await tx.discountCode.updateMany({
      where: {
        id: params.codeId,
        active: true,
        usedCount: { lt: params.maxUses },
      },
      data: { usedCount: { increment: 1 } },
    });
    if (bumped.count === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CODE_EXHAUSTED', 'سقف استفاده از این کد پر شده است');
    }
    await tx.discountRedemption.create({
      data: {
        userId: params.userId,
        codeId: params.codeId,
        orderId: params.orderId,
      },
    });
  }

  private async findUsable(
    userId: string,
    rawCode: string,
    subtotal: number,
    tx?: Prisma.TransactionClient,
  ) {
    const codeNorm = normalizeCode(rawCode);
    if (!codeNorm) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CODE', 'کد تخفیف معتبر نیست');
    }
    const client = tx ?? this.prisma;
    const code = await client.discountCode.findUnique({ where: { code: codeNorm } });
    if (!code) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'CODE_NOT_FOUND', 'کد تخفیف پیدا نشد');
    }
    if (!code.active) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CODE_INACTIVE', 'این کد غیرفعال است');
    }
    if (code.userId && code.userId !== userId) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'CODE_NOT_FOR_YOU', 'این کد برای شما نیست');
    }
    const now = new Date();
    if (code.startsAt && code.startsAt > now) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CODE_NOT_STARTED', 'هنوز زمان استفاده از این کد نرسیده');
    }
    if (code.endsAt && code.endsAt < now) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CODE_EXPIRED', 'این کد منقضی شده است');
    }
    if (code.usedCount >= code.maxUses) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CODE_EXHAUSTED', 'سقف استفاده از این کد پر شده است');
    }
    if (typeof code.minOrder === 'number' && subtotal < code.minOrder) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'MIN_ORDER', 'مبلغ سفارش از حداقل این کد کمتر است');
    }
    return code;
  }

  private assertValue(type: DiscountType, value: number, maxDiscount?: number) {
    if (type === DiscountType.PERCENT) {
      if (value < 1 || value > 100) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_VALUE', 'درصد باید بین ۱ تا ۱۰۰ باشد');
      }
      if (maxDiscount !== undefined && maxDiscount < 1) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_MAX', 'سقف تخفیف معتبر نیست');
      }
    } else if (value < 1) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_VALUE', 'مبلغ تخفیف معتبر نیست');
    }
  }

  private present(row: CodeWithUser) {
    const displayName = row.user
      ? [row.user.firstName, row.user.lastName].filter(Boolean).join(' ') || row.user.name || null
      : null;
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value,
      minOrder: row.minOrder,
      maxDiscount: row.maxDiscount,
      userId: row.userId,
      active: row.active,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      createdAt: row.createdAt.toISOString(),
      createdById: row.createdById,
      user: row.user
        ? {
            id: row.user.id,
            phone: row.user.phone,
            name: displayName,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            customerCode: row.user.customerCode,
          }
        : null,
    };
  }
}

export function normalizeCode(raw: string) {
  return raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function computeDiscount(code: Pick<DiscountCode, 'type' | 'value' | 'maxDiscount'>, subtotal: number) {
  if (subtotal <= 0) return 0;
  let amount = 0;
  if (code.type === DiscountType.PERCENT) {
    amount = Math.floor((subtotal * code.value) / 100);
    if (typeof code.maxDiscount === 'number') {
      amount = Math.min(amount, code.maxDiscount);
    }
  } else {
    amount = code.value;
  }
  return Math.min(amount, subtotal);
}
