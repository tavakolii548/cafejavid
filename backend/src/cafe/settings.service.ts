import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CafeSettings {
  cafeName: string;
  phone: string;
  courierPhone: string;
  address: string;
  openingHours: string;
  logoUrl: string;
  deliveryFee: number;
  packagingFee: number;
  minOrder: number;
  tableCount: number;
  acceptingOrders: boolean;
  receiptHeader: string;
  receiptFooter: string;
  receiptShowPhone: boolean;
  receiptShowAddress: boolean;
  receiptShowHours: boolean;
}

const DEFAULTS: CafeSettings = {
  cafeName: 'کافه جاوید',
  phone: '',
  courierPhone: '',
  address: '',
  openingHours: '',
  logoUrl: '',
  deliveryFee: 0,
  packagingFee: 55000,
  minOrder: 0,
  tableCount: 0,
  acceptingOrders: true,
  receiptHeader: '',
  receiptFooter: '',
  receiptShowPhone: true,
  receiptShowAddress: true,
  receiptShowHours: false,
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
    merged.logoUrl = typeof merged.logoUrl === 'string' ? merged.logoUrl : '';
    merged.courierPhone = typeof merged.courierPhone === 'string' ? merged.courierPhone : '';
    merged.receiptHeader = typeof merged.receiptHeader === 'string' ? merged.receiptHeader : '';
    merged.receiptShowPhone = merged.receiptShowPhone !== false;
    merged.receiptShowAddress = merged.receiptShowAddress !== false;
    merged.receiptShowHours = Boolean(merged.receiptShowHours);
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
