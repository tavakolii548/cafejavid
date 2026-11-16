import { HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationAudience, NotificationDelivery, OrderStatus, Prisma } from '@prisma/client';
import { ApiException } from '../common/api.exception';
import { jalaliDayKey, matchesMonthDay, personalize, tehranJalaliToday } from '../common/jalali.util';
import { PrismaService } from '../prisma/prisma.service';

const STATUS_COPY: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  PREPARING: { title: 'سفارش در حال آماده‌سازی', body: 'سفارش شماره %n وارد آشپزخانه شد.' },
  READY: { title: 'سفارشت آماده شد', body: 'سفارش شماره %n آماده تحویل است.' },
  OUT_FOR_DELIVERY: { title: 'پیک در راه است', body: 'سفارش شماره %n تحویل پیک شد.' },
  DELIVERED: { title: 'سفارش تحویل شد', body: 'سفارش شماره %n با موفقیت تحویل شد. نوش جان!' },
  CANCELLED: { title: 'سفارش لغو شد', body: 'سفارش شماره %n لغو شد.' },
};

type Audience = 'ALL' | 'USER' | 'MULTI' | 'BIRTHDAY' | 'SPECIAL_DAY';
type Delivery = 'NOW' | 'RULE';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // هر ۱۵ دقیقه قوانین تولد/روز خاص را چک می‌کند
    this.timer = setInterval(() => {
      void this.runDueRules().catch((err) => this.logger.warn(`notification rules: ${String(err)}`));
    }, 15 * 60 * 1000);
    void this.runDueRules().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async createCampaign(input: {
    title: string;
    body: string;
    audience: Audience;
    delivery?: Delivery;
    userId?: string;
    userIds?: string[];
    specialMonth?: number;
    specialDay?: number;
    active?: boolean;
    createdById?: string;
  }) {
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_NOTIFICATION', 'عنوان و متن اعلان الزامی است');
    }

    const audience = input.audience as NotificationAudience;
    let delivery = (input.delivery || 'NOW') as NotificationDelivery;
    const userIds = [...new Set((input.userIds || []).filter(Boolean))];
    const today = tehranJalaliToday();

    // روز خاصِ غیر امروز → قانون خودکار سالانه
    if (
      audience === NotificationAudience.SPECIAL_DAY &&
      delivery === NotificationDelivery.NOW &&
      input.specialMonth &&
      input.specialDay &&
      (input.specialMonth !== today.jm || input.specialDay !== today.jd)
    ) {
      delivery = NotificationDelivery.RULE;
    }
    // تولد به‌صورت قانون وقتی صریحاً RULE باشد؛ BIRTHDAY+NOW = ارسال به متولدین امروز

    if (audience === NotificationAudience.USER) {
      if (!input.userId) throw new ApiException(HttpStatus.BAD_REQUEST, 'USER_REQUIRED', 'مشتری را انتخاب کنید');
      await this.requireUsers([input.userId]);
    }
    if (audience === NotificationAudience.MULTI) {
      if (userIds.length === 0) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'USERS_REQUIRED', 'حداقل یک مشتری انتخاب کنید');
      }
      await this.requireUsers(userIds);
    }
    if (audience === NotificationAudience.SPECIAL_DAY) {
      if (!input.specialMonth || !input.specialDay) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'DATE_REQUIRED', 'ماه و روز خاص را وارد کنید');
      }
      if (userIds.length) await this.requireUsers(userIds);
    }

    if (delivery === NotificationDelivery.RULE) {
      if (
        audience !== NotificationAudience.BIRTHDAY &&
        audience !== NotificationAudience.SPECIAL_DAY
      ) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'RULE_UNSUPPORTED',
          'قانون خودکار فقط برای تولد یا روز خاص است',
        );
      }
      const campaign = await this.prisma.notificationCampaign.create({
        data: {
          title,
          body,
          audience,
          delivery,
          userId: null,
          userIds: audience === NotificationAudience.SPECIAL_DAY ? userIds : [],
          specialMonth: audience === NotificationAudience.SPECIAL_DAY ? input.specialMonth! : null,
          specialDay: audience === NotificationAudience.SPECIAL_DAY ? input.specialDay! : null,
          active: input.active ?? true,
          createdById: input.createdById ?? null,
        },
      });
      // اگر همین امروز صدق می‌کند، همان لحظه هم اجرا شود
      await this.executeRule(campaign.id);
      return this.toCampaignDto(await this.loadCampaign(campaign.id));
    }

    const recipients = await this.resolveRecipients({
      audience,
      userId: input.userId,
      userIds,
      specialMonth: input.specialMonth,
      specialDay: input.specialDay,
    });

    if (recipients.length === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'NO_RECIPIENTS', 'مخاطبی برای ارسال پیدا نشد');
    }

    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title,
        body,
        audience,
        delivery: NotificationDelivery.NOW,
        userId: audience === NotificationAudience.USER ? input.userId! : null,
        userIds: audience === NotificationAudience.MULTI || audience === NotificationAudience.SPECIAL_DAY ? userIds : [],
        specialMonth: audience === NotificationAudience.SPECIAL_DAY ? input.specialMonth ?? null : null,
        specialDay: audience === NotificationAudience.SPECIAL_DAY ? input.specialDay ?? null : null,
        active: false,
        lastRunOn: jalaliDayKey(),
        createdById: input.createdById ?? null,
        items: {
          create: recipients.map((user) => ({
            userId: user.id,
            title: personalize(title, user.name),
            body: personalize(body, user.name),
          })),
        },
      },
      include: { _count: { select: { items: true } } },
    });

    return this.toCampaignDto(campaign);
  }

  async updateRule(id: string, patch: { active?: boolean; title?: string; body?: string }) {
    const existing = await this.prisma.notificationCampaign.findUnique({ where: { id } });
    if (!existing || existing.delivery !== NotificationDelivery.RULE) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'قانون پیدا نشد');
    }
    const data: Prisma.NotificationCampaignUpdateInput = {};
    if (typeof patch.active === 'boolean') data.active = patch.active;
    if (patch.title?.trim()) data.title = patch.title.trim();
    if (patch.body?.trim()) data.body = patch.body.trim();
    const updated = await this.prisma.notificationCampaign.update({
      where: { id },
      data,
      include: { _count: { select: { items: true } } },
    });
    if (patch.active === true) await this.executeRule(id);
    return this.toCampaignDto(updated);
  }

  async listCampaigns() {
    const rows = await this.prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
      take: 150,
    });
    return rows.map((row) => this.toCampaignDto(row));
  }

  async previewRecipients(input: {
    audience: Audience;
    userId?: string;
    userIds?: string[];
    specialMonth?: number;
    specialDay?: number;
  }) {
    const recipients = await this.resolveRecipients(input);
    return {
      count: recipients.length,
      users: recipients.map((user) => ({
        id: user.id,
        phone: user.phone,
        name: user.name,
        birthDate: user.birthDate,
      })),
    };
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      read: Boolean(row.readAt),
    }));
  }

  async markAllRead(userId: string) {
    await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async notifyOrderStatus(userId: string, orderNumber: number, status: OrderStatus) {
    const copy = STATUS_COPY[status];
    if (!copy) return;
    const body = copy.body.replace('%n', String(orderNumber));
    await this.prisma.userNotification.create({
      data: {
        userId,
        title: copy.title,
        body,
      },
    });
  }

  async runDueRules() {
    const rules = await this.prisma.notificationCampaign.findMany({
      where: { delivery: NotificationDelivery.RULE, active: true },
    });
    for (const rule of rules) {
      await this.executeRule(rule.id);
    }
  }

  private async executeRule(campaignId: string) {
    const campaign = await this.prisma.notificationCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.delivery !== NotificationDelivery.RULE || !campaign.active) return;

    const today = tehranJalaliToday();
    const dayKey = jalaliDayKey(today);
    if (campaign.lastRunOn === dayKey) return;

    let due = false;
    if (campaign.audience === NotificationAudience.BIRTHDAY) {
      due = true;
    } else if (campaign.audience === NotificationAudience.SPECIAL_DAY) {
      due = campaign.specialMonth === today.jm && campaign.specialDay === today.jd;
    }
    if (!due) return;

    const recipients = await this.resolveRecipients({
      audience: campaign.audience as Audience,
      userIds: campaign.userIds,
      specialMonth: campaign.specialMonth ?? undefined,
      specialDay: campaign.specialDay ?? undefined,
    });

    if (recipients.length === 0) {
      await this.prisma.notificationCampaign.update({
        where: { id: campaign.id },
        data: { lastRunOn: dayKey },
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.userNotification.createMany({
        data: recipients.map((user) => ({
          campaignId: campaign.id,
          userId: user.id,
          title: personalize(campaign.title, user.name),
          body: personalize(campaign.body, user.name),
        })),
      }),
      this.prisma.notificationCampaign.update({
        where: { id: campaign.id },
        data: { lastRunOn: dayKey },
      }),
    ]);
  }

  private async resolveRecipients(input: {
    audience: Audience;
    userId?: string;
    userIds?: string[];
    specialMonth?: number;
    specialDay?: number;
  }) {
    const today = tehranJalaliToday();
    if (input.audience === 'ALL') {
      return this.prisma.user.findMany({ select: { id: true, phone: true, name: true, birthDate: true } });
    }
    if (input.audience === 'USER') {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId! },
        select: { id: true, phone: true, name: true, birthDate: true },
      });
      return user ? [user] : [];
    }
    if (input.audience === 'MULTI') {
      return this.prisma.user.findMany({
        where: { id: { in: input.userIds || [] } },
        select: { id: true, phone: true, name: true, birthDate: true },
      });
    }
    if (input.audience === 'BIRTHDAY') {
      const users = await this.prisma.user.findMany({
        where: { birthDate: { not: null } },
        select: { id: true, phone: true, name: true, birthDate: true },
      });
      return users.filter((user) => matchesMonthDay(user.birthDate, today.jm, today.jd));
    }
    // SPECIAL_DAY
    const month = input.specialMonth ?? today.jm;
    const day = input.specialDay ?? today.jd;
    // ارسال فوری روز خاص: فقط اگر تاریخ امروز همان روز باشد (مگر RULE که جدا چک می‌شود)
    if (input.specialMonth && input.specialDay && (month !== today.jm || day !== today.jd)) {
      // برای preview/NOW قبل از روز: لیست هدف (انتخاب‌شده یا همه) بدون فیلتر تولد
      if (input.userIds?.length) {
        return this.prisma.user.findMany({
          where: { id: { in: input.userIds } },
          select: { id: true, phone: true, name: true, birthDate: true },
        });
      }
      return this.prisma.user.findMany({ select: { id: true, phone: true, name: true, birthDate: true } });
    }
    if (input.userIds?.length) {
      return this.prisma.user.findMany({
        where: { id: { in: input.userIds } },
        select: { id: true, phone: true, name: true, birthDate: true },
      });
    }
    return this.prisma.user.findMany({ select: { id: true, phone: true, name: true, birthDate: true } });
  }

  private async requireUsers(ids: string[]) {
    const found = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'یکی از مشتریان پیدا نشد');
    }
  }

  private async loadCampaign(id: string) {
    return this.prisma.notificationCampaign.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
  }

  private toCampaignDto(row: {
    id: string;
    title: string;
    body: string;
    audience: NotificationAudience;
    delivery: NotificationDelivery;
    userId: string | null;
    userIds: string[];
    specialMonth: number | null;
    specialDay: number | null;
    active: boolean;
    lastRunOn: string | null;
    createdAt: Date;
    _count: { items: number };
  }) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      audience: row.audience,
      delivery: row.delivery,
      userId: row.userId,
      userIds: row.userIds,
      specialMonth: row.specialMonth,
      specialDay: row.specialDay,
      active: row.active,
      lastRunOn: row.lastRunOn,
      createdAt: row.createdAt.toISOString(),
      recipientCount: row._count.items,
    };
  }
}
