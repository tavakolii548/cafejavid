import { HttpStatus, Injectable } from '@nestjs/common';
import { Fulfillment, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { ApiException } from '../common/api.exception';
import { SettingsService } from '../cafe/settings.service';
import { OrderEventsService } from '../events/order-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CashPaymentGateway, ZarinpalPaymentGateway } from '../payment/payment.gateway';
import { LogPushProvider } from '../push/push.provider';
import { PrismaService } from '../prisma/prisma.service';
import { DiscountsService } from '../discounts/discounts.service';
import { CreateOrderDto } from './dto';
import { orderInclude, OrderWithRelations, presentOrder } from './present';
import { PriceError, priceItem } from './pricing';
import { canTransition, customerCanCancel, OrderStatus } from './state-machine';

const STATUSES: OrderStatus[] = ['NEW', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

@Injectable()
export class OrdersService {
  private readonly cash = new CashPaymentGateway();
  private readonly online = new ZarinpalPaymentGateway();
  private readonly push = new LogPushProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly events: OrderEventsService,
    private readonly notifications: NotificationsService,
    private readonly discounts: DiscountsService,
  ) {}

  async create(userId: string, dto: CreateOrderDto, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await this.findByKey(idempotencyKey);
      if (existing) {
        if (existing.userId !== userId) {
          throw new ApiException(HttpStatus.CONFLICT, 'IDEMPOTENCY_CONFLICT', 'این کلید قبلاً استفاده شده است');
        }
        return presentOrder(existing);
      }
    }
    const cafe = await this.settings.get();
    if (!cafe.acceptingOrders) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'NOT_ACCEPTING', 'الان سفارش نمی‌گیریم');
    }
    if (!dto.items?.length) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'EMPTY_CART', 'سبد خرید خالی است');
    }
    if (dto.paymentMethod === PaymentMethod.ONLINE && process.env.PAYMENT_ONLINE_ENABLED !== 'true') {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'ONLINE_DISABLED', 'پرداخت آنلاین فعال نیست');
    }

    let deliveryFee = 0;
    let tableNumber: number | null = null;
    let addressSnapshot: Prisma.InputJsonValue | null = null;
    if (dto.fulfillment === Fulfillment.DELIVERY) {
      deliveryFee = cafe.deliveryFee;
      if (dto.addressId) {
        const addr = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId } });
        if (!addr) throw new ApiException(HttpStatus.BAD_REQUEST, 'ADDRESS_REQUIRED', 'آدرس را انتخاب کنید');
        addressSnapshot = { title: addr.title, details: addr.details, lat: addr.lat, lng: addr.lng };
      } else if (dto.address) {
        addressSnapshot = {
          title: dto.address.title,
          details: dto.address.details,
          lat: dto.address.lat,
          lng: dto.address.lng,
        };
      } else {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'ADDRESS_REQUIRED', 'آدرس را انتخاب کنید');
      }
    } else if (dto.fulfillment === Fulfillment.DINE_IN) {
      if (!dto.tableNumber || dto.tableNumber < 1 || dto.tableNumber > cafe.tableCount) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_TABLE', 'شماره میز معتبر نیست');
      }
      tableNumber = dto.tableNumber;
    } else if (dto.fulfillment !== Fulfillment.PICKUP) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_FULFILLMENT', 'نوع تحویل معتبر نیست');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // $executeRaw: pg_advisory_xact_lock returns void; $queryRaw fails to deserialize it (P2010 → 500).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001)`;
      if (idempotencyKey) {
        const again = await tx.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
        if (again) return again;
      }
      const lines = [];
      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { optionGroups: { include: { choices: true }, orderBy: { sortOrder: 'asc' } } },
        });
        if (!product || product.hidden) {
          throw new ApiException(HttpStatus.BAD_REQUEST, 'UNAVAILABLE', 'یکی از آیتم‌ها در دسترس نیست');
        }
        if (product.soldOut) {
          throw new ApiException(HttpStatus.BAD_REQUEST, 'SOLD_OUT', 'یکی از آیتم‌ها تموم شده است');
        }
        let priced;
        try {
          priced = priceItem(
            product.price,
            product.optionGroups.map((group) => ({
              id: group.id,
              name: group.name,
              type: group.type,
              required: group.required,
              choices: group.choices.map((choice) => ({
                id: choice.id,
                name: choice.name,
                priceDelta: choice.priceDelta,
              })),
            })),
            item.choiceIds ?? [],
            item.quantity,
          );
        } catch (error) {
          if (error instanceof PriceError) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_OPTIONS', 'گزینه‌های انتخاب‌شده معتبر نیست');
          }
          throw error;
        }
        lines.push({ product, priced, quantity: item.quantity, note: item.note ?? null });
      }
      const subtotal = lines.reduce((sum, line) => sum + line.priced.lineTotal, 0);
      if (subtotal < cafe.minOrder) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'MIN_ORDER', 'مبلغ سفارش از حداقل کمتر است');
      }
      const packagingFee = lines.length > 0 ? cafe.packagingFee : 0;
      const applied = await this.discounts.applyInTransaction(tx, userId, dto.discountCode, subtotal);
      const total = Math.max(0, subtotal - applied.discountAmount + deliveryFee + packagingFee);
      const agg = await tx.order.aggregate({ _max: { number: true } });
      const number = (agg._max.number ?? 1000) + 1;
      const order = await tx.order.create({
        data: {
          number,
          userId,
          status: 'NEW',
          fulfillment: dto.fulfillment,
          tableNumber,
          addressSnapshot: addressSnapshot ?? undefined,
          customerNote: dto.note ?? null,
          subtotal,
          deliveryFee,
          packagingFee,
          discountAmount: applied.discountAmount,
          discountCode: applied.discountCode,
          total,
          paymentMethod: dto.paymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          estimatedMinutes: 25,
          idempotencyKey: idempotencyKey || null,
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              productName: line.product.name,
              unitPrice: line.priced.unitPrice,
              quantity: line.quantity,
              optionsSnapshot: line.priced.options as unknown as Prisma.InputJsonValue,
              note: line.note,
              lineTotal: line.priced.lineTotal,
            })),
          },
          statusLogs: { create: { toStatus: 'NEW' } },
        },
        include: orderInclude,
      });
      if (applied.codeId) {
        await this.discounts.recordRedemption(tx, {
          userId,
          codeId: applied.codeId,
          orderId: order.id,
          maxUses: applied.maxUses,
        });
      }
      return order;
    });

    if (dto.paymentMethod === PaymentMethod.ONLINE) {
      await this.online.start(created.id, created.total);
    } else {
      await this.cash.start(created.id, created.total);
    }
    const presented = presentOrder(created);
    this.events.created(presented);
    await this.push.notify('order.created', created.id);
    return presented;
  }

  listMine(userId: string) {
    return this.prisma.order
      .findMany({ where: { userId }, include: orderInclude, orderBy: { createdAt: 'desc' } })
      .then((rows) => rows.map(presentOrder));
  }

  async getOwned(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, include: orderInclude });
    if (!order) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'سفارش پیدا نشد');
    return presentOrder(order);
  }

  async cancelMine(userId: string, id: string, reason?: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!order) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'سفارش پیدا نشد');
    if (!customerCanCancel(order.status)) {
      throw new ApiException(HttpStatus.CONFLICT, 'INVALID_TRANSITION', 'این سفارش دیگر قابل لغو نیست');
    }
    return this.applyStatus(order.id, 'CANCELLED', null, reason);
  }

  async reorderPreview(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!order) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'سفارش پیدا نشد');
    const items = [];
    const unavailable: { productName: string; reason: string }[] = [];
    for (const item of order.items) {
      const snapshot = Array.isArray(item.optionsSnapshot) ? item.optionsSnapshot : [];
      const choiceIds = snapshot
        .map((option) => (option as { choiceId?: string }).choiceId)
        .filter((value): value is string => Boolean(value));
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { optionGroups: { include: { choices: true } } },
      });
      if (!product || product.hidden || product.soldOut) {
        unavailable.push({ productName: item.productName, reason: 'در دسترس نیست' });
        continue;
      }
      try {
        const priced = priceItem(
          product.price,
          product.optionGroups.map((group) => ({
            id: group.id,
            name: group.name,
            type: group.type,
            required: group.required,
            choices: group.choices.map((choice) => ({
              id: choice.id,
              name: choice.name,
              priceDelta: choice.priceDelta,
            })),
          })),
          choiceIds,
          item.quantity,
        );
        items.push({
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          choiceIds,
          note: item.note,
          unitPrice: priced.unitPrice,
          lineTotal: priced.lineTotal,
          optionSummary: priced.options.map((option) => option.choiceName).join(' · '),
        });
      } catch {
        unavailable.push({ productName: item.productName, reason: 'گزینه‌ها تغییر کرده‌اند' });
      }
    }
    return { items, unavailable };
  }

  async listAdmin(status?: string, date?: string) {
    const where: Prisma.OrderWhereInput = {};
    if (status && STATUSES.includes(status as OrderStatus)) {
      where.status = status as OrderStatus;
    }
    if (date) {
      const start = new Date(`${date}T00:00:00.000+03:30`);
      const end = new Date(`${date}T23:59:59.999+03:30`);
      if (Number.isNaN(start.getTime())) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_DATE', 'تاریخ معتبر نیست');
      }
      where.createdAt = { gte: start, lte: end };
    }
    const rows = await this.prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(presentOrder);
  }

  async getAdmin(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'سفارش پیدا نشد');
    return presentOrder(order);
  }

  async setStatus(id: string, staffId: string, toStatusRaw: string, reason?: string, estimatedMinutes?: number) {
    if (!STATUSES.includes(toStatusRaw as OrderStatus)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_STATUS', 'وضعیت معتبر نیست');
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'سفارش پیدا نشد');
    const toStatus = toStatusRaw as OrderStatus;
    if (!canTransition(order.status, toStatus, order.fulfillment)) {
      throw new ApiException(HttpStatus.CONFLICT, 'INVALID_TRANSITION', 'این تغییر وضعیت مجاز نیست');
    }
    return this.applyStatus(id, toStatus, staffId, reason, estimatedMinutes);
  }

  private async applyStatus(
    id: string,
    toStatus: OrderStatus,
    staffId: string | null,
    reason?: string,
    estimatedMinutes?: number,
  ) {
    const current = await this.prisma.order.findUnique({ where: { id } });
    if (!current) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'سفارش پیدا نشد');
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: toStatus,
        cancelReason: toStatus === 'CANCELLED' ? reason ?? current.cancelReason : current.cancelReason,
        estimatedMinutes: estimatedMinutes ?? current.estimatedMinutes,
        paymentStatus:
          toStatus === 'DELIVERED' && current.paymentMethod === PaymentMethod.CASH
            ? PaymentStatus.PAID
            : current.paymentStatus,
        statusLogs: {
          create: { fromStatus: current.status, toStatus, byStaffId: staffId },
        },
      },
      include: orderInclude,
    });
    const presented = presentOrder(updated);
    this.events.updated(id, presented);
    await this.push.notify('order.updated', id);
    await this.notifications.notifyOrderStatus(updated.userId, updated.number, toStatus);
    return presented;
  }

  private findByKey(idempotencyKey: string) {
    return this.prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
  }
}

export type { OrderWithRelations };
