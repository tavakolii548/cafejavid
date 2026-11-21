import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CafeModule } from '../cafe/cafe.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, CafeModule, OrdersModule, NotificationsModule, DiscountsModule, InventoryModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
