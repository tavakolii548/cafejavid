import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { absolutizeMediaUrl, publicBaseUrl } from '../common/media-url';
import { SettingsService } from './settings.service';

@ApiTags('config')
@Controller('config')
export class ConfigController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get(@Req() req: Request) {
    const s = await this.settings.get();
    const mediaBase = publicBaseUrl(req);
    return {
      cafeName: s.cafeName,
      phone: s.phone,
      courierPhone: s.courierPhone,
      address: s.address,
      openingHours: s.openingHours,
      logoUrl: absolutizeMediaUrl(s.logoUrl, mediaBase) || s.logoUrl || '',
      acceptingOrders: s.acceptingOrders,
      deliveryFee: s.deliveryFee,
      packagingFee: s.packagingFee,
      minOrder: s.minOrder,
      tableCount: s.tableCount,
      onlinePaymentEnabled: process.env.PAYMENT_ONLINE_ENABLED === 'true',
      receiptHeader: s.receiptHeader,
      receiptFooter: s.receiptFooter,
      receiptShowPhone: s.receiptShowPhone,
      receiptShowAddress: s.receiptShowAddress,
      receiptShowHours: s.receiptShowHours,
    };
  }
}
