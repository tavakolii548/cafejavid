import { Body, Controller, Get, Post, Put, Req, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AccessPayload, AuthService } from './auth.service';
import { CustomerLoginDto, RefreshDto, RequestOtpDto, StaffLoginDto, UpdateMeDto, VerifyOtpDto } from './dto';
import { CustomerGuard } from './guards';
import { ApiException } from '../common/api.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  request(@Body() body: RequestOtpDto) {
    return this.auth.requestOtp(body.phone);
  }

  @Post('otp/verify')
  verify(@Body() body: VerifyOtpDto) {
    return this.auth.verifyOtp(body.phone, body.code);
  }

  @Post('login')
  login(@Body() body: CustomerLoginDto) {
    return this.auth.customerLogin(body);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  logout(@Body() body: RefreshDto) {
    return this.auth.logout(body.refreshToken);
  }
}

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: StaffLoginDto) {
    return this.auth.staffLogin(body.username, body.password);
  }
}

@ApiTags('me')
@Controller('me')
@UseGuards(CustomerGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  async get(@Req() req: Request & { user: AccessPayload }) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'کاربر پیدا نشد');
    return presentUser(user);
  }

  @Put()
  async update(@Req() req: Request & { user: AccessPayload }, @Body() body: UpdateMeDto) {
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const birthDate = body.birthDate?.trim();
    const composed =
      body.name?.trim() ||
      [firstName, lastName].filter(Boolean).join(' ') ||
      undefined;
    const user = await this.prisma.user.update({
      where: { id: req.user.sub },
      data: {
        name: composed ?? null,
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        birthDate: birthDate ?? undefined,
      },
    });
    return presentUser(user);
  }

  @Get('notifications')
  notificationsList(@Req() req: Request & { user: AccessPayload }) {
    return this.notifications.listForUser(req.user.sub);
  }

  @Post('notifications/read')
  notificationsRead(@Req() req: Request & { user: AccessPayload }) {
    return this.notifications.markAllRead(req.user.sub);
  }
}

function presentUser(user: {
  id: string;
  phone: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  customerCode?: string | null;
}) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate,
    customerCode: user.customerCode ?? null,
  };
}
