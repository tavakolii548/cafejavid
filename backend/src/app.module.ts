import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CafeModule } from './cafe/cafe.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health.controller';
import { MenuModule } from './menu/menu.module';
import { DiscountsModule } from './discounts/discounts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    CafeModule,
    AuthModule,
    MenuModule,
    OrdersModule,
    NotificationsModule,
    DiscountsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
