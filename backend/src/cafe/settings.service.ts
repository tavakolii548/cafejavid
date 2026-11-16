import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CafeSettings {
  cafeName: string;
  phone: string;
  address: string;
  openingHours: string;
  deliveryFee: number;
  packagingFee: number;
  minOrder: number;
  tableCount: number;
  acceptingOrders: boolean;
  receiptFooter: string;
}

const DEFAULTS: CafeSettings = {
  cafeName: 'کافه جاوید',
  phone: '',
  address: '',
  openingHours: '',
  deliveryFee: 0,
  packagingFee: 55000,
  minOrder: 0,
  tableCount: 0,
  acceptingOrders: true,
  receiptFooter: '',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<CafeSettings> {
    const rows = await this.prisma.setting.findMany();
    const merged: CafeSettings = { ...DEFAULTS };
    for (const row of rows) {
      if (row.key in merged) {
        (merged as unknown as Record<string, unknown>)[row.key] = row.value;
      }
    }
    merged.deliveryFee = Number(merged.deliveryFee) || 0;
    merged.packagingFee = Number(merged.packagingFee) || 0;
    merged.minOrder = Number(merged.minOrder) || 0;
    merged.tableCount = Number(merged.tableCount) || 0;
    merged.acceptingOrders = Boolean(merged.acceptingOrders);
    return merged;
  }

  async put(patch: Partial<CafeSettings>): Promise<CafeSettings> {
    const keys = Object.keys(DEFAULTS) as (keyof CafeSettings)[];
    for (const key of keys) {
      if (patch[key] === undefined) continue;
      await this.prisma.setting.upsert({
        where: { key },
        update: { value: patch[key] as Prisma.InputJsonValue },
        create: { key, value: patch[key] as Prisma.InputJsonValue },
      });
    }
    return this.get();
  }
}
