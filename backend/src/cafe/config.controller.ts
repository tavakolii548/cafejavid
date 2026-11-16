import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('config')
@Controller('config')
export class ConfigController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get() {
    const s = await this.settings.get();
    return {
      cafeName: s.cafeName,
      phone: s.phone,
      address: s.address,
      openingHours: s.openingHours,
      acceptingOrders: s.acceptingOrders,
      deliveryFee: s.deliveryFee,
      packagingFee: s.packagingFee,
      minOrder: s.minOrder,
      tableCount: s.tableCount,
      onlinePaymentEnabled: process.env.PAYMENT_ONLINE_ENABLED === 'true',
      receiptFooter: s.receiptFooter,
    };
  }
}
