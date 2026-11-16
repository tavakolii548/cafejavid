import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AddressController } from './address.controller';
import { AdminAuthController, AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomerGuard, StaffGuard } from './guards';
import { NotificationsModule } from '../notifications/notifications.module';
import { createSmsProvider, SMS_PROVIDER } from '../sms/sms.provider';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'dev-change-me-please-use-a-long-secret',
      }),
    }),
    NotificationsModule,
  ],
  controllers: [AuthController, AdminAuthController, MeController, AddressController],
  providers: [
    AuthService,
    CustomerGuard,
    StaffGuard,
    { provide: SMS_PROVIDER, useFactory: () => createSmsProvider() },
  ],
  exports: [AuthService, CustomerGuard, StaffGuard, JwtModule],
})
export class AuthModule {}
