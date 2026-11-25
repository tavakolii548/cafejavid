import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../common/api.exception';
import { ensureCustomerCode, nextCustomerCode } from '../common/customer-code';
import { normalizePhone } from '../common/phone';
import { SettingsService, CafeSettings } from '../cafe/settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto, ClubMemberDto, ProductWriteDto, UpdateClubMemberDto } from './dto';

const productInclude = {
  optionGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: { choices: { orderBy: { sortOrder: 'asc' as const } } },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  createCategory(dto: CategoryDto) {
    return this.prisma.category.create({
      data: { name: dto.name, sortOrder: dto.sortOrder ?? 0, active: dto.active ?? true },
    });
  }

  async updateCategory(id: string, dto: CategoryDto) {
    await this.ensureCategory(id);
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, sortOrder: dto.sortOrder, active: dto.active },
    });
  }

  async deleteCategory(id: string) {
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new ApiException(HttpStatus.CONFLICT, 'CATEGORY_IN_USE', 'این دسته محصول دارد');
    }
    await this.ensureCategory(id);
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  async reorderCategories(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.category.update({ where: { id }, data: { sortOrder: index } })),
    );
    return this.listCategories();
  }

  listProducts() {
    return this.prisma.product.findMany({
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      include: productInclude,
    });
  }

  async createProduct(dto: ProductWriteDto) {
    await this.ensureCategory(dto.categoryId);
    if (dto.featured) await this.clearFeatured();
    return this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        featured: dto.featured ?? false,
        soldOut: dto.soldOut ?? false,
        hidden: dto.hidden ?? false,
        sortOrder: dto.sortOrder ?? 0,
        serviceStartHour: normalizeServiceHour(dto.serviceStartHour),
        serviceEndHour: normalizeServiceHour(dto.serviceEndHour),
        optionGroups: dto.optionGroups ? { create: this.groupCreates(dto.optionGroups) } : undefined,
      },
      include: productInclude,
    });
  }

  async updateProduct(id: string, dto: ProductWriteDto) {
    await this.ensureProduct(id);
    await this.ensureCategory(dto.categoryId);
    if (dto.featured) await this.clearFeatured(id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.optionGroups) {
        await tx.optionGroup.deleteMany({ where: { productId: id } });
      }
      return tx.product.update({
        where: { id },
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          description: dto.description,
          price: dto.price,
          imageUrl: dto.imageUrl,
          featured: dto.featured,
          soldOut: dto.soldOut,
          hidden: dto.hidden,
          sortOrder: dto.sortOrder,
          serviceStartHour: normalizeServiceHour(dto.serviceStartHour),
          serviceEndHour: normalizeServiceHour(dto.serviceEndHour),
          optionGroups: dto.optionGroups ? { create: this.groupCreates(dto.optionGroups) } : undefined,
        },
        include: productInclude,
      });
    });
  }

  async setAvailability(id: string, soldOut: boolean) {
    await this.ensureProduct(id);
    return this.prisma.product.update({ where: { id }, data: { soldOut }, include: productInclude });
  }

  async deleteProduct(id: string) {
    const used = await this.prisma.orderItem.count({ where: { productId: id } });
    if (used > 0) {
      await this.prisma.product.update({ where: { id }, data: { hidden: true } });
      return { ok: true, hidden: true };
    }
    await this.prisma.product.delete({ where: { id } });
    return { ok: true, hidden: false };
  }

  getSettings() {
    return this.settings.get();
  }

  putSettings(body: Partial<CafeSettings>) {
    const patch: Partial<CafeSettings> = {};
    if (typeof body.cafeName === 'string') patch.cafeName = body.cafeName;
    if (typeof body.phone === 'string') patch.phone = body.phone;
    if (typeof body.address === 'string') patch.address = body.address;
    if (typeof body.openingHours === 'string') patch.openingHours = body.openingHours;
    if (typeof body.logoUrl === 'string') patch.logoUrl = body.logoUrl;
    if (typeof body.receiptHeader === 'string') patch.receiptHeader = body.receiptHeader;
    if (typeof body.receiptFooter === 'string') patch.receiptFooter = body.receiptFooter;
    if (typeof body.receiptShowPhone === 'boolean') patch.receiptShowPhone = body.receiptShowPhone;
    if (typeof body.receiptShowAddress === 'boolean') patch.receiptShowAddress = body.receiptShowAddress;
    if (typeof body.receiptShowHours === 'boolean') patch.receiptShowHours = body.receiptShowHours;
    if (typeof body.deliveryFee === 'number') patch.deliveryFee = body.deliveryFee;
    if (typeof body.packagingFee === 'number') patch.packagingFee = body.packagingFee;
    if (typeof body.minOrder === 'number') patch.minOrder = body.minOrder;
    if (typeof body.tableCount === 'number') patch.tableCount = body.tableCount;
    if (typeof body.acceptingOrders === 'boolean') patch.acceptingOrders = body.acceptingOrders;
    return this.settings.put(patch);
  }

  async customers(q?: string) {
    const needle = q?.trim();
    const users = await this.prisma.user.findMany({
      where: needle
        ? {
            OR: [
              { phone: { contains: needle } },
              { customerCode: { contains: needle, mode: 'insensitive' } },
              { name: { contains: needle, mode: 'insensitive' } },
              { firstName: { contains: needle, mode: 'insensitive' } },
              { lastName: { contains: needle, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: { total: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const missing = users.filter((user) => !user.customerCode);
    for (const user of missing) {
      try {
        user.customerCode = await ensureCustomerCode(this.prisma, user.id, user.customerCode);
      } catch {
        // leave null if race; list still usable
      }
    }
    return users.map((user) => this.presentClubMember(user));
  }

  async createClubMember(dto: ClubMemberDto) {
    const phone = normalizePhone(dto.phone);
    if (!phone) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_PHONE', 'شماره موبایل معتبر نیست');
    }
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new ApiException(HttpStatus.CONFLICT, 'PHONE_EXISTS', 'این موبایل قبلاً در باشگاه ثبت شده است');
    }
    const firstName = dto.firstName?.trim() || null;
    const lastName = dto.lastName?.trim() || null;
    const birthDate = dto.birthDate?.trim() || null;
    const name = [firstName, lastName].filter(Boolean).join(' ') || null;
    let customerCode = dto.customerCode?.trim() || (await nextCustomerCode(this.prisma));
    if (dto.customerCode?.trim()) {
      const taken = await this.prisma.user.findUnique({ where: { customerCode } });
      if (taken) {
        throw new ApiException(HttpStatus.CONFLICT, 'CODE_EXISTS', 'کد مشتری تکراری است');
      }
    }
    try {
      const user = await this.prisma.user.create({
        data: { phone, firstName, lastName, birthDate, name, customerCode },
        include: {
          orders: {
            where: { status: { not: 'CANCELLED' } },
            select: { total: true, createdAt: true },
          },
        },
      });
      return this.presentClubMember(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiException(HttpStatus.CONFLICT, 'DUPLICATE', 'موبایل یا کد مشتری تکراری است');
      }
      throw error;
    }
  }

  async updateClubMember(id: string, dto: UpdateClubMemberDto) {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'عضو باشگاه پیدا نشد');
    }
    const data: Prisma.UserUpdateInput = {};
    if (dto.phone !== undefined) {
      const phone = normalizePhone(dto.phone);
      if (!phone) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_PHONE', 'شماره موبایل معتبر نیست');
      }
      if (phone !== current.phone) {
        const taken = await this.prisma.user.findUnique({ where: { phone } });
        if (taken) {
          throw new ApiException(HttpStatus.CONFLICT, 'PHONE_EXISTS', 'این موبایل قبلاً ثبت شده است');
        }
      }
      data.phone = phone;
    }
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim() || null;
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim() || null;
    if (dto.birthDate !== undefined) data.birthDate = dto.birthDate.trim() || null;
    if (dto.customerCode !== undefined) {
      const code = dto.customerCode.trim();
      if (!code) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CODE', 'کد مشتری نمی‌تواند خالی باشد');
      }
      if (code !== current.customerCode) {
        const taken = await this.prisma.user.findUnique({ where: { customerCode: code } });
        if (taken) {
          throw new ApiException(HttpStatus.CONFLICT, 'CODE_EXISTS', 'کد مشتری تکراری است');
        }
      }
      data.customerCode = code;
    }
    const firstName =
      dto.firstName !== undefined ? (dto.firstName.trim() || null) : current.firstName;
    const lastName = dto.lastName !== undefined ? (dto.lastName.trim() || null) : current.lastName;
    data.name = [firstName, lastName].filter(Boolean).join(' ') || null;
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
        include: {
          orders: {
            where: { status: { not: 'CANCELLED' } },
            select: { total: true, createdAt: true },
          },
        },
      });
      return this.presentClubMember(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiException(HttpStatus.CONFLICT, 'DUPLICATE', 'موبایل یا کد مشتری تکراری است');
      }
      throw error;
    }
  }

  private presentClubMember(
    user: {
      id: string;
      phone: string;
      customerCode?: string | null;
      name: string | null;
      firstName?: string | null;
      lastName?: string | null;
      birthDate: string | null;
      createdAt?: Date;
      orders: { total: number; createdAt: Date }[];
      _count?: { addresses?: number };
    },
    extras?: { includeProfile?: boolean },
  ) {
    const totalSpent = user.orders.reduce((sum, order) => sum + order.total, 0);
    const last = user.orders.reduce<Date | null>(
      (acc, order) => (!acc || order.createdAt > acc ? order.createdAt : acc),
      null,
    );
    const base = {
      id: user.id,
      phone: user.phone,
      customerCode: user.customerCode ?? null,
      name: user.name,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      birthDate: user.birthDate,
      orderCount: user.orders.length,
      totalSpent,
      lastOrderAt: last ? last.toISOString() : null,
    };
    if (!extras?.includeProfile) return base;
    return {
      ...base,
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      addressCount: user._count?.addresses ?? 0,
      averageOrderValue: user.orders.length ? Math.round(totalSpent / user.orders.length) : 0,
    };
  }

  async getCustomer(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: { total: true, createdAt: true },
        },
        _count: { select: { addresses: true } },
      },
    });
    if (!user) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'مشتری پیدا نشد');
    if (!user.customerCode) {
      user.customerCode = await ensureCustomerCode(this.prisma, user.id);
    }
    return this.presentClubMember(user, { includeProfile: true });
  }

  async customerSummary(id: string, from: string, to: string) {
    await this.ensureCustomer(id);
    const start = new Date(`${from}T00:00:00.000+03:30`);
    const end = new Date(`${to}T23:59:59.999+03:30`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_DATE', 'بازه تاریخ معتبر نیست');
    }
    const orders = await this.prisma.order.findMany({
      where: {
        userId: id,
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      include: { items: true },
    });
    return this.aggregateOrders(orders);
  }

  async customerOrders(id: string, limit = 30) {
    await this.ensureCustomer(id);
    const take = Math.min(100, Math.max(1, limit || 30));
    const rows = await this.prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        number: true,
        status: true,
        fulfillment: true,
        total: true,
        discountAmount: true,
        discountCode: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true, lineTotal: true } },
      },
    });
    return rows.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      fulfillment: order.fulfillment,
      total: order.total,
      discountAmount: order.discountAmount ?? 0,
      discountCode: order.discountCode ?? null,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }));
  }

  async report(from: string, to: string) {
    const start = new Date(`${from}T00:00:00.000+03:30`);
    const end = new Date(`${to}T23:59:59.999+03:30`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_DATE', 'بازه تاریخ معتبر نیست');
    }
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      include: { items: true },
    });
    const aggregated = this.aggregateOrders(orders);
    return {
      totalSales: aggregated.totalSales,
      orderCount: aggregated.orderCount,
      averageOrderValue: aggregated.averageOrderValue,
      topProducts: aggregated.topProducts,
      hourly: aggregated.hourly,
    };
  }

  private aggregateOrders(
    orders: {
      total: number;
      fulfillment: string;
      discountAmount?: number | null;
      createdAt: Date;
      items: { productName: string; quantity: number; lineTotal: number }[];
    }[],
  ) {
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const orderCount = orders.length;
    const averageOrderValue = orderCount ? Math.round(totalSales / orderCount) : 0;
    const productMap = new Map<string, { name: string; quantity: number; amount: number }>();
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    const fulfillment: Record<string, number> = { DELIVERY: 0, PICKUP: 0, DINE_IN: 0 };
    let discountTotal = 0;
    for (const order of orders) {
      const hour = tehranHour(order.createdAt);
      hours[hour].count += 1;
      fulfillment[order.fulfillment] = (fulfillment[order.fulfillment] ?? 0) + 1;
      discountTotal += order.discountAmount ?? 0;
      for (const item of order.items) {
        const row = productMap.get(item.productName) ?? { name: item.productName, quantity: 0, amount: 0 };
        row.quantity += item.quantity;
        row.amount += item.lineTotal;
        productMap.set(item.productName, row);
      }
    }
    const topProducts = [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    return {
      totalSales,
      orderCount,
      averageOrderValue,
      topProducts,
      hourly: hours,
      fulfillment,
      discountTotal,
    };
  }

  private async ensureCustomer(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'مشتری پیدا نشد');
    return user;
  }

  private groupCreates(groups: NonNullable<ProductWriteDto['optionGroups']>) {
    return groups.map((group, index) => ({
      name: group.name,
      type: group.type,
      required: group.required,
      sortOrder: index,
      choices: {
        create: group.choices.map((choice, choiceIndex) => ({
          name: choice.name,
          priceDelta: choice.priceDelta,
          isDefault: choice.isDefault ?? false,
          sortOrder: choiceIndex,
        })),
      },
    }));
  }

  private async clearFeatured(exceptId?: string) {
    await this.prisma.product.updateMany({
      where: { featured: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      data: { featured: false },
    });
  }

  private async ensureCategory(id: string) {
    const row = await this.prisma.category.findUnique({ where: { id } });
    if (!row) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'دسته پیدا نشد');
    return row;
  }

  private async ensureProduct(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id } });
    if (!row) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'محصول پیدا نشد');
    return row;
  }
}

function tehranHour(date: Date) {
  const part = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find((item) => item.type === 'hour');
  return Number(part?.value ?? 0);
}

/** Both hours required for a window; otherwise clear restriction. */
function normalizeServiceHour(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Math.trunc(Number(value));
  if (n < 0 || n > 23) return null;
  return n;
}
